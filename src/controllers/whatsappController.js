import * as evolutionService from '../services/evolutionService.js';

/**
 * Webhook: Recebe eventos (Mensagem, QR Code)
 */
export const handleWebhook = async (req, res) => {
  const payload = req.body;
  const io = req.io;

  try {
    const eventType = payload.event ? payload.event.toUpperCase() : '';

    // 1. QR Code
    if (eventType === 'QRCODE_UPDATED' && payload.data?.qrcode?.base64) {
      io.emit('qrCodeRecebido', { qr: payload.data.qrcode.base64 });
      return res.status(200).json({ message: "QR Code recebido" });
    }
    
    // 2. Status de Conexão
    if (eventType === 'CONNECTION_UPDATE') {
      io.emit('statusConexao', { status: payload.data.status });
      return res.status(200).json({ message: "Status recebido" });
    }

    // 3. Mensagens Recebidas
    if (eventType === 'MESSAGES_UPSERT') {
      const msgData = payload.data || payload.data?.data;
      const idOrigem = msgData?.key?.remoteJid;
      const nomeAutor = msgData?.pushName || idOrigem;
      
      const mensagem = 
        msgData?.message?.conversation || 
        msgData?.message?.extendedTextMessage?.text ||
        (msgData?.message?.imageMessage ? "Imagem recebida" : null);

      if (idOrigem && mensagem) {
        if (idOrigem.includes('status@broadcast')) return res.status(200).end();

        io.emit('novaMensagemWhatsapp', {
          de: idOrigem,
          nome: nomeAutor,
          texto: mensagem
        });
      }
    }
    res.status(200).json({ success: true });

  } catch (error) {
    console.error('Erro no webhook:', error);
    res.status(500).json({ success: false });
  }
};

export const connectInstance = async (req, res) => {
    try {
        const resultado = await evolutionService.criarInstancia(); 
        res.status(200).json({ success: true, message: "Solicitação enviada.", data: resultado });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const handleSendMessage = async (req, res) => {
  const { numero, mensagem } = req.body;
  try {
    const resultado = await evolutionService.enviarTexto(numero, mensagem);
    res.status(200).json({ success: true, data: resultado });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const checarStatus = async (req, res) => {
  try {
    const resultado = await evolutionService.consultarStatus();
    res.status(200).json({ success: true, data: resultado });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Lista todas as conversas (VERSÃO SEGURA)
 */
export const listarConversas = async (req, res) => {
  try {
    const resultadoAPI = await evolutionService.buscarConversas();
    
    let chats = [];
    if (Array.isArray(resultadoAPI)) {
        chats = resultadoAPI;
    } else if (resultadoAPI && Array.isArray(resultadoAPI.data)) {
        chats = resultadoAPI.data;
    }

    const conversasFormatadas = chats.map(chat => {
      const id = chat.id || chat.key?.remoteJid;
      
      if (!id) return null; // Pula itens inválidos

      return {
        numero: id,
        nome: chat.pushName || chat.name || chat.verifiedName || id.split('@')[0],
        ultimaMensagem: chat.conversation || chat.lastMessage?.conversation || chat.lastMessage?.extendedTextMessage?.text || "...",
        foto: chat.profilePictureUrl || null,
        unread: chat.unreadCount > 0
      };
    }).filter(item => item !== null);

    res.status(200).json({ success: true, data: conversasFormatadas });
  } catch (error) {
    console.error("Erro ao listar conversas:", error);
    res.status(200).json({ success: true, data: [] });
  }
};

export const configurarUrlWebhook = async (req, res) => {
    try {
        const host = req.get('host');
        // Força HTTPS para evitar erros de redirecionamento
        const fullUrl = `https://${host}/api/evolution/webhook`; 
        
        const resultado = await evolutionService.configurarWebhook(fullUrl);
        res.status(200).json({ success: true, message: `Webhook configurado para: ${fullUrl}`, data: resultado });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};