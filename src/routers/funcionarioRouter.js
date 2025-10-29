import { Router } from 'express';
// Importa os controllers
import * as FuncionarioController from '../controllers/funcionarioController.js';

const router = Router();

// Define as rotas e para qual controller elas apontam
router.post('/login', FuncionarioController.login);
router.post('/usuarios', FuncionarioController.criarUsuario);
router.get('/usuarios', FuncionarioController.listarUsuarios);
router.put('/usuarios/:id', FuncionarioController.atualizarUsuario);
router.delete('/usuarios/:id', FuncionarioController.deletarUsuario);

export default router;