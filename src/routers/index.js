import { Router } from 'express';

// 1. Importe os routers que você já tem
import categoriaRouter from './categoriaRouter.js';
import funcionarioRouter from './funcionarioRouter.js'; 
import chamadoRouter from './chamadoRouter.js';
import subCategoriaRouter from './subcategoriaRouter.js';

const router = Router();

// 3. Use os routers
router.use(categoriaRouter);
router.use(funcionarioRouter);
router.use(chamadoRouter);
// ...

// 4. Use o router corrigido
router.use(subCategoriaRouter);

export default router;