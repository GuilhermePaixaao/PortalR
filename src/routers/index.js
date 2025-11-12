import { Router } from 'express';

// --- 1. IMPORTAÇÃO DE TODOS OS SEUS ROUTERS ---
import cargoRouter from './cargoRouter.js';
import categoriaRouter from './categoriaRouter.js';
import chamadoRouter from './chamadoRouter.js';
import chatRouter from './chatRouter.js';
import funcionarioRouter from './funcionarioRouter.js';
import whatsappRouter from './whatsappRouter.js';

// (REMOVIDO) O router de subcategoria não é mais necessário
// import subcategoriaRouter from './sbcategoriaRouter.js';

const router = Router();

// --- 2. USO DE TODOS OS SEUS ROUTERS ---
router.use(cargoRouter);
router.use(categoriaRouter);
router.use(chamadoRouter);
router.use(chatRouter);
router.use(funcionarioRouter);
router.use(whatsappRouter);
// (REMOVIDO) O router de subcategoria não é mais necessário
// router.use(subcategoriaRouter); 

export default router;