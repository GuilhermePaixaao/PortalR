import db from '../db/db.js'; // Verifique se este é o caminho correto para sua conexão db

// ====================================================
// ======== CRIAR CHAMADO ========
// ====================================================
export const create = async (dados) => {
    const {
        assunto, descricao, prioridade, status, requisitanteIdNum, categoriaIdNum,
        nomeRequisitanteManual, emailRequisitanteManual, telefoneRequisitanteManual
    } = dados;

    const [result] = await db.query(
        `INSERT INTO Chamados (
            assunto, descricao, prioridade, status, requisitante_id, categoria_id,
            nome_requisitante_manual, email_requisitante_manual, telefone_requisitante_manual
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            assunto, descricao, prioridade, status, requisitanteIdNum, categoriaIdNum,
            nomeRequisitanteManual, emailRequisitanteManual, telefoneRequisitanteManual
        ]
    );
    return result.insertId;
};

// ====================================================
// ======== BUSCAR CHAMADO POR ID ========
// ====================================================
export const findById = async (id) => {
    // Esta query junta Chamados com Funcionarios (Requisitante) e Categorias
    // É a mesma lógica da sua função findAll, mas para um ID específico
    const [rows] = await db.query(
        `SELECT 
            ch.*, 
            f.nomeFuncionario AS nomeRequisitante,
            f.email AS emailRequisitante,
            f.telefone AS telefoneRequisitante,
            cat.nome AS nomeCategoria
         FROM Chamados ch
         LEFT JOIN Funcionarios f ON ch.requisitante_id = f.id
         LEFT JOIN Categorias cat ON ch.categoria_id = cat.id
         WHERE ch.id = ?`,
        [id]
    );
    return rows[0];
};

// ====================================================
// ======== LISTAR TODOS OS CHAMADOS (com filtros) ========
// ====================================================
export const findAll = async (filtros) => {
    let sql = `
        SELECT 
            ch.id, ch.assunto, ch.descricao, ch.prioridade, ch.status, ch.created_at,
            ch.categoria_id, ch.requisitante_id,
            COALESCE(ch.nome_requisitante_manual, f.nomeFuncionario) AS nomeRequisitante,
            COALESCE(ch.email_requisitante_manual, f.email) AS emailRequisitante,
            COALESCE(ch.telefone_requisitante_manual, f.telefone) AS telefoneRequisitante,
            cat.nome AS nomeCategoria
        FROM Chamados ch
        LEFT JOIN Funcionarios f ON ch.requisitante_id = f.id
        LEFT JOIN Categorias cat ON ch.categoria_id = cat.id
    `;

    const whereParams = [];
    const whereClauses = [];

    if (filtros.assunto) {
        whereClauses.push('ch.assunto LIKE ?');
        whereParams.push(`%${filtros.assunto}%`);
    }
    if (filtros.prioridade) {
        whereClauses.push('ch.prioridade = ?');
        whereParams.push(filtros.prioridade);
    }
    if (filtros.status) {
        whereClauses.push('ch.status = ?');
        whereParams.push(filtros.status);
    }
    if (filtros.categoria_id) {
        whereClauses.push('ch.categoria_id = ?');
        whereParams.push(filtros.categoria_id);
    }
    // Filtro para a página "Meus Chamados" (requisitante)
    if (filtros.requisitante_id) {
        whereClauses.push('ch.requisitante_id = ?');
        whereParams.push(filtros.requisitante_id);
    }

    if (whereClauses.length > 0) {
        sql += ' WHERE ' + whereClauses.join(' AND ');
    }

    // Ordena pelos mais recentes primeiro
    sql += ' ORDER BY ch.created_at DESC';

    const [rows] = await db.query(sql, whereParams);
    return rows;
};

// ====================================================
// ======== DELETAR CHAMADO ========
// ====================================================
export const deleteById = async (id) => {
    const [result] = await db.query(
        'DELETE FROM Chamados WHERE id = ?',
        [id]
    );
    return result;
};

// ====================================================
// ======== ATUALIZAR STATUS ========
// ====================================================
export const updateStatus = async (id, status) => {
    const [result] = await db.query(
        'UPDATE Chamados SET status = ? WHERE id = ?',
        [status, id]
    );
    return result;
};

// ====================================================
// ======== (NOVO) ATUALIZAR PRIORIDADE ========
// Esta é a função que faltava para o seu controller
// ====================================================
export const updatePrioridade = async (id, prioridade) => {
    const [result] = await db.query(
        'UPDATE Chamados SET prioridade = ? WHERE id = ?',
        [prioridade, id]
    );
    return result;
};