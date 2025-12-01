import pool from '../config/database.js';

// ========================= LOJAS =========================
export const getLojas = async () => {
    const [rows] = await pool.query('SELECT * FROM Loja ORDER BY nome ASC');
    return rows;
};

export const createLoja = async (nome) => {
    const [result] = await pool.query('INSERT INTO Loja (nome) VALUES (?)', [nome]);
    return { id: result.insertId, nome };
};

export const updateLoja = async (id, nome) => {
    await pool.query('UPDATE Loja SET nome = ? WHERE id = ?', [nome, id]);
    return { id, nome };
};

export const deleteLoja = async (id) => {
    const [result] = await pool.query('DELETE FROM Loja WHERE id = ?', [id]);
    return result.affectedRows;
};

// ========================= DEPARTAMENTOS =========================
export const getDepartamentos = async () => {
    const [rows] = await pool.query('SELECT * FROM Departamento ORDER BY nome ASC');
    return rows;
};

export const createDepartamento = async (nome) => {
    const [result] = await pool.query('INSERT INTO Departamento (nome) VALUES (?)', [nome]);
    return { id: result.insertId, nome };
};

export const updateDepartamento = async (id, nome) => {
    await pool.query('UPDATE Departamento SET nome = ? WHERE id = ?', [nome, id]);
    return { id, nome };
};

export const deleteDepartamento = async (id) => {
    const [result] = await pool.query('DELETE FROM Departamento WHERE id = ?', [id]);
    return result.affectedRows;
};

// ========================= VÍNCULOS (LOJA X DEPARTAMENTO) =========================

// Busca quais departamentos estão ativados para uma loja específica
export const getVinculosPorLoja = async (lojaId) => {
    const sql = `
        SELECT d.id, d.nome, 
               CASE WHEN ld.loja_id IS NOT NULL THEN 1 ELSE 0 END as vinculado
        FROM Departamento d
        LEFT JOIN loja_departamento ld ON d.id = ld.departamento_id AND ld.loja_id = ?
        ORDER BY d.nome ASC
    `;
    const [rows] = await pool.query(sql, [lojaId]);
    return rows;
};

// Atualiza os vínculos (Remove tudo e readiciona os selecionados - método simples e seguro)
export const salvarVinculos = async (lojaId, departamentoIds) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Limpa vínculos atuais da loja
        await connection.query('DELETE FROM loja_departamento WHERE loja_id = ?', [lojaId]);

        // 2. Insere novos (se houver)
        if (departamentoIds && departamentoIds.length > 0) {
            const values = departamentoIds.map(deptId => [lojaId, deptId]);
            await connection.query('INSERT INTO loja_departamento (loja_id, departamento_id) VALUES ?', [values]);
        }

        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};