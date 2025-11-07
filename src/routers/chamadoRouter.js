import { Router } from 'express';
import multer from 'multer'; // 1. Importar o multer
import * as ChamadoController from '../controllers/chamadoController.js';

// --- IMPORTAÇÃO ADICIONADA E CORRIGIDA ---
// Importa as DUAS funções necessárias do controller de comentários
import { addComentario, listarComentariosPorChamado } from '../controllers/comentarioController.js'; // Ajuste o caminho se necessário

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

// --- (ROTAS ANTIGAS) ---

// PATCH /chamados/:id/status (Atualizar só o status)
router.patch('/chamados/:id/status', ChamadoController.atualizarStatus);

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