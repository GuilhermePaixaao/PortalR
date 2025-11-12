// src/routers/whatsappRouter.js
import { Router } from 'express';
// (NOVO) Importa as duas funções
import { getStatus, getChats } from '../controllers/whatsappController.js';

const router = Router();

// Rota que o frontend vai chamar para pegar o QR Code
router.get('/whatsapp/status', getStatus);

// (NOVO) Rota para o frontend pegar a lista de chats
router.get('/whatsapp/chats', getChats);

export default router;