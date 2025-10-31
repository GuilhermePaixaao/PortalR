// src/routers/index.js

import { Router } from 'express';
// Importa todos os seus roteadores
import funcionarioRouter from './funcionarioRouter.js';
import cargoRouter from './cargoRouter.js';
import categoriaRouter from './categoriaRouter.js';
import chamadoRouter from './chamadoRouter.js';
import chatRouter from './chatRouter.js'; // 1. Importado

const router = Router();

// Suas rotas existentes (PERFEITO)
router.use(funcionarioRouter);
router.use(cargoRouter);
router.use(categoriaRouter);
router.use(chamadoRouter);

// === A LINHA MAIS IMPORTANTE ===
// Garanta que esta linha existe e está correta.
// Ela diz ao Express: "Qualquer requisição que chegar em /api/chat,
// mande para o chatRouter."
router.use('/api/chat', chatRouter); 

export default router;