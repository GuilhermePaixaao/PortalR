import pool from '../config/database.js';

// Lista TODAS as subcategorias (com o nome da Categoria Pai)
export const findAll = async () => {
  const [rows] = await pool.query(`
    SELECT 
      sub.id, 
      sub.nome, 
      sub.id_categoria, 
      cat.nome AS nome_categoria 
    FROM Subcategorias sub
    LEFT JOIN Categorias cat ON sub.id_categoria = cat.id
  `);
  return rows;
};

// Cria uma nova subcategoria
export const create = async (subcategoria) => {    
  const { nome, id_categoria } = subcategoria; 
  const [result] = await pool.query(
    'INSERT INTO Subcategorias (nome, id_categoria) VALUES (?, ?)',
    [nome, id_categoria]
  );
  // Retorna o objeto completo como o frontend espera
  const novoId = result.insertId;
  return { id: novoId, nome, id_categoria };
};

// Atualiza uma subcategoria
export const update = async (id, subcategoria) => {
  const { nome, id_categoria } = subcategoria;
  const [result] = await pool.query(
    'UPDATE Subcategorias SET nome = ?, id_categoria = ? WHERE id = ?',
    [nome, id_categoria, id]
  );
  return result.affectedRows;
};

// Remove uma subcategoria
export const remove = async (id) => {
  const [result] = await pool.query(
    'DELETE FROM Subcategorias WHERE id = ?',
    [id]
  );
  return result.affectedRows;
};