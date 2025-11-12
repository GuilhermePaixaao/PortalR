import pool from '../config/database.js';

/**
 * (ATUALIZADO)
 * Busca todas as categorias e também o nome da categoria-pai,
 * usando um LEFT JOIN na própria tabela.
 */
export const findAll = async () => {
  const sql = `
    SELECT 
      c1.id, 
      c1.nome, 
      c1.parent_id,
      c2.nome AS nome_pai
    FROM 
      Categorias c1
    LEFT JOIN 
      Categorias c2 ON c1.parent_id = c2.id
    ORDER BY 
      c2.nome ASC, c1.nome ASC;
  `;
  const [categorias] = await pool.query(sql);
  return categorias;
};

/**
 * (ATUALIZADO)
 * Cria uma nova categoria, incluindo o parent_id.
 */
export const create = async (categoria) => {    
  const { nome, parent_id } = categoria;
  
  const [result] = await pool.query(
    'INSERT INTO Categorias (nome, parent_id) VALUES (?, ?)',
    [nome, parent_id]
  );
  
  return { id: result.insertId, nome, parent_id };
};

/**
 * (ATUALIZADO)
 * Atualiza uma categoria, incluindo o parent_id.
 */
export const update = async (id, categoria) => {
  const { nome, parent_id } = categoria;
  
  const [result] = await pool.query(
    'UPDATE Categorias SET nome = ?, parent_id = ? WHERE id = ?',
    [nome, parent_id, id]
  );
  
  // Retorna o número de linhas afetadas
  return result.affectedRows;
};

/**
 * (ATUALIZADO)
 * Remove uma categoria.
 * (O CONSTRAINT no banco de dados (ON DELETE SET NULL) 
 * garante que as subcategorias não sejam excluídas,
 * elas apenas se tornarão categorias-pai)
 */
export const remove = async (id) => {
  const [result] = await pool.query(
    'DELETE FROM Categorias WHERE id = ?',
    [id]
  );
  
  // Retorna o número de linhas afetadas
  return result.affectedRows;
};