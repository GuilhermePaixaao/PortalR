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
};

// --- NOVO CÓDIGO ADICIONADO ---

export const update = async (id, categoria) => {
  const { nome } = categoria;
  
  const [result] = await pool.query(
    'UPDATE Categorias SET nome = ? WHERE id = ?',
    [nome, id]
  );
  
  // Retorna o número de linhas afetadas (0 se não encontrou, 1 se atualizou)
  return result.affectedRows;
};

export const remove = async (id) => {
  const [result] = await pool.query(
    'DELETE FROM Categorias WHERE id = ?',
    [id]
  );
  
  // Retorna o número de linhas afetadas (0 se não encontrou, 1 se deletou)
  return result.affectedRows;
};