import * as evolutionService from '../services/evolutionService.js';

/**
 * Webhook: Recebe eventos (Mensagem, QR Code)
 */
export const handleWebhook = async (req, res) => {
  const payload = req.body;
  const io = req.io;

  try {
    // 1. QR Code
    if (payload.event === 'qrcode.updated' && payload.data?.qrcode?.base64) {
      io.emit('qrCodeRecebido', { qr: payload.data.qrcode.base64 });
      return res.status(200).json({ message: "QR Code recebido" });
    }
    
    // 2. Status de Conexão
    if (payload.event === 'connection.update') {
      io.emit('statusConexao', { status: payload.data.status });
      return res.status(200).json({ message: "Status recebido" });
    }

    // 3. Mensagens Recebidas
    if (payload.event === 'messages.upsert' && payload.data?.message) {
      const idOrigem = payload.data?.key?.remoteJid;
      const nomeAutor = payload.data?.pushName;
      const mensagem = payload.data?.message?.conversation || payload.data?.message?.extendedTextMessage?.text;

      if (idOrigem && mensagem) {
        io.emit('novaMensagemWhatsapp', {
          de: idOrigem,
          nome: nomeAutor || idOrigem,
          texto: mensagem
        });
        return res.status(200).json({ success: true, message: "Mensagem recebida." });
      }
    }

    res.status(200).json({ success: true });

  } catch (error) {
    console.error('Erro no webhook:', error);
    res.status(500).json({ success: false });
  }
};

/**
 * Botão Conectar: Tenta Criar ou Conectar
 */
export const connectInstance = async (req, res) => {
    try {
        // Usa criarInstancia pois ela trata o erro "já existe" automaticamente
        const resultado = await evolutionService.criarInstancia(); 
        
        res.status(200).json({ 
            success: true, 
            message: "Solicitação enviada.",
            data: resultado
        });
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
 * (NOVO) Verifica status ao carregar a página
 */
export const checarStatus = async (req, res) => {
  try {
    const resultado = await evolutionService.consultarStatus();
    res.status(200).json({ success: true, data: resultado });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};