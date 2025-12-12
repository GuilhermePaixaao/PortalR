import express from 'express';
import { 
    handleWebhook, 
    handleSendMessage, 
    enviarMidiaController,
    listarConversas, 
    listarMensagensChat, // <--- Importante estar aqui
    atenderAtendimento,
    finalizarAtendimento,
    transferirAtendimento,
    verificarTicket,
    criarChamadoDoChat,
    handleDisconnect,
    connectInstance,
    checarStatus,
    configurarUrlWebhook,
    listarContatos,        // <--- NOVO
    enviarMensagemPronta   // <--- NOVO
} from '../controllers/whatsappController.js';

const router = express.Router();

// Rotas Webhook e Mensagens
router.post('/webhook', (req, res) => {
    const io = req.app.get('socketio');
    req.io = io;
    handleWebhook(req, res);
});

router.post('/send', handleSendMessage);
router.post('/send-media', enviarMidiaController);

// Rotas de Listagem
router.get('/chats', listarConversas);
router.post('/messages', listarMensagensChat); // <--- A rota que estava dando 403 usa isso

// Rotas de Atendimento
router.post('/atender', (req, res) => {
    req.io = req.app.get('socketio');
    atenderAtendimento(req, res);
});

router.post('/finalizar', finalizarAtendimento);

router.post('/transferir', (req, res) => {
    req.io = req.app.get('socketio');
    transferirAtendimento(req, res);
});

// Rotas de Ticket
router.post('/ticket/verificar', verificarTicket);
router.post('/ticket/criar', (req, res) => {
    req.io = req.app.get('socketio');
    criarChamadoDoChat(req, res);
});

// Rotas de Conexão/Instância
router.post('/disconnect', handleDisconnect);
router.get('/connect', connectInstance);
router.get('/status', checarStatus);
router.get('/configure-webhook', configurarUrlWebhook);

// ============================================================
// [NOVAS ROTAS] - Adicionadas para a Lista de Contatos
// ============================================================
router.get('/contacts', listarContatos); 

router.post('/send-template', (req, res) => {
    req.io = req.app.get('socketio'); 
    enviarMensagemPronta(req, res);
});

export default router;