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
// --- COLE ISSO NO FINAL DO SEU src/server.js ---
import pool from './src/config/database.js'; // Ajuste o caminho se necessário

async function setupDatabase() {
    console.log('🔄 Verificando tabelas do WhatsApp no Railway...');

    const createSessoes = `
        CREATE TABLE IF NOT EXISTS whatsapp_sessoes (
            numero VARCHAR(50) NOT NULL,
            nome_contato VARCHAR(255) NULL,
            etapa VARCHAR(50) DEFAULT 'INICIO',
            historico_ia JSON NULL,
            mostrar_na_fila TINYINT(1) DEFAULT 0,
            nome_agente VARCHAR(255) NULL,
            bot_pausado TINYINT(1) DEFAULT 0,
            ultimo_ticket_id INT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (numero)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `;

    const createMensagens = `
        CREATE TABLE IF NOT EXISTS whatsapp_mensagens (
            id INT AUTO_INCREMENT PRIMARY KEY,
            remote_jid VARCHAR(50) NOT NULL,
            message_id VARCHAR(255) NULL,
            conteudo TEXT,
            media_url LONGTEXT NULL, 
            from_me TINYINT(1) DEFAULT 0,
            tipo VARCHAR(50) DEFAULT 'text',
            nome_autor VARCHAR(255) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_remote_jid (remote_jid)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `;

    try {
        const connection = await pool.getConnection();
        
        await connection.query(createSessoes);
        console.log('✅ Tabela "whatsapp_sessoes" verificada/criada.');

        await connection.query(createMensagens);
        console.log('✅ Tabela "whatsapp_mensagens" verificada/criada.');

        connection.release();
    } catch (error) {
        console.error('❌ Erro ao criar tabelas:', error);
    }
}

// Executa a função imediatamente ao iniciar
setupDatabase();