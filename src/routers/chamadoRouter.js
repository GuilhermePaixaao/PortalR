import { Router } from 'express';
import multer from 'multer'; // 1. IMPORTE O MULTER
import * as ChamadoController from '../controllers/chamadoController.js';

// 2. INICIALIZE O MULTER
const upload = multer();
const router = Router();

// 3. APLIQUE O MIDDLEWARE 'upload' NA ROTA POST
router.post(
    '/chamados', 
    upload.array('anexos'), // <-- ADICIONE ISTO
    ChamadoController.criarChamado
);

router.get('/chamados', ChamadoController.listarChamados);
router.delete('/chamados/:id', ChamadoController.deletarChamado);
router.patch('/chamados/:id/status', ChamadoController.atualizarStatus);

export default router;
