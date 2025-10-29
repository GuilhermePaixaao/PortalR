import { Router } from 'express';
// Importa todos os seus roteadores
import funcionarioRouter from './funcionarioRouter.js';
import cargoRouter from './cargoRouter.js';
import categoriaRouter from './categoriaRouter.js';
import chamadoRouter from './chamadoRouter.js';

const router = Router();

// Diz ao roteador principal para usar os roteadores específicos
// O Express vai juntar as rotas. 
// Ex: /usuarios (aqui) + /:id (no funcionarioRouter) = /usuarios/:id
router.use(funcionarioRouter);
router.use(cargoRouter);
router.use(categoriaRouter);
router.use(chamadoRouter);

export default router;