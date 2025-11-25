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

console.log("====================================");
console.log("DEBUG: A EVOLUTION_API_URL é:");
console.log(process.env.EVOLUTION_API_URL);
console.log("DEBUG: A EVOLUTION_API_KEY é:");
console.log(process.env.EVOLUTION_API_KEY);
console.log("====================================");
// ================== FIM DO DEBUG ==================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// --- (NOVO) Cria o servidor HTTP e o servidor de Socket ---
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Permite conexões de qualquer origem (útil para evitar problemas de CORS)
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

// Rota de Health Check (IMPORTANTE PARA O RAILWAY)
// Isso diz para a plataforma que o servidor está vivo
app.get('/health', (req, res) => {
  res.status(200).send('OK');
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

// (MUDANÇA) Adicionado '0.0.0.0' para garantir que o Docker exponha a rede corretamente
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Servidor rodando liso na porta ${PORT}`);
  console.log(`   Health Check: http://localhost:${PORT}/health`);
});