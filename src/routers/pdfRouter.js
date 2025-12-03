import { Router } from 'express';
import multer from 'multer';
import express from 'express'; // Necessário para o express.json()
import * as PdfController from '../controllers/pdfController.js';

const router = Router();
const upload = multer({ dest: 'uploads/' });

// Rota para Gerar PDF (com upload de imagem)
router.post('/gerar-pdf', upload.single('imagem'), PdfController.gerarPdf);

// Rotas para Gerenciar Pastas e Arquivos
router.get('/pastas', PdfController.listarPastas);
router.post('/pastas', express.json(), PdfController.criarPasta);
router.get('/pastas/:pastaName/arquivos', PdfController.listarArquivosDaPasta);

export default router;