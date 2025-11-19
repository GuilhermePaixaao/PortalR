import * as evolutionService from '../services/evolutionService.js';

export const handleWebhook = async (req, res) => {
  const payload = req.body;
  const io = req.io;

  // LOG DE DEPURAÇÃO
  // console.log(`[WEBHOOK RECEBIDO] Evento: ${payload.event}`);

  try {
    // 1. QR Code
    if (payload.event === 'qrcode.updated' && payload.data?.qrcode?.base64) {
      io.emit('qrCodeRecebido', { qr: payload.data.qrcode.base64 });
    }
    
    // 2. Status de Conexão
    if (payload.event === 'connection.update') {
      io.emit('statusConexao', { status: payload.data.status });
    }

    // 3. Mensagens Recebidas (A CORREÇÃO PRINCIPAL É AQUI)
    if (payload.event === 'messages.upsert' && payload.data?.message) {
      const messageData = payload.data;
      const key = messageData.key;
      
      const idRemoto = key.remoteJid; // Quem é o dono da conversa (o número do cliente)
      const isFromMe = key.fromMe;    // TRUE se fui EU que enviei, FALSE se foi o cliente
      const nomeAutor = messageData.pushName || messageData.verifiedBizName || idRemoto;
      
      // Extrai o texto (suporta texto simples e extended)
      const mensagem = messageData.message?.conversation || 
                       messageData.message?.extendedTextMessage?.text;

      // --- FILTRO: Ignora Status/Stories e mensagens vazias ---
      if (idRemoto === 'status@broadcast') {
          // Ignora atualizações de status
          return res.status(200).json({ success: true });
      }

      if (idRemoto && mensagem) {
        console.log(`[MSG] Chat: ${idRemoto} | Enviado por mim? ${isFromMe} | Texto: ${mensagem}`);
        
        // Envia para o Frontend com a flag 'fromMe' correta
        io.emit('novaMensagemWhatsapp', {
          chatId: idRemoto, // Identificador da conversa
          nome: nomeAutor,
          texto: mensagem,
          fromMe: isFromMe  // <--- IMPORTANTE: Avisa o front quem mandou
        });
      }
    }

    res.status(200).json({ success: true });

  } catch (error) {
    console.error('Erro no webhook:', error);
    res.status(500).json({ success: false });
  }
};

// ... (Mantenha as outras funções: connectInstance, handleSendMessage, etc. iguais)
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

export const listarConversas = async (req, res) => {
  try {
    const chats = await evolutionService.buscarConversas();
    const conversasFormatadas = chats.map(chat => ({
      numero: chat.id,
      nome: chat.pushName || chat.name || chat.id.split('@')[0],
      ultimaMensagem: chat.conversation || "...",
      unread: chat.unreadCount > 0
    }));
    res.status(200).json({ success: true, data: conversasFormatadas });
  } catch (error) {
    res.status(200).json({ success: true, data: [] });
  }
};

export const configurarUrlWebhook = async (req, res) => {
    try {
        const host = req.get('host');
        const fullUrl = `https://${host}/api/evolution/webhook`; 
        console.log(`Tentando configurar Webhook para: ${fullUrl}`);
        const resultado = await evolutionService.configurarWebhook(fullUrl);
        res.status(200).json({ success: true, message: `Webhook configurado para: ${fullUrl}`, data: resultado });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};