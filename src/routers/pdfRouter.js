import { Router } from 'express';
import multer from 'multer';
import express from 'express';
import * as PdfController from '../controllers/pdfController.js';

const router = Router();
// Permite até 10 imagens por vez no campo 'imagens'
const upload = multer({ dest: 'uploads/' });

// MUDANÇA AQUI: de upload.single('imagem') para upload.array('imagens')
router.post('/gerar-pdf', upload.array('imagens', 10), PdfController.gerarPdf);

router.get('/pastas', PdfController.listarPastas);
router.post('/pastas', express.json(), PdfController.criarPasta);
router.get('/pastas/:pastaName/arquivos', PdfController.listarArquivosDaPasta);

export default router;