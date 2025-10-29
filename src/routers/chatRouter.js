import express from 'express';
// Importa a função 'handleChat' especificamente do controller
import { handleChat } from '../controllers/chatController.js';

const router = express.Router();

// Define a rota POST para /
// (Ela vai virar /api/chat no seu roteador principal, o index.js)
router.post('/', handleChat);

// Usa 'export default' para exportar o roteador
export default router;