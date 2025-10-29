// =======================================================
// IMPORTAÇÕES E CONFIGURAÇÃO
// =======================================================
import 'dotenv/config'; // <-- NECESSÁRIO para ler o .env
import express from 'express';
import mysql from 'mysql2/promise'; // <-- SUBSTITUIU O PRISMA
import cors from 'cors';
import bcrypt from 'bcryptjs';

const app = express();

// =======================================================
// CONEXÃO COM O BANCO DE DADOS
// =======================================================
// O pool de conexões vai usar a MESMA DATABASE_URL do seu .env
// Se o Prisma não conecta, o mysql2 também não vai conectar.
let pool;
try {
  pool = mysql.createPool({
    uri: process.env.DATABASE_URL,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
  console.log("Pool de conexões MySQL criado.");
} catch (error) {
  console.error("ERRO CRÍTICO AO CRIAR POOL DO MYSQL:", error);
  process.exit(1); // Encerra a aplicação se não puder criar o pool
}


// CONFIGURAÇÕES DO APP
app.use(cors());
app.use(express.json());
app.get('/', (req, res) => {
  res.redirect('/Login.html');
});
app.use(express.static('src/views'));


// =======================================================
// ROTA PARA LOGIN (POST) - (COM BCRYPT E MYSQL2)
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

    // 1. Escrever o SQL para buscar o funcionário E o seu cargo (com JOIN)
    const sql = `
      SELECT f.*, c.nome as nomeCargo 
      FROM Funcionario f
      LEFT JOIN Cargo c ON f.cargoId = c.idCargo
      WHERE f.usuario = ?
    `;

    // 2. Executar a query
    const [rows] = await pool.query(sql, [usuario]);

    // 3. Verificar se o usuário existe
    const funcionarioEncontrado = rows[0];
    if (!funcionarioEncontrado) {
      return res.status(401).json({
        success: false,
        message: 'Usuário ou senha inválidos.'
      });
    }

    // 4. Comparar a senha
    const senhasBatem = await bcrypt.compare(senha, funcionarioEncontrado.senha);

    if (!senhasBatem) {
      return res.status(401).json({
        success: false,
        message: 'Usuário ou senha inválidos.'
      });
    }

    // 5. Formatar os dados para o frontend (igual o Prisma fazia)
    // Remover a senha e criar o objeto 'cargo'
    const { senha: _, ...dadosUsuario } = funcionarioEncontrado;
    dadosUsuario.cargo = {
        idCargo: funcionarioEncontrado.cargoId,
        nome: funcionarioEncontrado.nomeCargo
    };
    // Remover o 'nomeCargo' duplicado
    delete dadosUsuario.nomeCargo; 

    res.status(200).json({
      success: true,
      message: "Login realizado com sucesso!",
      data: dadosUsuario
    });

  } catch (error) {
    // SE DER ERRO DE CONEXÃO, VAI CAIR AQUI
    console.error("Erro na rota /login:", error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor.'
    });
  }
});

// =======================================================
// ROTA PARA CADASTRAR (POST) USUÁRIO - (COM BCRYPT E MYSQL2)
// =======================================================
app.post('/usuarios', async (req, res) => {
  try {
    const { funcionario } = req.body;

    if (!funcionario.nomeFuncionario || !funcionario.email || !funcionario.usuario || !funcionario.senha || !funcionario.cargo || !funcionario.cargo.idCargo) {
      return res.status(400).json({ success: false, message: 'Todos os campos são obrigatórios' });
    }

    const salt = await bcrypt.genSalt(10);
    const senhaHash = await bcrypt.hash(funcionario.senha, salt);

    const sql = `
      INSERT INTO Funcionario (nomeFuncionario, usuario, email, senha, cargoId)
      VALUES (?, ?, ?, ?, ?)
    `;
    const values = [
      funcionario.nomeFuncionario,
      funcionario.usuario,
      funcionario.email,
      senhaHash,
      parseInt(funcionario.cargo.idCargo)
    ];

    const [result] = await pool.query(sql, values);
    
    // Buscar o usuário recém-criado para retornar os dados (sem a senha)
    const [rows] = await pool.query('SELECT * FROM Funcionario WHERE id = ?', [result.insertId]);
    const { senha: _, ...dadosNovoFuncionario } = rows[0];

    res.status(201).json({ success: true, data: dadosNovoFuncionario });

  } catch (error) {
    // Tratamento de erro (equivalente ao P2002 e P2025 do Prisma)
    if (error.code === 'ER_DUP_ENTRY') {
      const campo = error.message.includes("email_unique") ? 'email' : 'usuario';
      return res.status(409).json({ success: false, message: `O campo '${campo}' já está em uso.` });
    }
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ success: false, message: "Erro: O Cargo especificado ('idCargo') não foi encontrado." });
    }
    console.error("Erro ao criar usuário:", error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor' });
  }
});

