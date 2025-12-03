import { Router } from 'express';
import multer from 'multer';
import * as PdfController from '../controllers/pdfController.js';

const router = Router();
const upload = multer({ dest: 'uploads/' }); // Pasta temporária para imagens

// Rota POST para gerar o PDF (recebe texto e imagem)
router.post('/gerar-pdf', upload.single('imagem'), PdfController.gerarPdf);

export default router;