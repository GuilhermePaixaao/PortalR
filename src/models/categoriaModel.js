import pool from '../config/database.js';

/**
 * (ATUALIZADO)
 * Busca todas as categorias, o nome da categoria-pai e agora a prioridade padrão.
 * usando um LEFT JOIN na própria tabela.
 */
export const findAll = async () => {
  const sql = `
    SELECT 
      c1.id, 
      c1.nome, 
      c1.parent_id,
      c1.prioridade_padrao, -- Novo campo
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
 * Cria uma nova categoria, incluindo o parent_id e a prioridade_padrao.
 */
export const create = async (categoria) => {    
  const { nome, parent_id, prioridade_padrao } = categoria;
  
  // Define valor padrão caso venha nulo/undefined
  const prioridadeFinal = prioridade_padrao || 'BAIXA';

  const [result] = await pool.query(
    'INSERT INTO Categorias (nome, parent_id, prioridade_padrao) VALUES (?, ?, ?)',
    [nome, parent_id, prioridadeFinal]
  );
  
  return { id: result.insertId, nome, parent_id, prioridade_padrao: prioridadeFinal };
};

/**
 * (ATUALIZADO)
 * Atualiza uma categoria, incluindo o parent_id e a prioridade_padrao.
 */
export const update = async (id, categoria) => {
  const { nome, parent_id, prioridade_padrao } = categoria;
  
  const prioridadeFinal = prioridade_padrao || 'BAIXA';

  const [result] = await pool.query(
    'UPDATE Categorias SET nome = ?, parent_id = ?, prioridade_padrao = ? WHERE id = ?',
    [nome, parent_id, prioridadeFinal, id]
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