// =======================================================
// ROTA PARA LISTAR (GET) USUÁRIOS - (COM MYSQL2)
// =======================================================
app.get('/usuarios', async (req, res) => {
  try {
    const sql = `
      SELECT f.id, f.nomeFuncionario, f.email, f.usuario, f.createdAt, f.cargoId,
             c.nome as nomeCargo 
      FROM Funcionario f
      LEFT JOIN Cargo c ON f.cargoId = c.idCargo
    `;
    
    const [users] = await pool.query(sql);

    // Formatar manualmente o objeto 'cargo' (que o Prisma fazia com 'include')
    const usersFormatado = users.map(user => {
      return {
        id: user.id,
        nomeFuncionario: user.nomeFuncionario,
        email: user.email,
        usuario: user.usuario,
        createdAt: user.createdAt,
        cargoId: user.cargoId,
        cargo: {
          idCargo: user.cargoId,
          nome: user.nomeCargo
        }
      };
    });

    res.status(200).json(usersFormatado);
  } catch (error) {
    console.error('Erro ao buscar usuarios:', error);
    return res.status(500).send({ message: 'Erro interno do servidor. Verifique o log.' });
  }
});

// =======================================================
// ROTA PARA ATUALIZAR (PUT) USUÁRIO - (COM MYSQL2)
// =======================================================
app.put('/usuarios/:id', async (req, res) => {
  try {
    const idNum = parseInt(req.params.id);
    if (isNaN(idNum)) {
      return res.status(400).json({ success: false, message: 'ID de usuário inválido.' });
    }

    const { funcionario } = req.body;
    
    // Lógica para atualizar a senha SOMENTE se ela foi enviada
    let sql;
    let values;

    if (funcionario.senha && funcionario.senha.trim() !== "") {
      // Atualiza com a senha
      const salt = await bcrypt.genSalt(10);
      const senhaHash = await bcrypt.hash(funcionario.senha, salt);
      sql = `
        UPDATE Funcionario 
        SET nomeFuncionario = ?, usuario = ?, email = ?, senha = ?, cargoId = ?
        WHERE id = ?
      `;
      values = [
        funcionario.nomeFuncionario,
        funcionario.usuario,
        funcionario.email,
        senhaHash,
        parseInt(funcionario.cargo.idCargo),
        idNum
      ];
    } else {
      // Atualiza sem a senha
      sql = `
        UPDATE Funcionario 
        SET nomeFuncionario = ?, usuario = ?, email = ?, cargoId = ?
        WHERE id = ?
      `;
      values = [
        funcionario.nomeFuncionario,
        funcionario.usuario,
        funcionario.email,
        parseInt(funcionario.cargo.idCargo),
        idNum
      ];
    }

    const [result] = await pool.query(sql, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
    }

    // Buscar o usuário atualizado para retornar
    const [rows] = await pool.query('SELECT * FROM Funcionario WHERE id = ?', [idNum]);
    const { senha: _, ...dadosUsuario } = rows[0];

    res.status(200).json({ success: true, data: dadosUsuario });

  } catch (error) {
    // Tratamento de erro (MySQL)
    if (error.code === 'ER_DUP_ENTRY') {
      const campo = error.message.includes("email_unique") ? 'email' : 'usuario';
      return res.status(409).json({ success: false, message: `O campo '${campo}' já está em uso.` });
    }
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ success: false, message: "Erro: O Cargo especificado ('idCargo') não foi encontrado." });
    }
    console.error("Erro ao atualizar usuário:", error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor' });
  }
});

