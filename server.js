import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

// ========================================
// 🔥 SUAS CHAVES DA FURIAPAY
// ========================================
const AUTH_USER = 'sk_Bd1RrZ2IBjB_-9YWYjQvi4IfRMT-i6c0DBLcs-qVv_-1y0sh';
const AUTH_PASS = 'pk_FUHVfRa8PXVyYJYoW1goJo6d0o3l5y2DYNiMztBUkSKvGTyh';
// ========================================

const API_URL = 'https://api.furiapaybr.com/v1/transactions';

const transactions = new Map();

// ========================================
// 🔥 ROTA 1: Criar transação PIX
// ========================================
app.post("/api/gerar-pix", async (req, res) => {
  try {
    const { valor, cpf, nome, email } = req.body;
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔥 NOVA REQUISIÇÃO - GERAR PIX');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💰 Valor:', valor);
    console.log('👤 CPF:', cpf);
    console.log('📝 Nome:', nome);
    console.log('📧 Email:', email);
    
    // Validações
    if (!valor || valor <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Valor inválido' 
      });
    }
    
    if (!cpf || !nome) {
      return res.status(400).json({ 
        success: false, 
        error: 'CPF e Nome são obrigatórios' 
      });
    }
    
    // Converter valor para centavos
    const amountInCents = Math.round(valor * 100);
    
    // ========================================
    // ✅ ESTRUTURA EXATA DO SEU EXEMPLO QUE FUNCIONA
    // ========================================
    const payload = {
      amount: amountInCents,
      paymentMethod: 'pix',
      customer: {
        name: nome,
        email: email || `${cpf.replace(/\D/g, '')}@regularizacao.com`,
        document: {
          type: 'cpf',
          number: cpf.replace(/\D/g, '')
        }
      },
      items: [
        {
          title: `Regularização CPF ${cpf}`,
          unitPrice: amountInCents,
          quantity: 1,
          tangible: false
        }
      ]
    };

    console.log('📤 Enviando para FuriaPay...');
    console.log('📦 Payload:', JSON.stringify(payload, null, 2));

    const auth = 'Basic ' + Buffer.from(`${AUTH_USER}:${AUTH_PASS}`).toString('base64');

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': auth,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    console.log('📥 Status HTTP:', response.status);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ ERRO DA FURIAPAY:');
      console.error(JSON.stringify(errorData, null, 2));
      
      return res.status(response.status).json({
        success: false,
        error: 'Erro ao gerar PIX',
        details: errorData
      });
    }

    const data = await response.json();
    console.log('✅ RESPOSTA DA FURIAPAY:');
    console.log(JSON.stringify(data, null, 2));

    // Extrair código PIX (formato do seu exemplo)
    let pixCode = null;
    let qrCodeImage = null;
    let transactionId = data.id || data.transaction_id || data.transactionId;

    if (data.pix && data.pix.qrcode) {
      pixCode = data.pix.qrcode;
      qrCodeImage = data.pix.qrCodeBase64 || data.pix.qrCodeUrl;
    } else if (data.pix && data.pix.code) {
      pixCode = data.pix.code;
      qrCodeImage = data.pix.qrCodeBase64 || data.pix.qrCodeUrl;
    }

    if (!pixCode) {
      console.error('❌ CÓDIGO PIX NÃO ENCONTRADO NA RESPOSTA');
      console.log('📋 Estrutura completa da resposta:');
      console.log(JSON.stringify(data, null, 2));
      
      return res.status(500).json({
        success: false,
        error: 'Código PIX não encontrado na resposta da FuriaPay',
        rawResponse: data
      });
    }

    // Armazenar transação em memória
    transactions.set(transactionId, {
      id: transactionId,
      valor: valor,
      cpf: cpf,
      nome: nome,
      status: data.status || 'pending',
      pixCode: pixCode,
      createdAt: new Date(),
      data: data
    });

    console.log('✅ PIX GERADO COM SUCESSO!');
    console.log('🆔 Transaction ID:', transactionId);
    console.log('🔐 Código PIX:', pixCode.substring(0, 50) + '...');
    console.log('💾 Transação armazenada em memória');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    res.json({
      success: true,
      transactionId: transactionId,
      pix: pixCode,
      qrcode: qrCodeImage,
      valor: valor,
      status: data.status || 'pending',
      rawResponse: data
    });

  } catch (err) {
    console.error('❌ ERRO FATAL:');
    console.error(err);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    res.status(500).json({ 
      success: false,
      error: "Erro ao gerar PIX",
      details: err.message 
    });
  }
});

