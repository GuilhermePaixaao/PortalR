// =======================================================
// IMPORTAÇÕES E CONFIGURAÇÃO
// =======================================================
import 'dotenv/config'; // Garante que o .env seja lido primeiro
import express from 'express';
import cors from 'cors';
import path from 'path'; // Módulo nativo do Node para lidar com caminhos
import { fileURLToPath } from 'url'; // Módulo nativo do Node

// Importa o "Roteador Chefe" que vai unificar todas as suas rotas
import mainRouter from './src/routers/index.js';

// Configuração para __dirname funcionar com ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// =======================================================
// CONFIGURAÇÕES DO APP (MIDDLEWARE)
// =======================================================
app.use(cors()); // Permite requisições de outros domínios
app.use(express.json()); // Permite que o Express entenda JSON
app.use(express.urlencoded({ extended: true })); // Permite que o Express entenda Form-Data


// =======================================================
// (MUDANÇA AQUI) ROTAS PARA PÁGINAS HTML
// =======================================================
// Estas rotas DEVEM vir ANTES de 'express.static'

// 1. Rota para /login (em vez de /Login.html)
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'views', 'Login.html'));
});

// 2. Rota para /atendimento (em vez de /Chamado.html)
//    (Este é o nome "menos na cara")
app.get('/atendimento', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'views', 'Chamado.html'));
});

// 3. Rota para /gerenciar (em vez de /GerenciarChamados.html)
app.get('/gerenciar', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'views', 'GerenciarChamados.html'));
});

// (Adicione outras rotas .get() aqui para outras páginas, se necessário)
// Ex:
// app.get('/dashboard', (req, res) => {
//     res.sendFile(path.join(__dirname, 'src', 'views', 'Dashboard.html'));
// });


// 4. Redirecionamento da raiz (/)
app.get('/', (req, res) => {
  res.redirect('/login'); // Agora redireciona para a rota limpa /login
});

// 5. Servir os arquivos estáticos (CSS, JS, Imagens)
// Esta linha serve os seus ficheiros CSS, JS, e a pasta 'public'
app.use(express.static(path.join(__dirname, 'src', 'views')));
app.use(express.static(path.join(__dirname, 'public')));


// 6. Usar TODAS as suas rotas da API (vem depois das páginas)
app.use(mainRouter); // Gerencia /chamados, /categorias, etc.


// =======================================================
// INICIAR O SERVIDOR
// =======================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando liso na porta ${PORT}`);
  console.log(`API disponível em: http://localhost:${PORT}`);
  console.log(`Página de Login: http://localhost:${PORT}/login`); // Atualizado
});

