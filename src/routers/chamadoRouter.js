import { Router } from 'express';
import multer from 'multer'; // 1. Importar o multer

// --- IMPORTAÇÃO MODIFICADA ---
import * as ChamadoController from '../controllers/chamadoController.js';
// Adiciona 'atualizarAtendente' à lista de importações
import { addComentario, listarComentariosPorChamado } from '../controllers/comentarioController.js'; 

// 2. Inicializar o multer (para lidar com uploads de ficheiros)
const upload = multer();
const router = Router();

// ====================================================
// ======== ROTAS DE CHAMADOS ========
// ====================================================

// POST /chamados (Criar Chamado)
// Usamos o upload.array('anexos') para processar o FormData
router.post('/chamados', upload.array('anexos'), ChamadoController.criarChamado);

// GET /chamados (Listar todos os chamados com filtros)
router.get('/chamados', ChamadoController.listarChamados);

// --- (NOVAS ROTAS PARA O MODAL 👁️) ---

// GET /chamados/:id (Buscar um chamado específico)
router.get('/chamados/:id', ChamadoController.buscarChamadoPorId);

// PATCH /chamados/:id/prioridade (Atualizar só a prioridade)
router.patch('/chamados/:id/prioridade', ChamadoController.atualizarPrioridade);

// PATCH /chamados/:id/status (Atualizar só o status)
router.patch('/chamados/:id/status', ChamadoController.atualizarStatus);

// --- (NOVA ROTA ADICIONADA) ---
// PATCH /chamados/:id/atendente (Atualizar só o operador/atendente)
router.patch('/chamados/:id/atendente', ChamadoController.atualizarAtendente);

// --- (NOVA ROTA PARA O DASHBOARD) ---
// GET /chamados/contagem (Contagem de chamados por status)
router.get('/chamados/contagem', ChamadoController.contarChamadosPorStatus);

// --- (ROTAS ANTIGAS) ---

// DELETE /chamados/:id (Deletar um chamado)
router.delete('/chamados/:id', ChamadoController.deletarChamado);


// ====================================================
// ======== ROTAS DE COMENTÁRIOS ========
// ====================================================

/**
 * ROTA ADICIONADA: POST /chamados/:id/comentarios
 * Cria um novo comentário vinculado ao chamado_id (que vem do :id da URL)
 */
router.post('/chamados/:id/comentarios', addComentario);

/**
 * (NOVA ROTA) Rota GET para LISTAR os comentários de um chamado
 */
router.get('/chamados/:id/comentarios', listarComentariosPorChamado);


export default router;