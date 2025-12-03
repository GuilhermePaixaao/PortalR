import { Router } from 'express';

// --- SEUS ROUTERS EXISTENTES ---
import cargoRouter from './cargoRouter.js';
import categoriaRouter from './categoriaRouter.js';
import chamadoRouter from './chamadoRouter.js';
import chatRouter from './chatRouter.js';
import funcionarioRouter from './funcionarioRouter.js';
import whatsappRouter from './whatsappRouter.js';
import organizacaoRouter from './organizacaoRouter.js'; // Confirme se já existe ou se usa direto no server.js

// --- (NOVO) IMPORTAR O PDF ROUTER ---
import pdfRouter from './pdfRouter.js';

const router = Router();

// --- USO DOS ROUTERS ---
router.use(cargoRouter);
router.use(categoriaRouter);
router.use(chamadoRouter);
router.use(chatRouter);
router.use(funcionarioRouter);
router.use(whatsappRouter);
// Se organizacaoRouter estiver aqui, mantenha.

// --- (NOVO) ADICIONAR O PDF ROUTER ---
router.use(pdfRouter);

export default router;