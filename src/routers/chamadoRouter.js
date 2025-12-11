// src/routers/chamadoRouter.js

import { Router } from 'express';
import multer from 'multer'; 

import * as ChamadoController from '../controllers/chamadoController.js';
import { addComentario, listarComentariosPorChamado } from '../controllers/comentarioController.js'; 

const upload = multer();
const router = Router();

// ====================================================
// ======== ROTAS DE CHAMADOS ========
// ====================================================

// POST /chamados (Criar Chamado)
router.post('/chamados', upload.array('anexos'), ChamadoController.criarChamado);

// GET /chamados (Listar todos os chamados com filtros)
router.get('/chamados', ChamadoController.listarChamados);

// --- ROTAS DE DADOS AUXILIARES (CASCATA LOJA/DEPTO) ---
// (Importante: Definir antes de /chamados/:id para evitar conflito de rota)
router.get('/chamados/dados/lojas', ChamadoController.listarLojas);
router.get('/chamados/dados/lojas/:lojaId/departamentos', ChamadoController.listarDepartamentosDaLoja);

// --- ROTAS DE CONTAGEM ---
// GET /chamados/contagem (Contagem de chamados por status)
router.get('/chamados/contagem', ChamadoController.contarChamadosPorStatus);

// --- ROTAS COM PARÂMETRO ID (MENOS ESPECÍFICA) ---
// GET /chamados/:id (Buscar um chamado específico)
router.get('/chamados/:id', ChamadoController.buscarChamadoPorId); 

// PATCH /chamados/:id/prioridade (Atualizar só a prioridade)
router.patch('/chamados/:id/prioridade', ChamadoController.atualizarPrioridade);

// PATCH /chamados/:id/status (Atualizar só o status)
router.patch('/chamados/:id/status', ChamadoController.atualizarStatus);

// PATCH /chamados/:id/atendente (Atualizar só o operador/atendente)
router.patch('/chamados/:id/atendente', ChamadoController.atualizarAtendente);

// (NOVO) PUT /chamados/:id/categoria (Atualizar a categoria)
// Usamos PUT aqui para alinhar com o código do Frontend gerado anteriormente
router.put('/chamados/:id/categoria', ChamadoController.atualizarCategoria);

// DELETE /chamados/:id (Deletar um chamado)
router.delete('/chamados/:id', ChamadoController.deletarChamado);


// ====================================================
// ======== ROTAS DE COMENTÁRIOS ========
// ====================================================

router.post('/chamados/:id/comentarios', addComentario);
router.get('/chamados/:id/comentarios', listarComentariosPorChamado);


// Adicione estas linhas junto com as outras rotas PATCH/PUT
router.patch('/chamados/:id/assunto', ChamadoController.atualizarAssunto);
router.patch('/chamados/:id/descricao', ChamadoController.atualizarDescricao);
router.patch('/chamados/:id/requisitante', ChamadoController.atualizarRequisitante);
router.patch('/chamados/:id/loja-departamento', ChamadoController.atualizarLojaDepartamento);
export default router;