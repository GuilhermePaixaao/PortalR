import pool from '../config/database.js';

// Cria um novo chamado (com subcategoria_id)
export const create = async (chamado) => {
    const { 
        assunto, descricao, prioridade, status, requisitanteIdNum, categoriaIdNum, 
        subcategoriaIdNum, // <-- CAMPO NOVO
        nomeRequisitanteManual, emailRequisitanteManual, telefoneRequisitanteManual 
    } = chamado; 

    const sql = `
        INSERT INTO Chamados 
            (assunto, descricao, prioridade, status, requisitante_id, categoria_id, 
             subcategoria_id, -- <-- COLUNA NOVA
             nome_requisitante_manual, email_requisitante_manual, telefone_requisitante_manual)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) -- <-- ATUALIZADO PARA 10 VALORES
    `;
    
    const values = [
        assunto, 
        descricao, 
        prioridade, 
        status, 
        requisitanteIdNum, 
        categoriaIdNum,
        subcategoriaIdNum, // <-- VALOR NOVO
        nomeRequisitanteManual, 
        emailRequisitanteManual, 
        telefoneRequisitanteManual
    ];
    
    const [result] = await pool.query(sql, values);
    return result.insertId;
};

// ====================================================
// ======== BUSCAR CHAMADO POR ID (ATUALIZADO) ========
// ====================================================
export const findById = async (id) => {
    const sql = `
        SELECT 
            ch.*, 
            COALESCE(ch.nome_requisitante_manual, f.nomeFuncionario) AS nomeRequisitante,
            ch.email_requisitante_manual AS emailRequisitante,
            ch.telefone_requisitante_manual AS telefoneRequisitante,
            ca.nome AS nomeCategoria,
            subcat.nome AS nomeSubcategoria -- <-- CAMPO NOVO
        FROM Chamados ch
        LEFT JOIN Funcionario f ON ch.requisitante_id = f.id
        LEFT JOIN Categorias ca ON ch.categoria_id = ca.id
        LEFT JOIN Subcategorias subcat ON ch.subcategoria_id = subcat.id -- <-- JOIN NOVO
        WHERE ch.id = ?
    `;
    const [rows] = await pool.query(sql, [id]);
    return rows[0];
};

// Busca todos os chamados com filtros opcionais (ATUALIZADO)
export const findAll = async (filtros = {}) => {
    let sql = `
        SELECT 
            ch.*, 
            COALESCE(ch.nome_requisitante_manual, f.nomeFuncionario) AS nomeRequisitante,
            ch.email_requisitante_manual AS emailRequisitante,
            ch.telefone_requisitante_manual AS telefoneRequisitante,
            ca.nome AS nomeCategoria,
            subcat.nome AS nomeSubcategoria -- <-- CAMPO NOVO
        FROM Chamados ch
        LEFT JOIN Funcionario f ON ch.requisitante_id = f.id
        LEFT JOIN Categorias ca ON ch.categoria_id = ca.id
        LEFT JOIN Subcategorias subcat ON ch.subcategoria_id = subcat.id -- <-- JOIN NOVO
    `;

    const values = [];
    const whereConditions = [];

    if (filtros.requisitante_id) {
        whereConditions.push("ch.requisitante_id = ?");
        values.push(parseInt(filtros.requisitante_id));
    }
    if (filtros.categoria_id) {
        whereConditions.push("ch.categoria_id = ?");
        values.push(parseInt(filtros.categoria_id));
    }
    if (filtros.subcategoria_id) { // <-- FILTRO NOVO
        whereConditions.push("ch.subcategoria_id = ?");
        values.push(parseInt(filtros.subcategoria_id));
    }
    if (filtros.status) {
        whereConditions.push("ch.status = ?");
        values.push(filtros.status);
    }
    if (filtros.prioridade) {
        whereConditions.push("ch.prioridade = ?");
        values.push(filtros.prioridade);
    }
    if (filtros.assunto) {
        whereConditions.push("ch.assunto LIKE ?");
        values.push(`%${filtros.assunto}%`);
    }

    if (whereConditions.length > 0) {
        sql += " WHERE " + whereConditions.join(" AND ");
    }

    sql += " ORDER BY ch.created_at DESC";

    const [chamados] = await pool.query(sql, values);
    return chamados;
};

// Deleta um chamado
export const deleteById = async (id) => {
    const [result] = await pool.query('DELETE FROM Chamados WHERE id = ?', [id]);
    return result;
};

// Atualiza o status de um chamado
export const updateStatus = async (id, status) => {
    const sql = "UPDATE Chamados SET status = ? WHERE id = ?";
    const [result] = await pool.query(sql, [status, id]);
    return result;
};

// Atualiza prioridade
export const updatePrioridade = async (id, prioridade) => {
    const sql = "UPDATE Chamados SET prioridade = ? WHERE id = ?";
    const [result] = await pool.query(sql, [prioridade, id]);
    return result;
};