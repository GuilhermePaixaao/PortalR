import bcrypt from 'bcryptjs';
// Importa as *funções* do Model
import * as FuncionarioModel from '../models/funcionarioModel.js';

// ===============================================
// ===== ROTA DE LOGIN (POST /login) =====
// ===============================================
export const login = async (req, res) => {
  try {
    const { funcionario } = req.body;

    if (!funcionario || !funcionario.usuario || !funcionario.senha) {
      return res.status(400).json({
        success: false,
        message: 'Usuário e senha são obrigatórios.'
      });
    }

    const { usuario, senha } = funcionario;
    const funcionarioEncontrado = await FuncionarioModel.findByUsuario(usuario);

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
    dadosUsuario.cargo = {
      idCargo: funcionarioEncontrado.cargoId,
      nome: funcionarioEncontrado.nomeCargo
    };
    delete dadosUsuario.nomeCargo;

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
};

// =======================================================
// ===== ROTA DE CADASTRO (POST /usuarios) =====
// =======================================================
export const criarUsuario = async (req, res) => {
  try {
    const { funcionario } = req.body;

    if (
      !funcionario.nomeFuncionario ||
      !funcionario.email ||
      !funcionario.usuario ||
      !funcionario.senha ||
      !funcionario.cargo ||
      !funcionario.cargo.idCargo
    ) {
      return res.status(400).json({
        success: false,
        message: 'Todos os campos são obrigatórios.'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const senhaHash = await bcrypt.hash(funcionario.senha, salt);
    const cargoId = parseInt(funcionario.cargo.idCargo);

    // ==================================================
    // ===== INÍCIO DA LÓGICA DE PERFIL AUTOMÁTICO =====
    // ==================================================

    const ID_CARGO_ADMIN = 1;     // Cargo Administrador
    const ID_CARGO_SUPORTE_TI = 2; // Cargo Suporte TI
    const ID_CATEGORIA_TI = 1;     // Categoria TI

    let perfil = 'REQUISITANTE';
    let categoriaAtendimento = null;

    if (cargoId === ID_CARGO_ADMIN) {
      perfil = 'ADMIN';
    } else if (cargoId === ID_CARGO_SUPORTE_TI) {
      perfil = 'AGENTE';
      categoriaAtendimento = ID_CATEGORIA_TI;
    }

    // ================================================
    // ===== FIM DA LÓGICA DE PERFIL AUTOMÁTICO =====
    // ================================================

    const dadosParaCriar = {
      nomeFuncionario: funcionario.nomeFuncionario,
      usuario: funcionario.usuario,
      email: funcionario.email,
      senhaHash,
      cargoId,
      perfil,
      categoria_id_atendimento: categoriaAtendimento
    };

    const novoId = await FuncionarioModel.create(dadosParaCriar);
    const novoFuncionario = await FuncionarioModel.findById(novoId);

    const { senha: _, ...dadosNovoFuncionario } = novoFuncionario;
    res.status(201).json({ success: true, data: dadosNovoFuncionario });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      const campo = error.message.includes("email_unique") ? 'email' : 'usuario';
      return res.status(409).json({
        success: false,
        message: `O campo '${campo}' já está em uso.`
      });
    }

    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({
        success: false,
        message: "Erro: O Cargo especificado ('idCargo') não foi encontrado."
      });
    }

    console.error("Erro ao criar usuário:", error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
};

// ===============================================
// ===== ROTA DE LISTAGEM (GET /usuarios) =====
// ===============================================
export const listarUsuarios = async (req, res) => {
  try {
    const users = await FuncionarioModel.findAll();

    const usersFormatado = users.map(user => ({
      id: user.id,
      nomeFuncionario: user.nomeFuncionario,
      email: user.email,
      usuario: user.usuario,
      createdAt: user.createdAt,
      cargoId: user.cargoId,
      perfil: user.perfil,
      categoria_id_atendimento: user.categoria_id_atendimento,
      cargo: {
        idCargo: user.cargoId,
        nome: user.nomeCargo
      }
    }));

    res.status(200).json(usersFormatado);
  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
    res.status(500).send({ message: 'Erro interno do servidor.' });
  }
};

// ===============================================
// ===== ROTA DE ATUALIZAÇÃO (PUT /usuarios/:id) =====
// ===============================================
export const atualizarUsuario = async (req, res) => {
  try {
    const idNum = parseInt(req.params.id);
    if (isNaN(idNum)) {
      return res.status(400).json({
        success: false,
        message: 'ID de usuário inválido.'
      });
    }

    const { funcionario } = req.body;
    let sql, values;

    if (funcionario.senha && funcionario.senha.trim() !== "") {
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

    const dadosUpdate = { sql, values };
    const result = await FuncionarioModel.update(idNum, dadosUpdate);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado.'
      });
    }

    const dadosUsuario = await FuncionarioModel.findById(idNum);
    const { senha: _, ...dadosUsuarioSemSenha } = dadosUsuario;

    res.status(200).json({
      success: true,
      data: dadosUsuarioSemSenha
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      const campo = error.message.includes("email_unique") ? 'email' : 'usuario';
      return res.status(409).json({
        success: false,
        message: `O campo '${campo}' já está em uso.`
      });
    }

    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({
        success: false,
        message: "Erro: O Cargo especificado ('idCargo') não foi encontrado."
      });
    }

    console.error("Erro ao atualizar usuário:", error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor.'
    });
  }
};

// ===============================================
// ===== ROTA DE DELEÇÃO (DELETE /usuarios/:id) =====
// ===============================================
export const deletarUsuario = async (req, res) => {
  try {
    const idNum = parseInt(req.params.id);
    if (isNaN(idNum)) {
      return res.status(400).json({
        success: false,
        message: 'ID de usuário inválido.'
      });
    }

    const result = await FuncionarioModel.deleteById(idNum);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado.'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Funcionário deletado com sucesso.'
    });
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({
        success: false,
        message: 'Erro: Este funcionário é requisitante de chamados e não pode ser excluído.'
      });
    }

    console.error("Erro ao deletar usuário:", error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor.'
    });
  }
};
