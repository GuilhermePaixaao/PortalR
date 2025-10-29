import { Router } from 'express';
// Importa todos os seus roteadores
import funcionarioRouter from './funcionarioRouter.js';
import cargoRouter from './cargoRouter.js';
import categoriaRouter from './categoriaRouter.js';
import chamadoRouter from './chamadoRouter.js';
import chatRouter from './chatRouter.js'; // <-- 1. IMPORTA O NOVO ROUTER

const router = Router();

// Diz ao roteador principal para usar os roteadores específicos
// O Express vai juntar as rotas. 
// Ex: /usuarios (aqui) + /:id (no funcionarioRouter) = /usuarios/:id
router.use(funcionarioRouter);
router.use(cargoRouter);
router.use(categoriaRouter);
router.use(chamadoRouter);

// 2. USA O NOVO ROUTER COM O PREFIXO /chat
// Se o seu src/index.js principal montar este arquivo em '/api',
// a rota final para o chat será '/api/chat'
router.use('/chat', chatRouter); 

export default router;