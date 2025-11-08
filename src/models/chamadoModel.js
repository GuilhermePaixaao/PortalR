import pool from '../config/database.js';

// Cria um novo chamado (com subcategoria_id)
export const create = async (chamado) => {
    const { 
        assunto, descricao, prioridade, status, requisitanteIdNum, categoriaIdNum, 
        subcategoriaIdNum, 
        nomeRequisitanteManual, emailRequisitanteManual, telefoneRequisitanteManual 
    } = chamado; 

    const sql = `
        INSERT INTO Chamados 
            (assunto, descricao, prioridade, status, requisitante_id, categoria_id, 
             subcategoria_id,
             nome_requisitante_manual, email_requisitante_manual, telefone_requisitante_manual)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const values = [
        assunto, 
        descricao, 
        prioridade, 
        status, 
        requisitanteIdNum, 
        categoriaIdNum,
        subcategoriaIdNum, 
        nomeRequisitanteManual, 
        emailRequisitanteManual, 
        telefoneRequisitanteManual
    ];
    
    const [result] = await pool.query(sql, values);
    return result.insertId;
};

// ====================================================
// ======== BUSCAR CHAMADO POR ID (MODIFICADO) ========
// ====================================================
export const findById = async (id) => {
    const sql = `
        SELECT 
            ch.*, 
            
            -- Dados do Requisitante
            COALESCE(ch.nome_requisitante_manual, f_req.nomeFuncionario) AS nomeRequisitante,
            ch.email_requisitante_manual AS emailRequisitante,
            ch.telefone_requisitante_manual AS telefoneRequisitante,
            
            -- Dados do Atendente (Operador)
            f_atend.nomeFuncionario AS nomeAtendente, 
            
            -- Dados da Categoria/Subcategoria
            ca.nome AS nomeCategoria,
            subcat.nome AS nomeSubcategoria
            
        FROM Chamados ch
        
        -- Join para Requisitante
        LEFT JOIN Funcionario f_req ON ch.requisitante_id = f_req.id
        
        -- Join para Atendente (NOVO)
        LEFT JOIN Funcionario f_atend ON ch.atendente_id = f_atend.id 
        
        -- Joins para Categoria/Subcategoria
        LEFT JOIN Categorias ca ON ch.categoria_id = ca.id
        LEFT JOIN Subcategorias subcat ON ch.subcategoria_id = subcat.id 
        
        WHERE ch.id = ?
    `;
    const [rows] = await pool.query(sql, [id]);
    return rows[0];
};

// ====================================================
// ======== BUSCAR TODOS (MODIFICADO) ========
// ====================================================
export const findAll = async (filtros = {}) => {
    let sql = `
        SELECT 
            ch.*, 
            
            -- Dados do Requisitante
            COALESCE(ch.nome_requisitante_manual, f_req.nomeFuncionario) AS nomeRequisitante,
            ch.email_requisitante_manual AS emailRequisitante,
            ch.telefone_requisitante_manual AS telefoneRequisitante,
            
            -- Dados do Atendente (Operador)
            f_atend.nomeFuncionario AS nomeAtendente, 

            -- Dados da Categoria/Subcategoria
            ca.nome AS nomeCategoria,
            subcat.nome AS nomeSubcategoria
            
        FROM Chamados ch

        -- Join para Requisitante
        LEFT JOIN Funcionario f_req ON ch.requisitante_id = f_req.id
        
        -- Join para Atendente (NOVO)
        LEFT JOIN Funcionario f_atend ON ch.atendente_id = f_atend.id 

        -- Joins para Categoria/Subcategoria
        LEFT JOIN Categorias ca ON ch.categoria_id = ca.id
        LEFT JOIN Subcategorias subcat ON ch.subcategoria_id = subcat.id
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
    if (filtros.subcategoria_id) { 
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

// ====================================================
// ======== ATUALIZAR STATUS (MODIFICADO) ========
// ====================================================
export const updateStatus = async (id, status, atendenteId) => {
    let sql;
    let values;

    if (atendenteId) {
        // Se um atendenteId é fornecido, atualiza o status E o atendente
        sql = "UPDATE Chamados SET status = ?, atendente_id = ? WHERE id = ?";
        values = [status, atendenteId, id];
    } else {
        // Se não, atualiza apenas o status
        sql = "UPDATE Chamados SET status = ? WHERE id = ?";
        values = [status, id];
    }
    
    const [result] = await pool.query(sql, values);
    return result;
};

// Atualiza prioridade
export const updatePrioridade = async (id, prioridade) => {
    const sql = "UPDATE Chamados SET prioridade = ? WHERE id = ?";
    const [result] = await pool.query(sql, [prioridade, id]);
    return result;
};

// ====================================================
// ======== (NOVO) ATUALIZAR SÓ O ATENDENTE ========
// ====================================================
export const updateAtendente = async (id, atendenteId) => {
    // Permite definir como NULL (Não Atribuído)
    const sql = "UPDATE Chamados SET atendente_id = ? WHERE id = ?";
    const [result] = await pool.query(sql, [atendenteId, id]);
    return result;
};