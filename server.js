// =======================================================
// IMPORTAÇÕES E CONFIGURAÇÃO
// =======================================================
import 'dotenv/config'; 
import express from 'express';
import cors from 'cors';
import path from 'path'; 
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';

// Importação dos Routers
import mainRouter from './src/routers/index.js';
import organizacaoRouter from './src/routers/organizacaoRouter.js';

// Importação do Controller de PDF (Apenas uma vez!)
import * as PdfController from './src/controllers/pdfController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Configuração do Servidor HTTP e Socket.io
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

// =======================================================
// MIDDLEWARES
// =======================================================
app.use(cors()); 
app.use(express.json()); 
app.use(express.urlencoded({ extended: true })); 

// Injeta o 'io' em todas as requisições
app.use((req, res, next) => {
  req.io = io;
  next();
});

// =======================================================
// ROTAS PARA PÁGINAS HTML
// =======================================================
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'views', 'Login.html'));
});
app.get('/atendimento', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'views', 'Chamado.html'));
});
app.get('/gerenciar', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'views', 'GerenciarChamados.html'));
});
app.get('/whatsapp', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'views', 'AtendimentoWhatsApp.html'));
});
app.get('/AtendimentoWhatsApp.html', (req, res) => {
    res.redirect(301, '/whatsapp'); 
});

// Rota para a Base de Conhecimento (FAQ)
app.get('/faq', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'views', 'BaseConhecimento.html'));
});

// Redirecionamento da raiz
app.get('/', (req, res) => {
  res.redirect('/login');
});

// Arquivos Estáticos
app.use(express.static(path.join(__dirname, 'src', 'views')));
app.use(express.static(path.join(__dirname, 'public')));

// =======================================================
// ROTAS DA API
// =======================================================
app.use('/api/org', organizacaoRouter);
app.use(mainRouter);

// =======================================================
// SOCKET.IO
// =======================================================
io.on('connection', (socket) => {
  console.log(`Socket conectado: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`Socket desconectado: ${socket.id}`);
  });
});

// =======================================================
// INICIALIZAÇÃO
// =======================================================
const PORT = process.env.PORT || 3000;

// Cria as pastas padrões do PDF antes de iniciar
PdfController.inicializarPastasPadrao();

httpServer.listen(PORT, () => {
  console.log(`Servidor rodando liso na porta ${PORT}`);
  console.log(`API disponível em: http://localhost:${PORT}`);
});