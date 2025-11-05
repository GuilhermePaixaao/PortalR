import pool from '../config/database.js';

export const findAll = async () => {
  const [categorias] = await pool.query('SELECT * FROM Categorias');
  return categorias;
};
export const create = async (categoria) => {    
  const { nome } = categoria;
  const [result] = await pool.query(
    'INSERT INTO Categorias (nome) VALUES (?)',
    [nome]
  );
  return { id: result.insertId, nome };
} 