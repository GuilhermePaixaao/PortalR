import { Router } from 'express';
import * as WhatsappController from '../controllers/whatsappController.js';

const router = Router();

// Webhook (Evolution chama isso)
router.post('/api/evolution/webhook', WhatsappController.handleWebhook);

// Frontend chama isso para conectar/gerar QR
router.get('/api/whatsapp/connect', WhatsappController.connectInstance);

// Frontend chama isso para enviar msg
router.post('/api/whatsapp/send', WhatsappController.handleSendMessage);

// (NOVO) Frontend chama isso para ver se já está conectado
router.get('/api/whatsapp/status', WhatsappController.checarStatus);

// ... rotas anteriores ...
router.get('/api/whatsapp/status', WhatsappController.checarStatus);

// NOVA ROTA DE CHATS
router.get('/api/whatsapp/chats', WhatsappController.listarConversas);

export default router;