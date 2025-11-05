import { Router } from 'express';
import * as CategoriaController from '../controllers/categoriaController.js';

const router = Router();

router.get('/categorias', CategoriaController.listarCategorias);
router.post('/categorias', CategoriaController.criarCategoria); 
export default router;