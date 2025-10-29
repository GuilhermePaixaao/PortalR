import { Router } from 'express';
import * as CargoController from '../controllers/cargoController.js';

const router = Router();

router.post('/cargos', CargoController.criarCargo);
router.get('/cargos', CargoController.listarCargos);
router.put('/cargos/:id', CargoController.atualizarCargo);
router.delete('/cargos/:id', CargoController.deletarCargo);

export default router;