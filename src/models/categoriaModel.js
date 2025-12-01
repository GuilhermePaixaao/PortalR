import pool from '../config/database.js';

export const findAll = async () => {
  // Busca as categorias e faz um JOIN com a própria tabela para trazer o nome do Pai
  const sql = `
    SELECT 
      c.id, 
      c.nome, 
      c.parent_id, 
      c.prioridade_padrao,
      p.nome AS nome_pai
    FROM Categorias c
    LEFT JOIN Categorias p ON c.parent_id = p.id
    ORDER BY c.nome ASC
  `;
  const [rows] = await pool.query(sql);
  return rows;
};

export const create = async (dados) => {
  const sql = `INSERT INTO Categorias (nome, parent_id, prioridade_padrao) VALUES (?, ?, ?)`;
  const [result] = await pool.query(sql, [dados.nome, dados.parent_id, dados.prioridade_padrao]);
  return { id: result.insertId, ...dados };
};

export const update = async (id, dados) => {
  const sql = `UPDATE Categorias SET nome = ?, parent_id = ?, prioridade_padrao = ? WHERE id = ?`;
  const [result] = await pool.query(sql, [dados.nome, dados.parent_id, dados.prioridade_padrao, id]);
  return result.affectedRows;
};

export const remove = async (id) => {
  const sql = `DELETE FROM Categorias WHERE id = ?`;
  const [result] = await pool.query(sql, [id]);
  return result.affectedRows;
};