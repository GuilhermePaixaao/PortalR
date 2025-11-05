import { Router } from 'express';

// --- 1. IMPORTAÇÃO DE TODOS OS SEUS ROUTERS ---
// (Certifique-se de que os nomes dos arquivos na sua pasta 'routers'
// estejam todos em minúsculo, como listado aqui)

import cargoRouter from './cargoRouter.js';
import categoriaRouter from './categoriaRouter.js';
import chamadoRouter from './chamadoRouter.js';
import chatRouter from './chatRouter.js';
import funcionarioRouter from './funcionarioRouter.js';

// Importa o novo router (com nome minúsculo)
import subcategoriaRouter from './sbcategoriaRouter.js';

const router = Router();

// --- 2. USO DE TODOS OS SEUS ROUTERS ---
// (O Express agora sabe sobre todas essas rotas)

router.use(cargoRouter);
router.use(categoriaRouter);
router.use(chamadoRouter);
router.use(chatRouter);
router.use(funcionarioRouter);

// Use o novo router
router.use(subcategoriaRouter); // Rota de subcategoria ativada

export default router;