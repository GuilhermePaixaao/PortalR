// =======================================================
// IMPORTAÇÕES E CONFIGURAÇÃO
// =======================================================
import 'dotenv/config'; // Garante que o .env seja lido primeiro
import express from 'express';
import cors from 'cors';
import path from 'path'; // Módulo nativo do Node para lidar com caminhos
import { fileURLToPath } from 'url'; // Módulo nativo do Node

// Importa o "Roteador Chefe" que vai unificar todas as suas rotas

// Configuração para __dirname funcionar com ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// =======================================================
// CONFIGURAÇÕES DO APP (MIDDLEWARE)
// =======================================================
app.use(cors()); // Permite requisições de outros domínios
app.use(express.json()); // Permite que o Express entenda JSON

// 1. Redirecionamento da raiz
app.get('/', (req, res) => {
  res.redirect('/Login.html');
});

// 2. Servir os arquivos estáticos (HTML, CSS, JS)
// Sua linha original, servindo a pasta 'views'
app.use(express.static(path.join(__dirname, 'src', 'views')));
// --- LINHA ADICIONADA ---
// Servindo a nova pasta 'public' para o widget de chat
app.use(express.static(path.join(__dirname, 'public')));


// 3. Usar TODAS as suas rotas da API
// O mainRouter vai gerenciar /login, /usuarios, /cargos, etc.
app.use(mainRouter);


// =======================================================
// INICIAR O SERVIDOR
// =======================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando liso na porta ${PORT}`);
  console.log(`API disponível em: http://localhost:${PORT}`);
  console.log(`Página de Login: http://localhost:${PORT}/Login.html`);
});
                                                