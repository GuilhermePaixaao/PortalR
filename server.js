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

// [ALTERAÇÃO] Aumento do limite para 50mb para suportar envio de imagens
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true })); 

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
// --- ATUALIZAÇÃO DE BANCO DE DADOS (Pode colar no final do server.js) ---
import pool from './src/config/database.js';

async function adicionarColunaMedia() {
    console.log('🔄 Verificando atualização da tabela whatsapp_mensagens...');
    
    try {
        const connection = await pool.getConnection();
        
        // Tenta adicionar a coluna 'media_url'. 
        // Se ela já existir, o MySQL vai gerar um erro, que tratamos abaixo.
        await connection.query(`
            ALTER TABLE whatsapp_mensagens 
            ADD COLUMN media_url LONGTEXT NULL;
        `);
        
        console.log('✅ SUCESSO: Coluna "media_url" adicionada na tabela whatsapp_mensagens!');
        connection.release();
        
    } catch (error) {
        // Código de erro para "Coluna duplicada" no MySQL é ER_DUP_FIELDNAME (1060)
        if (error.code === 'ER_DUP_FIELDNAME' || error.errno === 1060) {
            console.log('ℹ️ AVISO: A coluna "media_url" já existe. Nenhuma ação necessária.');
        } else {
            // Se for outro erro (ex: tabela não existe), mostra no log
            console.error('❌ ERRO ao tentar alterar a tabela:', error.message);
        }
    }
}

// Executa a função
adicionarColunaMedia();