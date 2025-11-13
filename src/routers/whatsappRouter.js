import { Router } from 'express';
import * as WhatsappController from '../controllers/whatsappController.js';

const router = Router();

// Rota que a EVOLUTION API vai chamar (Webhook)
router.post('/api/evolution/webhook', WhatsappController.handleWebhook);

// Rota que o SEU PORTAL vai chamar para CONECTAR
router.get('/api/whatsapp/connect', WhatsappController.connectInstance);

// Rota que o SEU PORTAL vai chamar para ENVIAR MENSAGEM
router.post('/api/whatsapp/send', WhatsappController.handleSendMessage);

export default router;