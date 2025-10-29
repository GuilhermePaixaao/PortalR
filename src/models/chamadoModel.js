import pool from '../config/database.js';

// Cria um novo chamado
export const create = async (chamado) => {
  const { assunto, descricao, prioridade, status, requisitanteIdNum, categoriaIdNum } = chamado;
  const sql = `
    INSERT INTO Chamados (assunto, descricao, prioridade, status, requisitante_id, categoria_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  const values = [assunto, descricao, prioridade, status, requisitanteIdNum, categoriaIdNum];
  const [result] = await pool.query(sql, values);
  return result.insertId; // Retorna o ID do novo chamado
};

// Busca um chamado pelo ID
export const findById = async (id) => {
    const [rows] = await pool.query('SELECT * FROM Chamados WHERE id = ?', [id]);
    return rows[0];
};

// Lista todos os chamados com JOINs
export const findAll = async () => {
  const sql = `
    SELECT 
      ch.*, 
      f.nomeFuncionario as nomeRequisitante, 
      ca.nome as nomeCategoria
    FROM Chamados ch
    JOIN Funcionario f ON ch.requisitante_id = f.id
    LEFT JOIN Categorias ca ON ch.categoria_id = ca.id
    ORDER BY ch.created_at DESC
  `;
  const [chamados] = await pool.query(sql);
  return chamados;
};

// Deleta um chamado
export const deleteById = async (id) => {
  const [result] = await pool.query('DELETE FROM Chamados WHERE id = ?', [id]);
  return result;
};