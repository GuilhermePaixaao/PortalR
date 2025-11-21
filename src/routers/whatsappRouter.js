import { Router } from 'express';
import * as WhatsappController from '../controllers/whatsappController.js';

const router = Router();

// Webhook
router.post('/api/evolution/webhook', WhatsappController.handleWebhook);

// Conexão e Status
router.get('/api/whatsapp/connect', WhatsappController.connectInstance);
router.get('/api/whatsapp/status', WhatsappController.checarStatus);
router.get('/api/whatsapp/configure-webhook', WhatsappController.configurarUrlWebhook);

// Chats
router.get('/api/whatsapp/chats', WhatsappController.listarConversas);

// Envio de Mensagem (Controller atualizado com assinatura)
router.post('/api/whatsapp/send', WhatsappController.handleSendMessage);

// NOVAS ROTAS DE ATENDIMENTO
router.post('/api/whatsapp/atender', WhatsappController.atenderAtendimento);
router.post('/api/whatsapp/finalizar', WhatsappController.finalizarAtendimento);

export default router;