// =======================================================
// ROTA PARA DELETAR (DELETE) USUÁRIO - (COM MYSQL2)
// =======================================================
app.delete('/usuarios/:id', async (req, res) => {
  try {
    const idNum = parseInt(req.params.id);
    if (isNaN(idNum)) {
      return res.status(400).json({ success: false, message: 'ID de usuário inválido.' });
    }

    const [result] = await pool.query('DELETE FROM Funcionario WHERE id = ?', [idNum]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
    }

    res.status(200).json({ success: true, message: 'Funcionário deletado.' });
  } catch (error) {
    // Equivalente ao P2003 (Chave estrangeira em uso)
    // Se o funcionário for requisitante de um chamado, o banco vai proibir
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
        return res.status(409).json({ success: false, message: 'Erro: Este funcionário é requisitante de chamados e não pode ser excluído.' });
    }
    console.error("Erro ao deletar usuário:", error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
});


// =======================================================
// ROTA PARA CRIAR (POST) CARGO - (COM MYSQL2)
// =======================================================
app.post('/cargos', async (req, res) => {
  try {
    const { nome } = req.body;
    if (!nome) {
      return res.status(400).json({ message: "O campo 'nome' é obrigatório." });
    }

    const [result] = await pool.query('INSERT INTO Cargo (nome) VALUES (?)', [nome]);
    
    res.status(201).json({ idCargo: result.insertId, nome: nome });
  } catch (error) {
    // Equivalente ao P2002 (Unique)
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: `O cargo '${nome}' já existe.` });
    }
    console.error("Erro ao criar cargo:", error);
    res.status(500).json({ message: "Erro interno no servidor." });
  }
});