// ========================================
// 🔥 ROTA 2: Verificar status do pagamento
// ========================================
app.get("/api/verificar-pagamento/:transactionId", async (req, res) => {
  try {
    const { transactionId } = req.params;
    
    console.log('🔍 Verificando pagamento:', transactionId);

    const localTransaction = transactions.get(transactionId);
    if (localTransaction) {
      console.log('📦 Transação encontrada em memória:', localTransaction.status);
    }

    const auth = 'Basic ' + Buffer.from(`${AUTH_USER}:${AUTH_PASS}`).toString('base64');

    const response = await fetch(`${API_URL}/${transactionId}`, {
      headers: {
        'Authorization': auth
      }
    });

    if (!response.ok) {
      console.error('❌ Erro ao verificar:', response.status);
      
      if (localTransaction) {
        return res.json({
          success: true,
          status: localTransaction.status,
          paid: localTransaction.status === 'paid' || localTransaction.status === 'approved',
          data: localTransaction.data
        });
      }
      
      throw new Error('Erro ao verificar pagamento');
    }

    const data = await response.json();
    const status = data.status || 'pending';
    const isPaid = status === 'paid' || status === 'approved' || status === 'completed';
    
    console.log('📊 Status atual:', status);
    console.log(isPaid ? '✅ PAGO' : '⏳ Aguardando');

    if (localTransaction) {
      localTransaction.status = status;
      localTransaction.data = data;
      transactions.set(transactionId, localTransaction);
    }

    res.json({
      success: true,
      status: status,
      paid: isPaid,
      data: data
    });

  } catch (err) {
    console.error('❌ Erro ao verificar:', err);
    res.status(500).json({ 
      success: false,
      error: "Erro ao verificar pagamento",
      details: err.message
    });
  }
});

// ========================================
// 🔥 ROTA 3: Webhook
// ========================================
app.post("/api/webhook", async (req, res) => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔔 WEBHOOK RECEBIDO');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(JSON.stringify(req.body, null, 2));
  
  const { event, data, type } = req.body;
  const eventType = event || type;
  
  if (eventType === 'payment.approved' || 
      eventType === 'transaction.paid' || 
      eventType === 'pix.paid') {
    
    console.log('✅ PAGAMENTO APROVADO!');
    console.log('🆔 ID:', data?.id || data?.transaction_id);
    
    const transactionId = data?.id || data?.transaction_id;
    if (transactionId && transactions.has(transactionId)) {
      const transaction = transactions.get(transactionId);
      transaction.status = 'paid';
      transaction.paidAt = new Date();
      transactions.set(transactionId, transaction);
      console.log('💾 Status atualizado em memória');
    }
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  res.json({ received: true });
});

// ========================================
// 🔥 ROTA 4: Listar transações
// ========================================
app.get("/api/transacoes", (req, res) => {
  const allTransactions = Array.from(transactions.values());
  console.log('📋 Listando transações:', allTransactions.length);
  
  res.json({
    success: true,
    total: allTransactions.length,
    transactions: allTransactions
  });
});

// ========================================
// 🔥 ROTA 5: Detalhes da transação
// ========================================
app.get("/api/transacao/:transactionId", (req, res) => {
  const { transactionId } = req.params;
  const transaction = transactions.get(transactionId);
  
  if (!transaction) {
    return res.status(404).json({
      success: false,
      error: 'Transação não encontrada'
    });
  }
  
  res.json({
    success: true,
    transaction: transaction
  });
});

// ========================================
// 🔥 ROTA 6: Health check
// ========================================
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    message: "Backend FuriaPay rodando!",
    timestamp: new Date().toISOString(),
    transactions: transactions.size,
    version: "2.0.0-WORKING"
  });
});

