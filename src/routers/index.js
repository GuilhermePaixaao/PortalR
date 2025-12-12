import { Router } from 'express';

// --- SEUS ROUTERS EXISTENTES ---
import cargoRouter from './cargoRouter.js';
import categoriaRouter from './categoriaRouter.js';
import chamadoRouter from './chamadoRouter.js';
import chatRouter from './chatRouter.js';
import funcionarioRouter from './funcionarioRouter.js';
import whatsappRouter from './whatsappRouter.js';
// organizacaoRouter já está no server.js, pode remover daqui ou manter se tiver outras rotas

// --- IMPORTAR O PDF ROUTER ---
import pdfRouter from './pdfRouter.js';

const router = Router();

// --- USO DOS ROUTERS ---
router.use(cargoRouter);
router.use(categoriaRouter);
router.use(chamadoRouter);
router.use(chatRouter);
router.use(funcionarioRouter);

// 👇 [CORREÇÃO] Adicionando o prefixo '/api/whatsapp' aqui!
// Assim, as rotas viram: /api/whatsapp/contacts, /api/whatsapp/status, etc.
router.use('/api/whatsapp', whatsappRouter);

// PDF Router
router.use(pdfRouter);

export default router;