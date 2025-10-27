import express from 'express';
import { PrismaClient } from '@prisma/client';
import cors from 'cors';
import bcrypt from 'bcryptjs'; // <--- Importado para criptografia

const app = express();
const prisma = new PrismaClient();

// CONFIGURAÇÕES DO APP
app.use(cors()); 
app.use(express.json());
// Certifique-se que 'src/views' é a pasta correta onde estão seus HTML
app.use(express.static('src/views')); 



// =======================================================
// ROTA PARA LOGIN (POST) - (COM BCRYPT)
// =======================================================
app.post('/login', async (req, res) => {
    try {
        const { funcionario } = req.body;

        if (!funcionario || !funcionario.usuario || !funcionario.senha) {
            return res.status(400).json({ 
                success: false, 
                message: 'Usuário e senha são obrigatórios.' 
            });
        }

        const { usuario, senha } = funcionario;

        // O findUnique no 'usuario' está correto
        const funcionarioEncontrado = await prisma.funcionario.findUnique({
            where: {
                usuario: usuario
            },
            include: {
                cargo: true 
            }
        });

        if (!funcionarioEncontrado) {
            return res.status(401).json({ 
                success: false, 
                message: 'Usuário ou senha inválidos.' 
            });
        }

        const senhasBatem = await bcrypt.compare(senha, funcionarioEncontrado.senha);

        if (!senhasBatem) {
            return res.status(401).json({ 
                success: false, 
                message: 'Usuário ou senha inválidos.' 
            });
        }
        
        const { senha: _, ...dadosUsuario } = funcionarioEncontrado;

        res.status(200).json({
            success: true,
            message: "Login realizado com sucesso!",
            data: dadosUsuario 
        });

    } catch (error) {
        console.error("Erro na rota /login:", error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor.' 
        });
    }
});

