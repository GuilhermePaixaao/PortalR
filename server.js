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
// --- COLE NO FINAL DO server.js ---
import pool from './src/config/database.js';

async function apagarChamadoUnico(idParaDeletar) {
    console.log(`⚠️ Processando exclusão do Ticket #${idParaDeletar}...`);
    
    let connection;
    try {
        connection = await pool.getConnection();
        
        // 1. Apaga tudo ligado a esse chamado (Comentários e Histórico)
        await connection.query('DELETE FROM Comentarios WHERE chamado_id = ?', [idParaDeletar]);
        
        // Tenta apagar histórico se a tabela existir
        try {
            await connection.query('DELETE FROM chamado_status_historico WHERE chamado_id = ?', [idParaDeletar]);
        } catch (e) {}

        // 2. Apaga o Chamado em si
        const [res] = await connection.query('DELETE FROM Chamados WHERE id = ?', [idParaDeletar]);
        
        if (res.affectedRows > 0) {
            console.log(`✅ Chamado #${idParaDeletar} excluído com sucesso.`);
        } else {
            console.log(`ℹ️ Chamado #${idParaDeletar} não existe ou já foi apagado.`);
        }

        // 3. O Pulo do Gato: Resetar o Auto Increment
        // Ao definir como 1, o MySQL é inteligente e automaticamente ajusta 
        // para o (MAIOR ID EXISTENTE + 1). Se não sobrar nenhum, ele volta para 1.
        await connection.query('ALTER TABLE Chamados AUTO_INCREMENT = 1;');
        
        console.log('✅ Contador de IDs ajustado! O próximo chamado ocupará a vaga.');

    } catch (error) {
        console.error('❌ Erro ao apagar chamado:', error);
    } finally {
        if (connection) connection.release();
    }
}

// 👇 MUDE O NÚMERO AQUI PARA O ID QUE VOCÊ QUER APAGAR
apagarChamadoUnico(21);