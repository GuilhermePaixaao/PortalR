import * as evolutionService from '../services/evolutionService.js';

/**
 * Webhook: Recebe eventos (Mensagem, QR Code)
 */
export const handleWebhook = async (req, res) => {
  const payload = req.body;
  const io = req.io;

  try {
    // LOG PARA DEBUG: Ver o que está chegando
    // console.log('Payload recebido:', JSON.stringify(payload, null, 2));

    // Normaliza o evento para maiúsculo para evitar erros
    const eventType = payload.event ? payload.event.toUpperCase() : '';

    // 1. QR Code
    if (eventType === 'QRCODE_UPDATED' && payload.data?.qrcode?.base64) {
      console.log('[WEBHOOK] QR Code recebido.');
      io.emit('qrCodeRecebido', { qr: payload.data.qrcode.base64 });
      return res.status(200).json({ message: "QR Code recebido" });
    }
    
    // 2. Status de Conexão
    if (eventType === 'CONNECTION_UPDATE') {
      console.log(`[WEBHOOK] Status conexão: ${payload.data.status}`);
      io.emit('statusConexao', { status: payload.data.status });
      return res.status(200).json({ message: "Status recebido" });
    }

    // 3. Mensagens Recebidas (MESSAGES_UPSERT)
    if (eventType === 'MESSAGES_UPSERT') {
      
      // A estrutura da mensagem pode variar um pouco, vamos tentar pegar de forma segura
      const msgData = payload.data || payload.data?.data;
      
      // O ID de quem mandou (remoteJid)
      const idOrigem = msgData?.key?.remoteJid;
      
      // O nome de quem mandou
      const nomeAutor = msgData?.pushName || idOrigem;

      // O texto da mensagem (pode vir em conversation ou extendedTextMessage)
      const mensagem = 
        msgData?.message?.conversation || 
        msgData?.message?.extendedTextMessage?.text ||
        (msgData?.message?.imageMessage ? "Imagem recebida" : null);

      // Só emite se tiver ID e algum texto
      if (idOrigem && mensagem) {
        // Ignora mensagens de status (broadcast)
        if (idOrigem.includes('status@broadcast')) return res.status(200).end();

        console.log(`[WEBHOOK] Mensagem de ${nomeAutor}: ${mensagem}`);
        
        io.emit('novaMensagemWhatsapp', {
          de: idOrigem,
          nome: nomeAutor,
          texto: mensagem
        });
        return res.status(200).json({ success: true });
      }
    }

    res.status(200).json({ success: true });

  } catch (error) {
    console.error('Erro no webhook:', error);
    res.status(500).json({ success: false });
  }
};

/**
 * Botão Conectar
 */
export const connectInstance = async (req, res) => {
    try {
        const resultado = await evolutionService.criarInstancia(); 
        res.status(200).json({ success: true, message: "Solicitação enviada.", data: resultado });
    } catch (error) {
        console.error("Erro controller conectar:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Enviar Mensagem
 */
export const handleSendMessage = async (req, res) => {
  const { numero, mensagem } = req.body;
  if (!numero || !mensagem) return res.status(400).json({ message: 'Dados incompletos.' });

  try {
    const resultado = await evolutionService.enviarTexto(numero, mensagem);
    res.status(200).json({ success: true, data: resultado });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Verifica status ao carregar a página
 */
export const checarStatus = async (req, res) => {
  try {
    const resultado = await evolutionService.consultarStatus();
    res.status(200).json({ success: true, data: resultado });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Lista todas as conversas para o sidebar
 */
export const listarConversas = async (req, res) => {
  try {
    const chats = await evolutionService.buscarConversas();
    
    // Verificação de segurança se chats for undefined ou não for array
    if (!chats || !Array.isArray(chats)) {
        return res.status(200).json({ success: true, data: [] });
    }

    // Formata os dados para o frontend
    const conversasFormatadas = chats.map(chat => ({
      numero: chat.id,
      nome: chat.pushName || chat.name || chat.id.split('@')[0],
      ultimaMensagem: chat.conversation || "...",
      foto: chat.profilePictureUrl || null,
      unread: chat.unreadCount > 0
    }));

    res.status(200).json({ success: true, data: conversasFormatadas });
  } catch (error) {
    console.error("Erro ao listar conversas:", error);
    // Se der erro, retorna sucesso com lista vazia para não quebrar o front
    res.status(200).json({ success: true, data: [] });
  }
};

// --- CONFIGURAR WEBHOOK (COM HTTPS FORÇADO) ---
export const configurarUrlWebhook = async (req, res) => {
    try {
        const host = req.get('host');
        
        // Força HTTPS
        const fullUrl = `https://${host}/api/evolution/webhook`; 
        
        console.log(`Tentando configurar Webhook para: ${fullUrl}`);

        const resultado = await evolutionService.configurarWebhook(fullUrl);
        res.status(200).json({ success: true, message: `Webhook configurado para: ${fullUrl}`, data: resultado });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};