// ========================================
// 🔥 ROTA 7: Teste de conexão
// ========================================
app.get("/api/test-furiapay", async (req, res) => {
  try {
    console.log('🧪 Testando conexão com FuriaPay...');
    
    const auth = 'Basic ' + Buffer.from(`${AUTH_USER}:${AUTH_PASS}`).toString('base64');
    
    const response = await fetch(API_URL, {
      method: "GET",
      headers: {
        'Authorization': auth
      }
    });
    
    console.log('📡 Status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      res.json({
        success: true,
        message: 'Conexão com FuriaPay OK!',
        status: response.status,
        data: data
      });
    } else {
      const errorText = await response.text();
      res.json({
        success: false,
        message: 'Erro na conexão',
        status: response.status,
        error: errorText
      });
    }
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Erro ao conectar com FuriaPay',
      error: err.message
    });
  }
});

// ========================================
// ARMAZENAMENTO DE REGISTROS (EM MEMÓRIA)
// ========================================
let registros = [];

// ========================================
// ROTA: Salvar novo registro
// ========================================
app.post('/api/registros', (req, res) => {
    try {
        const registro = {
            id: Date.now().toString(),
            ...req.body,
            dataCriacao: new Date().toISOString()
        };
        
        registros.push(registro);
        
        console.log('✅ Registro salvo:', registro.cpf);
        console.log('📊 Total de registros:', registros.length);
        
        res.json({ 
            success: true, 
            registro,
            total: registros.length 
        });
    } catch (error) {
        console.error('❌ Erro ao salvar:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// ========================================
// ROTA: Buscar todos os registros
// ========================================
app.get('/api/registros', (req, res) => {
    console.log('📋 Listando registros:', registros.length);
    res.json({ 
        success: true, 
        registros,
        total: registros.length 
    });
});

// ========================================
// ROTA: Buscar registro por CPF
// ========================================
app.get('/api/registros/cpf/:cpf', (req, res) => {
    const cpf = req.params.cpf.replace(/\D/g, '');
    console.log('🔍 Buscando CPF:', cpf);
    
    const registro = registros.find(r => r.cpf === cpf);
    
    if (registro) {
        console.log('✅ CPF encontrado:', registro.nome);
        res.json({ success: true, registro });
    } else {
        console.log('❌ CPF não encontrado');
        res.status(404).json({ 
            success: false, 
            error: 'CPF não encontrado' 
        });
    }
});

// ========================================
// ROTA: Atualizar registro
// ========================================
app.put('/api/registros/:id', (req, res) => {
    const id = req.params.id;
    const index = registros.findIndex(r => r.id === id);
    
    if (index !== -1) {
        registros[index] = { 
            ...registros[index], 
            ...req.body,
            dataAtualizacao: new Date().toISOString()
        };
        console.log('✅ Registro atualizado:', id);
        res.json({ success: true, registro: registros[index] });
    } else {
        console.log('❌ Registro não encontrado:', id);
        res.status(404).json({ 
            success: false, 
            error: 'Registro não encontrado' 
        });
    }
});

// ========================================
// ROTA: Deletar registro
// ========================================
app.delete('/api/registros/:id', (req, res) => {
    const id = req.params.id;
    const antes = registros.length;
    registros = registros.filter(r => r.id !== id);
    
    if (registros.length < antes) {
        console.log('✅ Registro deletado:', id);
        res.json({ success: true, message: 'Registro deletado' });
    } else {
        console.log('❌ Registro não encontrado:', id);
        res.status(404).json({ 
            success: false, 
            error: 'Registro não encontrado' 
        });
    }
});

// ========================================
// 🚀 INICIAR SERVIDOR
// ========================================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.clear();
  console.log('\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔥     BACKEND FURIAPAY ONLINE! (ESTRUTURA CORRETA)    🔥');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(`🌐  Servidor rodando em: http://localhost:${PORT}`);
  console.log('');
  console.log('📡  ROTAS DISPONÍVEIS:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`   POST   http://localhost:${PORT}/api/gerar-pix`);
  console.log(`   GET    http://localhost:${PORT}/api/verificar-pagamento/:id`);
  console.log(`   POST   http://localhost:${PORT}/api/webhook`);
  console.log(`   GET    http://localhost:${PORT}/api/transacoes`);
  console.log(`   GET    http://localhost:${PORT}/api/transacao/:id`);
  console.log(`   GET    http://localhost:${PORT}/api/health`);
  console.log(`   GET    http://localhost:${PORT}/api/test-furiapay`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('✅  Usando estrutura do gateway.html que funciona!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});