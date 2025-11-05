// /routers/subCategoriaRouter.js
import { Router } from 'express';
// Lembre-se de usar o 'C' maiúsculo para bater com o nome do arquivo
import * as SubcategoriaController from '../controllers/subcategoriaController.js';

const router = Router();

router.get('/subcategorias', SubcategoriaController.listarSubcategorias);
router.post('/subcategorias', SubcategoriaController.criarSubcategoria);
router.put('/subcategorias/:id', SubcategoriaController.atualizarSubcategoria);
router.delete('/subcategorias/:id', SubcategoriaController.excluirSubcategoria);

export default router;