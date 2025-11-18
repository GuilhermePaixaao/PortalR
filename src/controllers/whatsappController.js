import * as evolutionService from '../services/evolutionService.js';

/**
 * Rota: POST /api/evolution/webhook
 * Recebe TODOS os eventos da Evolution API (Mensagens, QR Code, Status)
 */
export const handleWebhook = async (req, res) => {
  const payload = req.body;
  const io = req.io; // Pega o Socket.io (injetado no server.js)

  try {
    // --- 1. FILTRO DE QR CODE ---
    if (payload.event === 'qrcode.updated' && payload.data?.qrcode?.base64) {
      console.log('Webhook: QR Code recebido!');
      // Manda o QR Code para o frontend
      io.emit('qrCodeRecebido', { qr: payload.data.qrcode.base64 });
      return res.status(200).json({ message: "QR Code recebido" });
    }
    
    // --- 2. FILTRO DE CONEXÃO ---
    if (payload.event === 'connection.update') {
      console.log('Webhook: Status da conexão mudou:', payload.data.status);
      // Manda o status para o frontend
      io.emit('statusConexao', { status: payload.data.status });
      return res.status(200).json({ message: "Status recebido" });
    }

    // --- 3. FILTRO DE MENSAGEM (O MAIS IMPORTANTE) ---
    if (payload.event === 'messages.upsert' && payload.data?.message) {
      const idOrigem = payload.data?.key?.remoteJid; // 55...@s.whatsapp.net ou 123...@g.us
      const nomeAutor = payload.data?.pushName;
      
      // Tenta pegar a mensagem de texto (seja simples ou estendida)
      const mensagem = payload.data?.message?.conversation || payload.data?.message?.extendedTextMessage?.text;

      if (!idOrigem || !mensagem) {
        return res.status(200).json({ message: 'Payload recebido, mas não é uma mensagem de texto.' });
      }

      console.log(`Webhook: Mensagem recebida de ${nomeAutor} (${idOrigem}): ${mensagem}`);

      // Manda a mensagem para TODOS os painéis de Help Desk abertos
      io.emit('novaMensagemWhatsapp', {
        de: idOrigem,
        nome: nomeAutor || idOrigem,
        texto: mensagem
      });

      // (Aqui você pode salvar a 'mensagem' no seu banco de dados)
      
      return res.status(200).json({ success: true, message: "Mensagem recebida." });
    }

    // Se for qualquer outro evento (status de lido, etc.), só ignora e responde OK
    res.status(200).json({ success: true, message: "Webhook processado." });

  } catch (error) {
    console.error('Erro no webhook do WhatsApp:', error);
    res.status(500).json({ success: false, message: 'Erro interno no webhook.' });
  }
};

/**
 * Rota: GET /api/whatsapp/connect
 * Chamado pelo botão "Conectar" do seu PortalR.
 */
export const connectInstance = async (req, res) => {
    try {
        // VOLTAMOS PARA 'CRIAR'
        // A função criarInstancia do seu service já é inteligente:
        // Se não existir -> Cria.
        // Se já existir -> Apenas conecta.
        const resultado = await evolutionService.criarInstancia(); 
        
        res.status(200).json({ 
            success: true, 
            message: "Pedido de conexão enviado. Aguarde o QR Code...",
            data: resultado
        });
        
    } catch (error) {
        console.error("Erro ao conectar:", error);
        res.status(500).json({ success: false, message: error.message || "Erro ao conectar." });
    }
};

/**
 * Rota: POST /api/whatsapp/send
 * Chamado pelo seu PortalR para ENVIAR uma resposta.
 */
export const handleSendMessage = async (req, res) => {
  const { numero, mensagem } = req.body;

  if (!numero || !mensagem) {
    return res.status(400).json({ success: false, message: 'Número e mensagem são obrigatórios.' });
  }

  try {
    // Chama o serviço que fala com a Evolution API
    const resultado = await evolutionService.enviarTexto(numero, mensagem);
    
    // (Opcional: Salvar a resposta do Help Desk no seu banco)

    res.status(200).json({ success: true, data: resultado });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};