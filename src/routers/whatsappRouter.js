import { Router } from 'express';
import * as WhatsappController from '../controllers/whatsappController.js';

const router = Router();

// Webhook (Evolution chama isso)
router.post('/api/evolution/webhook', WhatsappController.handleWebhook);

// Frontend chama isso para conectar/gerar QR
router.get('/api/whatsapp/connect', WhatsappController.connectInstance);

// Frontend chama isso para enviar msg
router.post('/api/whatsapp/send', WhatsappController.handleSendMessage);

// Frontend chama isso para ver se já está conectado
router.get('/api/whatsapp/status', WhatsappController.checarStatus);

// Rota para listar conversas
router.get('/api/whatsapp/chats', WhatsappController.listarConversas);

// === CORREÇÃO AQUI: ADICIONADAS AS ROTAS QUE FALTAVAM ===
// Rota para o agente assumir o chamado
router.post('/api/whatsapp/atender', WhatsappController.atenderAtendimento);

// Rota para finalizar atendimento
router.post('/api/whatsapp/finalizar', WhatsappController.finalizarAtendimento);
// =========================================================

// Rota para forçar a configuração do Webhook
router.get('/api/whatsapp/configure-webhook', WhatsappController.configurarUrlWebhook);

export default router;