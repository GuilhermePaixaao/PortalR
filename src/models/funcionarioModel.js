import pool from '../config/database.js';

// Encontra um funcionário pelo seu nome de usuário
// (ESTA FUNÇÃO JÁ ESTAVA CORRETA - usa f.*)
export const findByUsuario = async (usuario) => {
  const sql = `
    SELECT f.*, c.nome as nomeCargo 
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

// Cria um novo funcionário
// (ESTA FUNÇÃO ESTÁ CORRETA. O banco de dados vai usar o 'DEFAULT REQUISITANTE' para o perfil)
export const create = async (funcionario) => {
  const { nomeFuncionario, usuario, email, senhaHash, cargoId } = funcionario;
  const sql = `
    INSERT INTO Funcionario (nomeFuncionario, usuario, email, senha, cargoId)
    VALUES (?, ?, ?, ?, ?)
  `;
  const values = [nomeFuncionario, usuario, email, senhaHash, cargoId];
  const [result] = await pool.query(sql, values);
  return result.insertId; 
};

// Lista todos os funcionários
// --- CORREÇÃO APLICADA AQUI ---
export const findAll = async () => {
  const sql = `
    SELECT f.id, f.nomeFuncionario, f.email, f.usuario, f.createdAt, f.cargoId,
           c.nome as nomeCargo,
           f.perfil,                 -- <--- COLUNA ADICIONADA
           f.categoria_id_atendimento  -- <--- COLUNA ADICIONADA
    FROM Funcionario f
    LEFT JOIN Cargo c ON f.cargoId = c.idCargo
  `;
  const [rows] = await pool.query(sql);
  return rows;
};
// --- FIM DA CORREÇÃO ---

// Atualiza um funcionário
// (ESTA FUNÇÃO ESTÁ CORRETA. Ela é um "passa-prato" para o controller)
// (Obs: Seu controller 'atualizarUsuario' ainda não atualiza o perfil, 
// mas isso não impede nosso sistema de funcionar agora.)
export const update = async (id, funcionario) => {
  const [result] = await pool.query(funcionario.sql, funcionario.values);
  return result;
};

// Deleta um funcionário
// (ESTA FUNÇÃO ESTÁ CORRETA)
export const deleteById = async (id) => {
  const [result] = await pool.query('DELETE FROM Funcionario WHERE id = ?', [id]);
  return result;
};
