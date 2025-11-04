import { Router } from 'express';
import multer from 'multer'; // 1. Importar o multer
import * as ChamadoController from '../controllers/chamadoController.js';

// 2. Inicializar o multer (configuração básica de memória)
// Isto irá processar 'multipart/form-data' e preencher o req.body e req.files
const upload = multer();
const router = Router();

// ====================================================
// ======== ROTAS DE CHAMADOS ========
// ====================================================

// Rota de CRIAR (POST): Usa multer para processar FormData (anexos)
// O seu frontend (Chamado.html) envia os ficheiros no campo 'anexos'
router.post(
    '/chamados', 
    upload.array('anexos'), // 3. Aplicar o middleware do multer aqui
    ChamadoController.criarChamado
);

// Rota de LISTAR (GET): Usada pelo GerenciarChamados.html e Chamado.html
router.get('/chamados', ChamadoController.listarChamados);

// (NOVA ROTA) Rota de BUSCAR POR ID (GET): Usada pelo modal 👁️ do GerenciarChamados.html
router.get('/chamados/:id', ChamadoController.buscarChamadoPorId);

// Rota de ATUALIZAR STATUS (PATCH): Usada pelo botão ✔️ e pelo modal
router.patch('/chamados/:id/status', ChamadoController.atualizarStatus);

// (NOVA ROTA) Rota de ATUALIZAR PRIORIDADE (PATCH): Usada pelo modal
router.patch('/chamados/:id/prioridade', ChamadoController.atualizarPrioridade);

// Rota de DELETAR (DELETE): (Do seu controller original)
router.delete('/chamados/:id', ChamadoController.deletarChamado);

export default router;