import express from 'express';
// Importa o *controller* (com chaves {})
import { handleChat } from '../controllers/chatController.js';

const router = express.Router();

// A rota é '/', pois o prefixo '/api/chat' já foi definido no index.js
router.post('/', handleChat);

// A linha mais importante para corrigir seu erro:
export default router;