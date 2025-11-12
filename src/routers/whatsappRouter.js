// src/routers/whatsappRouter.js
import { Router } from 'express';
// (NOVO) Importa todas as funções
import { getStatus, getChats, getMessagesForChat, sendMessageToChat } from '../controllers/whatsappController.js';

const router = Router();

// Rota para a página de conexão
router.get('/whatsapp/status', getStatus);

// Rota para a lista de chats
router.get('/whatsapp/chats', getChats);

// (NOVO) Rota para buscar mensagens de UM chat
router.get('/whatsapp/messages/:chatId', getMessagesForChat);

// (NOVO) Rota para ENVIAR uma mensagem
router.post('/whatsapp/send', sendMessageToChat);

export default router;