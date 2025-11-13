import { Router } from 'express';

// --- 1. IMPORTAÇÃO DE TODOS OS SEUS ROUTERS ---
import cargoRouter from './cargoRouter.js';
import categoriaRouter from './categoriaRouter.js';
import chamadoRouter from './chamadoRouter.js';
import chatRouter from './chatRouter.js';
import funcionarioRouter from './funcionarioRouter.js';

// (NOVO) Importa o router do WhatsApp
import whatsappRouter from './whatsappRouter.js';

const router = Router();

// --- 2. USO DE TODOS OS SEUS ROUTERS ---
router.use(cargoRouter);
router.use(categoriaRouter);
router.use(chamadoRouter);
router.use(chatRouter);
router.use(funcionarioRouter);

// (NOVO) Adiciona o router do WhatsApp
router.use(whatsappRouter); 

export default router;