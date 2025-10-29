import pool from '../config/database.js';

export const findAll = async () => {
  const [categorias] = await pool.query('SELECT * FROM Categorias');
  return categorias;
};