import pool from '../config/database.js';

export const create = async (nome) => {
  const [result] = await pool.query('INSERT INTO Cargo (nome) VALUES (?)', [nome]);
  return result;
};

export const findAll = async () => {
  const [cargos] = await pool.query('SELECT * FROM Cargo');
  return cargos;
};

export const update = async (id, nome) => {
  const [result] = await pool.query('UPDATE Cargo SET nome = ? WHERE idCargo = ?', [nome, id]);
  return result;
};

export const deleteById = async (id) => {
  const [result] = await pool.query('DELETE FROM Cargo WHERE idCargo = ?', [id]);
  return result;
};