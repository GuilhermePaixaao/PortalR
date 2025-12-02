import { Router } from 'express';
import * as CategoriaController from '../controllers/categoriaController.js';

const router = Router();

// Adicionado o prefixo '/api' para alinhar com o frontend
router.get('/api/categorias', CategoriaController.listarCategorias);
router.post('/api/categorias', CategoriaController.criarCategoria); 
router.put('/api/categorias/:id', CategoriaController.atualizarCategoria); 
router.delete('/api/categorias/:id', CategoriaController.excluirCategoria); 

export default router;