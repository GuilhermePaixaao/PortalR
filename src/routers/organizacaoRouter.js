import { Router } from 'express';
import * as OrgController from '../controllers/organizacaoController.js';

const router = Router();

// Lojas
router.get('/lojas', OrgController.listarLojas);
router.post('/lojas', OrgController.criarLoja);
router.put('/lojas/:id', OrgController.atualizarLoja);
router.delete('/lojas/:id', OrgController.deletarLoja);

// Departamentos
router.get('/departamentos', OrgController.listarDepartamentos);
router.post('/departamentos', OrgController.criarDepartamento);
router.put('/departamentos/:id', OrgController.atualizarDepartamento);
router.delete('/departamentos/:id', OrgController.deletarDepartamento);

// Vínculos (Configuração da Loja)
router.get('/lojas/:id/vinculos', OrgController.listarVinculos);
router.post('/lojas/:id/vinculos', OrgController.salvarVinculos);

export default router;