import { Router } from 'express';
import multer from 'multer';
import * as PdfController from '../controllers/pdfController.js';

const router = Router();
const upload = multer({ dest: 'uploads/' });

// Rota existente
router.post('/gerar-pdf', upload.single('imagem'), PdfController.gerarPdf);

// --- NOVAS ROTAS ---
router.get('/pastas', PdfController.listarPastas); // Busca lista de pastas
router.post('/pastas', PdfController.criarPasta);  // Cria nova pasta
router.get('/pastas/:pastaName/arquivos', PdfController.listarArquivosDaPasta); // Busca arquivos dentro da pasta

export default router;