// =======================================================
// ROTA PARA CADASTRAR (POST) USUÁRIO - (COM BCRYPT)
// =======================================================
app.post('/usuarios', async (req, res) => {
    try {
        const { funcionario } = req.body;

        if (!funcionario.nomeFuncionario || !funcionario.email || !funcionario.senha || !funcionario.cargo) {
            return res.status(400).json({ success: false, message: 'Todos os campos são obrigatórios' });
        }
        
        const salt = await bcrypt.genSalt(10);
        const senhaHash = await bcrypt.hash(funcionario.senha, salt);

        const novoFuncionario = await prisma.funcionario.create({
            data: {
                nomeFuncionario: funcionario.nomeFuncionario,
                usuario: funcionario.usuario,
                email: funcionario.email,
                senha: senhaHash, 
                cargo: {
                    // CORRIGIDO: A referência em Funcionario é 'idCargo'
                    connect: { idCargo: parseInt(funcionario.cargo.idCargo) } 
                }
            }
        });
        
        const { senha: _, ...dadosNovoFuncionario } = novoFuncionario;
        res.status(201).json({ success: true, data: dadosNovoFuncionario });

    } catch (error) {
        if (error.code === 'P2002') {
             const campo = error.meta.target[0];
             return res.status(409).json({ success: false, message: `O campo '${campo}' já está em uso.` });
        }
        if (error.code === 'P2025') {
             // CORRIGIDO: A referência em Funcionario é 'idCargo'
             return res.status(400).json({ success: false, message: "Erro: O Cargo especificado ('idCargo') não foi encontrado." });
        }
        console.error("Erro ao criar usuário:", error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// =======================================================
// ROTA PARA LISTAR (GET) USUÁRIOS
// =======================================================
app.get('/usuarios', async (req, res) => {
    try {
        // O include 'cargo' está correto conforme o schema
        const users = await prisma.funcionario.findMany({
            include: {
                cargo: true 
            }
        });
        
        const usersSemSenha = users.map(user => {
            const { senha: _, ...userSemSenha } = user;
            return userSemSenha;
        });
        res.status(200).json(usersSemSenha); 
    } catch(error) {
        console.error('Erro ao buscar usuarios (VERIFIQUE O INCLUDE):', error); 
        return res.status(500).send({ message: 'Erro interno do servidor. Verifique o log.' });
    }
});

// =======================================================
// ROTA PARA ATUALIZAR (PUT) USUÁRIO
// =======================================================
app.put('/usuarios/:id', async (req, res) => {
    try {
        // CORRIGIDO: Validação do ID (para evitar o NaN)
        const idNum = parseInt(req.params.id);
        if (isNaN(idNum)) {
            return res.status(400).json({ success: false, message: 'ID de usuário inválido.' });
        }

        const { funcionario } = req.body;

        let senhaHash;
        if (funcionario.senha && funcionario.senha.trim() !== "") {
             const salt = await bcrypt.genSalt(10);
             senhaHash = await bcrypt.hash(funcionario.senha, salt);
        }

        const funcionarioAtualizado = await prisma.funcionario.update({
            // CORRIGIDO: O ID de Funcionario é 'id'
            where: { id: idNum }, 
            data: {
                nomeFuncionario: funcionario.nomeFuncionario,
                usuario: funcionario.usuario,
                email: funcionario.email,
                ...(senhaHash && { senha: senhaHash }), 
                cargo: {
                    // CORRIGIDO: A referência em Funcionario é 'idCargo'
                    connect: { idCargo: parseInt(funcionario.cargo.idCargo) } 
                }
            }
        });

        const { senha: _, ...dadosUsuario } = funcionarioAtualizado;
        res.status(200).json({ success: true, data: dadosUsuario });

    } catch (error) {
        console.error("Erro ao atualizar usuário:", error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// =======================================================
// ROTA PARA DELETAR (DELETE) USUÁRIO
// =======================================================
app.delete('/usuarios/:id', async (req, res) => {
    try {
        // CORRIGIDO: Validação do ID (para evitar o NaN)
        const idNum = parseInt(req.params.id);
        if (isNaN(idNum)) {
            return res.status(400).json({ success: false, message: 'ID de usuário inválido.' });
        }
        
        await prisma.funcionario.delete({
            // CORRIGIDO: O ID de Funcionario é 'id'
            where: { id: idNum } 
        });
        res.status(200).json({ success: true, message: 'Funcionário deletado.' });
    } catch (error) {
        console.error("Erro ao deletar usuário:", error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});


// =======================================================
// ROTA PARA CRIAR (POST) CARGO
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
// ROTA PARA LISTAR (GET) CARGOS
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
// ROTA PARA ATUALIZAR (PUT) CARGO
// =======================================================
app.put('/cargos/:id', async (req, res) => {
    try {
        // CORRIGIDO: Validação do ID (para evitar o NaN)
        const idNum = parseInt(req.params.id);
        if (isNaN(idNum)) {
            return res.status(400).json({ success: false, message: 'ID de cargo inválido.' });
        }

        const { nome } = req.body; 

        if (!nome) {
            return res.status(400).json({ success: false, message: "O campo 'nome' é obrigatório." });
        }

        const cargoAtualizado = await prisma.cargo.update({
            // CORRIGIDO: O ID de Cargo é 'idCargo'
            where: { idCargo: idNum }, 
            data: { nome: nome }
        });
        res.status(200).json({ success: true, data: cargoAtualizado });

    } catch (error) {
        console.error("Erro ao atualizar cargo:", error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// =======================================================
// ROTA PARA DELETAR (DELETE) CARGO
// =======================================================
app.delete('/cargos/:id', async (req, res) => {
    try {
        // CORRIGIDO: Validação do ID (para evitar o NaN)
        const idNum = parseInt(req.params.id);
        if (isNaN(idNum)) {
            return res.status(400).json({ success: false, message: 'ID de cargo inválido.' });
        }
        
        await prisma.cargo.delete({
            // CORRIGIDO: O ID de Cargo é 'idCargo'
            where: { idCargo: idNum } 
        });
        res.status(200).json({ success: true, message: 'Cargo deletado.' });
    } catch (error) {
        // Trata erro se o cargo estiver em uso por um funcionário
        if (error.code === 'P2003') { 
            return res.status(409).json({ success: false, message: 'Erro: Este cargo está em uso por um ou mais funcionários e não pode ser excluído.' });
        }
        console.error("Erro ao deletar cargo:", error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});
// =======================================================
// ROTA PARA LISTAR (GET) CATEGORIAS
// =======================================================
app.get('/categorias', async (req, res) => {
    try {
        const categorias = await prisma.categorias.findMany(); // Use o nome exato da sua tabela
        res.status(200).json(categorias);
    } catch (error) {
        console.error("Erro ao buscar categorias:", error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

// =======================================================
// ROTA PARA CRIAR (POST) CHAMADO
// =======================================================
app.post('/chamados', async (req, res) => {
    try {
        const { chamado } = req.body; // Espera um objeto { chamado: { ...dados... } }

        // Validação básica (adicione mais se necessário)
        if (!chamado || !chamado.assunto || !chamado.descricao || !chamado.requisitante_id) {
            return res.status(400).json({ success: false, message: 'Assunto, Descrição e Requisitante são obrigatórios.' });
        }

        // Converte IDs para número
        const requisitanteIdNum = parseInt(chamado.requisitante_id);
        const categoriaIdNum = chamado.categoria_id ? parseInt(chamado.categoria_id) : null;

        if (isNaN(requisitanteIdNum)) {
             return res.status(400).json({ success: false, message: 'ID do requisitante inválido.' });
        }
        if (chamado.categoria_id && isNaN(categoriaIdNum)) {
             return res.status(400).json({ success: false, message: 'ID da categoria inválido.' });
        }


        const novoChamado = await prisma.chamados.create({ // Use o nome exato da sua tabela
            data: {
                assunto: chamado.assunto,
                descricao: chamado.descricao,
                prioridade: chamado.prioridade || 'Média', // Usa 'Média' se não for enviado
                // status já tem default 'Aberto' no banco
                requisitante_id: requisitanteIdNum,
                // Só conecta a categoria se um ID válido foi enviado
                ...(categoriaIdNum && { categoria_id: categoriaIdNum })
                // created_at já tem default now() no banco
            }
        });

        res.status(201).json({ success: true, data: novoChamado });

    } catch (error) {
         if (error.code === 'P2003') { // Erro de Chave Estrangeira
             const field = error.meta.field_name;
             if (field.includes('requisitante_id')) {
                  return res.status(400).json({ success: false, message: 'Erro: Requisitante não encontrado.' });
             }
             if (field.includes('categoria_id')) {
                 return res.status(400).json({ success: false, message: 'Erro: Categoria não encontrada.' });
             }
         }
        console.error("Erro ao criar chamado:", error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});


// =======================================================
// ROTA PARA LISTAR (GET) CHAMADOS (Exemplo simples)
// =======================================================
app.get('/chamados', async (req, res) => {
    try {
        // !!! IMPORTANTE !!!
        // Esta rota simples lista TODOS os chamados.
        // O ideal é filtrar por requisitante_id (o usuário logado)
        // ou adicionar filtros por status, etc., via query params (ex: /chamados?status=Aberto)

        const chamados = await prisma.chamados.findMany({ // Use o nome exato da sua tabela
            include: {
                // Inclui dados do requisitante e da categoria, se existirem as relações no schema
                 Funcionario: { // Assumindo que a relação se chama 'Funcionario'
                     select: { nomeFuncionario: true } // Pega só o nome
                 },
                 Categorias: { // Assumindo que a relação se chama 'Categorias'
                     select: { nome: true } // Pega só o nome
                 }
                 // Se os nomes das relações forem outros no seu schema.prisma, ajuste aqui!
            },
            orderBy: {
                created_at: 'desc' // Mostra os mais recentes primeiro
            }
        });
        res.status(200).json(chamados);
    } catch (error) {
        console.error("Erro ao buscar chamados:", error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});
// =======================================================
// ROTA PARA DELETAR (DELETE) CHAMADO
// =======================================================
app.delete('/chamados/:id', async (req, res) => {
    try {
        const idNum = parseInt(req.params.id);
        if (isNaN(idNum)) {
            return res.status(400).json({ success: false, message: 'ID de chamado inválido.' });
        }

        // Adicionar verificação de permissão aqui seria ideal
        // (Ex: verificar se o usuário logado é o requisitante ou um admin)

        await prisma.chamados.delete({ // Use o nome exato do seu model
            where: { id: idNum }
        });
        res.status(200).json({ success: true, message: 'Chamado deletado com sucesso.' });
    } catch (error) {
        if (error.code === 'P2025') { // Recurso não encontrado
             return res.status(404).json({ success: false, message: 'Erro: Chamado não encontrado.' });
        }
        console.error("Erro ao deletar chamado:", error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
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