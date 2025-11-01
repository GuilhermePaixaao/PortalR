import { Router } from 'express';
import * as ChamadoController from '../controllers/chamadoController.js';

const router = Router();

router.post('/chamados', ChamadoController.criarChamado);
router.get('/chamados', ChamadoController.listarChamados);
router.delete('/chamados/:id', ChamadoController.deletarChamado);
router.patch('/chamados/:id/status', ChamadoController.atualizarStatus);
export default router;