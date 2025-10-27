import express from 'express';
import { PrismaClient } from '@prisma/client';
import cors from 'cors'; // <--- 1. IMPORTADO NOVAMENTE

const app = express();
const prisma = new PrismaClient();

// CONFIGURAÇÕES DO APP
app.use(cors()); // <--- 2. CORS ATIVADO AQUI
app.use(express.json());
app.use(express.static('views')); // Serve arquivos da pasta 'views'

// =======================================================
// ROTA PARA CADASTRAR (POST)
// =======================================================
app.post('/usuarios', async (req, res) => {
    try {
        const { funcionario } = req.body;

        // --- VALIDAÇÃO ---
        if (!funcionario.nomeFuncionario) {
            return res.status(400).send({ message: 'Nome do funcionario é obrigatório' });
        }
        if (!funcionario.email) {
            return res.status(400).send({ message: 'Email do funcionario é obrigatório' });
        }
        if (!funcionario.senha) {
            return res.status(400).send({ message: 'Senha do funcionario é obrigatório' });
        }
        if (!funcionario.cargo || !funcionario.cargo.idCargo) {
            return res.status(400).send({ message: 'Cargo do funcionario é obrigatório' });
        }

        // --- CRIAÇÃO NO BANCO ---
        const novoFuncionario = await prisma.funcionario.create({
            data: {
                nomeFuncionario: funcionario.nomeFuncionario,
                usuario: funcionario.usuario,
                email: funcionario.email,
                senha: funcionario.senha, // (Lembre-se de criptografar!)
                cargo: {
                    connect: { idCargo: parseInt(funcionario.cargo.idCargo) }
                }
            }
        });

        res.status(201).json({ success: true, data: novoFuncionario });

    } catch (error) {
        // Tratamento de erros
        if (error.code === 'P2002') {
            const campo = error.meta.target[0].split('_')[1];
            return res.status(409).json({ success: false, message: `O campo '${campo}' já está em uso.` });
        }
        if (error.code === 'P2025') {
            return res.status(400).json({ success: false, message: "Erro: O Cargo especificado ('idCargo') não foi encontrado." });
        }

        console.error("Erro ao criar usuário:", error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// =======================================================
// ROTA PARA CRIAR CARGO
// =======================================================
app.post('/cargos', async (req, res) => {
  try {
    const { nome } = req.body;

    if (!nome) {
        return res.status(400).json({ message: "O campo 'nome' é obrigatório." });
    }

    const novoCargo = await prisma.cargo.create({
      data: { nome: nome }
    });
    res.status(201).json(novoCargo);
  } catch (error) {
     if (error.code === 'P2002') {
         return res.status(409).json({ message: `O cargo '${nome}' já existe.` });
     }
    console.error("Erro ao criar cargo:", error);
    res.status(500).json({ message: "Erro interno no servidor." });
  }
});

// =======================================================
// ROTA PARA LISTAR USUÁRIOS (GET)
// =======================================================
app.get('/usuarios', async (req, res) => {
    try {
        const users = await prisma.funcionario.findMany({
            include: {
                cargo: true
            }
        });
        res.status(200).json(users);
    } catch(error) {
        console.error('Erro ao buscar usuarios:', error);
        return res.status(500).send({ message: 'Erro interno do servidor' });
    }
});

// =======================================================
// ROTA PARA LISTAR CARGOS (GET)
// =======================================================
app.get('/cargos', async (req, res) => {
    try {
        const cargos = await prisma.cargo.findMany();
        res.status(200).json(cargos);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


// =======================================================
// INICIAR O SERVIDOR
// =======================================================
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando liso na porta ${PORT}`);
  console.log(`API disponível em: http://localhost:${PORT}`);
  console.log(`Página de Login: http://localhost:${PORT}/Login.html`);
});