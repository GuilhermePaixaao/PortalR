import { Router } from 'express';
import multer from 'multer'; // Importa o multer para upload de ficheiros
import * as ChamadoController from '../controllers/chamadoController.js';

// Configuração do Multer
// 'memoryStorage' armazena os ficheiros temporariamente na RAM
const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

// ====================================================
// ROTAS DA API DE CHAMADOS
// ====================================================

// POST /chamados (CRIAR)
// Usa o 'upload.array('anexos')' para processar o FormData
// 'anexos' deve ser o 'name' do seu <input type="file">
router.post(
    '/chamados', 
    upload.array('anexos'), // Middleware do Multer
    ChamadoController.criarChamado
);

// GET /chamados (LISTAR com filtros)
router.get('/chamados', ChamadoController.listarChamados);

// --- (NOVAS ROTAS PARA O MODAL 👁️) ---

// GET /chamados/:id (BUSCAR UM)
// Usado para abrir o modal de detalhes
router.get('/chamados/:id', ChamadoController.buscarChamadoPorId);

// PATCH /chamados/:id/prioridade (ATUALIZAR PRIORIDADE)
// Usado pelo <select> de prioridade no modal
router.patch('/chamados/:id/prioridade', ChamadoController.atualizarPrioridade);

// --- (ROTAS EXISTENTES) ---

// DELETE /chamados/:id (DELETAR)
router.delete('/chamados/:id', ChamadoController.deletarChamado);

// PATCH /chamados/:id/status (ATUALIZAR STATUS)
// Usado pelo botão ✔️ E pelo <select> de status no modal
router.patch('/chamados/:id/status', ChamadoController.atualizarStatus);

export default router;

