import { Router } from 'express';

// CORREÇÃO AQUI:
// O nome do arquivo do controller é 'subCategoriaController.js' (com 'C' maiúsculo)
import * as SubcategoriaController from '../controllers/subCategoriaController.js';

const router = Router();

router.get('/subcategorias', SubcategoriaController.listarSubcategorias);
router.post('/subcategorias', SubcategoriaController.criarSubcategoria);
router.put('/subcategorias/:id', SubcategoriaController.atualizarSubcategoria);
router.delete('/subcategorias/:id', SubcategoriaController.excluirSubcategoria);

export default router;