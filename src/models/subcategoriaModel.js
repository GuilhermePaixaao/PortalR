// models/subcategoriaModel.js
import pool from '../config/database.js';

// (findAll e remove serão muito parecidos com os de Categoria)
export const findAll = async () => {
  // Bônus: Usar um JOIN para mostrar o nome da categoria pai
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

// NOVO CREATE
export const create = async (subcategoria) => {    
  // Agora recebe 'nome' E 'id_categoria'
  const { nome, id_categoria } = subcategoria; 
  
  const [result] = await pool.query(
    'INSERT INTO Subcategorias (nome, id_categoria) VALUES (?, ?)',
    [nome, id_categoria] // Adiciona o novo campo
  );
  return { id: result.insertId, nome, id_categoria };
};

// NOVO UPDATE
export const update = async (id, subcategoria) => {
  const { nome, id_categoria } = subcategoria;
  
  const [result] = await pool.query(
    'UPDATE Subcategorias SET nome = ?, id_categoria = ? WHERE id = ?',
    [nome, id_categoria, id] // Adiciona o novo campo
  );
  
  return result.affectedRows;
};

// (A função remove(id) será idêntica à de Categorias,
// apenas mudando o nome da tabela para 'Subcategorias')
export const remove = async (id) => {
  const [result] = await pool.query(
    'DELETE FROM Subcategorias WHERE id = ?',
    [id]
  );
  return result.affectedRows;
};