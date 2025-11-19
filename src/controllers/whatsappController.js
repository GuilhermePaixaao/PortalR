import * as evolutionService from '../services/evolutionService.js';

export const handleWebhook = async (req, res) => {
  const payload = req.body;
  const io = req.io;

  // LOG DE DEPURAÇÃO: Para confirmar que a Evolution bateu aqui
  console.log(`[WEBHOOK RECEBIDO] Evento: ${payload.event}`);

  try {
    // 1. QR Code
    if (payload.event === 'qrcode.updated' && payload.data?.qrcode?.base64) {
      io.emit('qrCodeRecebido', { qr: payload.data.qrcode.base64 });
    }
    
    // 2. Status de Conexão
    if (payload.event === 'connection.update') {
      io.emit('statusConexao', { status: payload.data.status });
    }

    // 3. Mensagens Recebidas
    if (payload.event === 'messages.upsert' && payload.data?.message) {
      const idOrigem = payload.data?.key?.remoteJid;
      const nomeAutor = payload.data?.pushName;
      const mensagem = payload.data?.message?.conversation || payload.data?.message?.extendedTextMessage?.text;

      if (idOrigem && mensagem) {
        console.log(`[MENSAGEM] De: ${idOrigem} - Texto: ${mensagem}`);
        io.emit('novaMensagemWhatsapp', {
          de: idOrigem,
          nome: nomeAutor || idOrigem,
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

// --- NOVA FUNÇÃO PARA CONFIGURAR ---
export const configurarUrlWebhook = async (req, res) => {
    try {
        // Pega o domínio atual automaticamente (ex: https://meu-app.railway.app)
        const protocolo = req.protocol;
        const host = req.get('host');
        const fullUrl = `${protocolo}://${host}/api/evolution/webhook`;
        
        console.log(`Tentando configurar Webhook para: ${fullUrl}`);

        const resultado = await evolutionService.configurarWebhook(fullUrl);
        res.status(200).json({ success: true, message: `Webhook configurado para: ${fullUrl}`, data: resultado });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};