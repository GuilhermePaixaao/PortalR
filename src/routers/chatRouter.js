// Arquivo: chamadoRoutes.js (ou onde suas rotas estão)

import { Router } from 'express';
import * as ChamadoController from '../controllers/chamadoController.js';
import multer from 'multer'; // 1. Importe o multer

const router = Router();
const upload = multer(); // 2. Inicialize o multer (configuração básica)

// 3. Aplique o multer na rota de criação.
// Usamos .fields() para aceitar os campos "chamado" (texto) e "anexos" (arquivos)
router.post(
    '/chamados', 
    upload.fields([
        { name: 'chamado', maxCount: 1 },
        { name: 'anexos' } // Aceita múltiplos arquivos no campo 'anexos'
    ]), 
    ChamadoController.criarChamado
);

router.get('/chamados', ChamadoController.listarChamados);
router.delete('/chamados/:id', ChamadoController.deletarChamado);
router.patch('/chamados/:id/status', ChamadoController.atualizarStatus);

export default router;