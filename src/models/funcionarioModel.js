import pool from '../config/database.js';

// Encontra um funcionário pelo seu nome de usuário
export const findByUsuario = async (usuario) => {
  const sql = `
    SELECT f.*, c.nome as nomeCargo 
    FROM Funcionario f
    LEFT JOIN Cargo c ON f.cargoId = c.idCargo
    WHERE f.usuario = ?
  `;
  const [rows] = await pool.query(sql, [usuario]);
  return rows[0]; // Retorna o primeiro (e único) usuário encontrado
};

// Encontra um funcionário pelo ID
export const findById = async (id) => {
  const [rows] = await pool.query('SELECT * FROM Funcionario WHERE id = ?', [id]);
  return rows[0];
};

// Cria um novo funcionário
export const create = async (funcionario) => {
  const { nomeFuncionario, usuario, email, senhaHash, cargoId } = funcionario;
  const sql = `
    INSERT INTO Funcionario (nomeFuncionario, usuario, email, senha, cargoId)
    VALUES (?, ?, ?, ?, ?)
  `;
  const values = [nomeFuncionario, usuario, email, senhaHash, cargoId];
  const [result] = await pool.query(sql, values);
  return result.insertId; // Retorna o ID do novo funcionário
};

// Lista todos os funcionários
export const findAll = async () => {
  const sql = `
    SELECT f.id, f.nomeFuncionario, f.email, f.usuario, f.createdAt, f.cargoId,
           c.nome as nomeCargo 
    FROM Funcionario f
    LEFT JOIN Cargo c ON f.cargoId = c.idCargo
  `;
  const [rows] = await pool.query(sql);
  return rows;
};

// Atualiza um funcionário
export const update = async (id, funcionario) => {
  // A lógica de qual SQL usar (com ou sem senha) ficará no controller
  const [result] = await pool.query(funcionario.sql, funcionario.values);
  return result;
};

// Deleta um funcionário
export const deleteById = async (id) => {
  const [result] = await pool.query('DELETE FROM Funcionario WHERE id = ?', [id]);
  return result;
};