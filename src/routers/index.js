import { Router } from 'express';

// 1. Importe os routers que você já tem
import categoriaRouter from './categoriaRouter.js';
// (Presumindo que você tenha outros, ex: funcionarioRouter, etc.)
// import funcionarioRouter from './funcionarioRouter.js'; 
// import chamadoRouter from './chamadoRouter.js';
// ... e outros que você usa ...


// 2. ADICIONE A IMPORTAÇÃO DO NOVO ROUTER DE SUBCATEGORIA
// (Use o nome de arquivo exato que você criou, ex: subCategoriaRouter.js)
import subCategoriaRouter from './subCategoriaRouter.js';


const router = Router();

// 3. Use os routers que você já tem
router.use(categoriaRouter);
// router.use(funcionarioRouter);
// router.use(chamadoRouter);
// ...


// 4. ADICIONE O USO DO NOVO ROUTER
// É aqui que você "ativa" o router de subcategorias
router.use(subCategoriaRouter);


export default router;