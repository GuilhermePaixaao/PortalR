import { Router } from 'express';
import * as WhatsappController from '../controllers/whatsappController.js';

const router = Router();

// Rota que o frontend vai chamar para pegar o QR Code
router.get('/whatsapp/status', WhatsappController.getStatus);

export default router;