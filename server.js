// =======================================================
// IMPORTAÇÕES E CONFIGURAÇÃO
// =======================================================
import 'dotenv/config'; 
import express from 'express';
import cors from 'cors';
import path from 'path'; 
import { fileURLToPath } from 'url';

// --- (NOVO) Importações para Socket.io ---
import { createServer } from 'http'; // Módulo HTTP nativo
import { Server } from 'socket.io'; // O Servidor do Socket.io
// --- FIM NOVO ---

import mainRouter from './src/routers/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// --- (NOVO) Cria o servidor HTTP e o servidor de Socket ---
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Em produção, mude para a URL do seu portal
    methods: ["GET", "POST"]
  }
});
// --- FIM NOVO ---

// =======================================================
// CONFIGURAÇÕES DO APP (MIDDLEWARE)
// =======================================================
app.use(cors()); 
app.use(express.json()); 
app.use(express.urlencoded({ extended: true })); 

// --- (NOVO) Middleware para injetar o 'io' em todas as requisições ---
// Isso permite que seus controllers (como o whatsappController) usem o io
app.use((req, res, next) => {
  req.io = io;
  next();
});
// --- FIM NOVO ---

// =======================================================
// ROTAS PARA PÁGINAS HTML
// =======================================================
// (Suas rotas de páginas HTML /login, /atendimento, etc. continuam aqui)
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'views', 'Login.html'));
});
app.get('/atendimento', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'views', 'Chamado.html'));
});
app.get('/gerenciar', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'views', 'GerenciarChamados.html'));
});

// (NOVO) Rota para a nova página de atendimento
app.get('/whatsapp', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'views', 'AtendimentoWhatsApp.html'));
});

// Redirecionamento da raiz (/)
app.get('/', (req, res) => {
  res.redirect('/login');
});

// Servir os arquivos estáticos (CSS, JS, Imagens)
app.use(express.static(path.join(__dirname, 'src', 'views')));
app.use(express.static(path.join(__dirname, 'public')));


// Usar TODAS as suas rotas da API
app.use(mainRouter); // Gerencia /chamados, /categorias, etc.

// =======================================================
// (NOVO) LÓGICA DE CONEXÃO DO SOCKET.IO
// =======================================================
io.on('connection', (socket) => {
  console.log(`Socket conectado: ${socket.id}`);
  
  socket.on('disconnect', () => {
    console.log(`Socket desconectado: ${socket.id}`);
  });
});

// =======================================================
// INICIAR O SERVIDOR (MODIFICADO)
// =======================================================
const PORT = process.env.PORT || 3000;

// (MUDANÇA) Use 'httpServer.listen' em vez de 'app.listen'
httpServer.listen(PORT, () => {
  console.log(`Servidor rodando liso na porta ${PORT}`);
  console.log(`API disponível em: http://localhost:${PORT}`);
  console.log(`Página de Login: http://localhost:${PORT}/login`);
});