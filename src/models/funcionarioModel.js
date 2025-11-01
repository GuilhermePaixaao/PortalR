import pool from '../config/database.js';

// Encontra um funcionário pelo seu nome de usuário
// (ESTA FUNÇÃO JÁ ESTAVA CORRETA - usa f.*)
export const findByUsuario = async (usuario) => {
  const sql = `
    SELECT f.*, c.nome AS nomeCargo 
    FROM Funcionario f
    LEFT JOIN Cargo c ON f.cargoId = c.idCargo
    WHERE f.usuario = ?
  `;
  const [rows] = await pool.query(sql, [usuario]);
  return rows[0];
};

// Encontra um funcionário pelo ID
// (ESTA FUNÇÃO JÁ ESTAVA CORRETA - usa *)
export const findById = async (id) => {
  const [rows] = await pool.query('SELECT * FROM Funcionario WHERE id = ?', [id]);
  return rows[0];
};

// ===================================================
// ===== FUNÇÃO 'CREATE' SUBSTITUÍDA POR ESTA =====
// ===================================================
// Cria um novo funcionário
export const create = async (funcionario) => {
  const { 
    nomeFuncionario, 
    usuario, 
    email, 
    senhaHash, 
    cargoId, 
    perfil, 
    categoria_id_atendimento // <--- NOVOS CAMPOS
  } = funcionario;
  
  const sql = `
    INSERT INTO Funcionario (
      nomeFuncionario, usuario, email, senha, cargoId, 
      perfil, categoria_id_atendimento
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  
  const values = [
    nomeFuncionario, 
    usuario, 
    email, 
    senhaHash, 
    cargoId, 
    perfil, 
    categoria_id_atendimento
  ];

  const [result] = await pool.query(sql, values);
  return result.insertId; // Retorna o ID do novo funcionário
};
// ==========================================
// ===== FIM DA SUBSTITUIÇÃO DE 'CREATE' =====
// ==========================================

// Lista todos os funcionários
// (Sua função original com a correção do findAll - Está correta)
export const findAll = async () => {
  const sql = `
    SELECT 
      f.id, 
      f.nomeFuncionario, 
      f.email, 
      f.usuario, 
      f.createdAt, 
      f.cargoId,
      c.nome AS nomeCargo,
      f.perfil, 
      f.categoria_id_atendimento
    FROM Funcionario f
    LEFT JOIN Cargo c ON f.cargoId = c.idCargo
  `;
  const [rows] = await pool.query(sql);
  return rows;
};

// Atualiza um funcionário
// (Sua função original - Está correta)
export const update = async (id, funcionario) => {
  const [result] = await pool.query(funcionario.sql, funcionario.values);
  return result;
};

// Deleta um funcionário
// (Sua função original - Está correta)
export const deleteById = async (id) => {
  const [result] = await pool.query('DELETE FROM Funcionario WHERE id = ?', [id]);
  return result;
};