// =======================================================
// ROTA PARA LISTAR (GET) CARGOS - (COM MYSQL2)
// =======================================================
app.get('/cargos', async (req, res) => {
  try {
    const [cargos] = await pool.query('SELECT * FROM Cargo');
    res.status(200).json(cargos);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// =======================================================
// ROTA PARA ATUALIZAR (PUT) CARGO - (COM MYSQL2)
// =======================================================
app.put('/cargos/:id', async (req, res) => {
  try {
    const idNum = parseInt(req.params.id);
    if (isNaN(idNum)) {
      return res.status(400).json({ success: false, message: 'ID de cargo inválido.' });
    }
    const { nome } = req.body;
    if (!nome) {
      return res.status(400).json({ success: false, message: "O campo 'nome' é obrigatório." });
    }

    const [result] = await pool.query('UPDATE Cargo SET nome = ? WHERE idCargo = ?', [nome, idNum]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Cargo não encontrado.' });
    }
    
    res.status(200).json({ success: true, data: { idCargo: idNum, nome: nome } });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: `O cargo '${nome}' já existe.` });
    }
    console.error("Erro ao atualizar cargo:", error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
});

// =======================================================
// ROTA PARA DELETAR (DELETE) CARGO - (COM MYSQL2)
// =======================================================
app.delete('/cargos/:id', async (req, res) => {
  try {
    const idNum = parseInt(req.params.id);
    if (isNaN(idNum)) {
      return res.status(400).json({ success: false, message: 'ID de cargo inválido.' });
    }

    const [result] = await pool.query('DELETE FROM Cargo WHERE idCargo = ?', [idNum]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Cargo não encontrado.' });
    }

    res.status(200).json({ success: true, message: 'Cargo deletado.' });
  } catch (error) {
    // Equivalente ao P2003 (Chave estrangeira em uso)
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({ success: false, message: 'Erro: Este cargo está em uso por um ou mais funcionários e não pode ser excluído.' });
    }
    console.error("Erro ao deletar cargo:", error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
});

// =======================================================
// ROTA PARA LISTAR (GET) CATEGORIAS - (COM MYSQL2)
// =======================================================
app.get('/categorias', async (req, res) => {
  try {
    const [categorias] = await pool.query('SELECT * FROM Categorias');
    res.status(200).json(categorias);
  } catch (error) {
    console.error("Erro ao buscar categorias:", error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// =======================================================
// ROTA PARA CRIAR (POST) CHAMADO - (COM MYSQL2)
// =======================================================
app.post('/chamados', async (req, res) => {
  try {
    const { chamado } = req.body;

    if (!chamado || !chamado.assunto || !chamado.descricao || !chamado.requisitante_id) {
      return res.status(400).json({ success: false, message: 'Assunto, Descrição e Requisitante são obrigatórios.' });
    }

    const requisitanteIdNum = parseInt(chamado.requisitante_id);
    const categoriaIdNum = chamado.categoria_id ? parseInt(chamado.categoria_id) : null;
    const prioridade = chamado.prioridade || 'Média';
    const status = 'Aberto'; // O padrão é sempre 'Aberto' ao criar

    const sql = `
      INSERT INTO Chamados (assunto, descricao, prioridade, status, requisitante_id, categoria_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const values = [
      chamado.assunto,
      chamado.descricao,
      prioridade,
      status,
      requisitanteIdNum,
      categoriaIdNum
    ];

    const [result] = await pool.query(sql, values);
    
    // Buscar o chamado recém-criado para retornar
    const [rows] = await pool.query('SELECT * FROM Chamados WHERE id = ?', [result.insertId]);
    
    res.status(201).json({ success: true, data: rows[0] });

  } catch (error) {
    // Equivalente ao P2003 (Chave estrangeira não encontrada)
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      const field = error.message.includes('fk_Chamados_Funcionario') ? 'Requisitante' : 'Categoria';
      return res.status(400).json({ success: false, message: `Erro: ${field} não encontrado.` });
    }
    console.error("Erro ao criar chamado:", error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
});


// =======================================================
// ROTA PARA LISTAR (GET) CHAMADOS - (COM MYSQL2)
// =======================================================
app.get('/chamados', async (req, res) => {
  try {
    const sql = `
      SELECT 
        ch.*, 
        f.nomeFuncionario as nomeRequisitante, 
        ca.nome as nomeCategoria
      FROM Chamados ch
      JOIN Funcionario f ON ch.requisitante_id = f.id
      LEFT JOIN Categorias ca ON ch.categoria_id = ca.id
      ORDER BY ch.created_at DESC
    `;
    
    const [chamados] = await pool.query(sql);

    // Formatar manualmente (igual o 'include' do Prisma)
    const chamadosFormatados = chamados.map(chamado => {
      // Cria os objetos aninhados que o Prisma faria
      const Funcionario = {
        nomeFuncionario: chamado.nomeRequisitante
      };
      const Categorias = chamado.categoria_id ? {
        nome: chamado.nomeCategoria
      } : null;

      // Limpa os campos extras
      delete chamado.nomeRequisitante;
      delete chamado.nomeCategoria;

      return {
        ...chamado,
        Funcionario: Funcionario,
        Categorias: Categorias
      };
    });

    res.status(200).json(chamadosFormatados);
  } catch (error) {
    console.error("Erro ao buscar chamados:", error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// =======================================================
// ROTA PARA DELETAR (DELETE) CHAMADO - (COM MYSQL2)
// =======================================================
app.delete('/chamados/:id', async (req, res) => {
  try {
    const idNum = parseInt(req.params.id);
    if (isNaN(idNum)) {
      return res.status(400).json({ success: false, message: 'ID de chamado inválido.' });
    }

    const [result] = await pool.query('DELETE FROM Chamados WHERE id = ?', [idNum]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Erro: Chamado não encontrado.' });
    }

    res.status(200).json({ success: true, message: 'Chamado deletado com sucesso.' });
  } catch (error) {
    console.error("Erro ao deletar chamado:", error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
});

// =======================================================
// INICIAR O SERVIDOR
// =======================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando liso na porta ${PORT}`);
  console.log(`API disponível em: http://localhost:${PORT}`);
  console.log(`Página de Login: http://localhost:${PORT}/Login.html`);
});