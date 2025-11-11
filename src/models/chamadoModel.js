import pool from '../config/database.js';

/**
 * (ATUALIZADO)
 * Cria um novo chamado usando a 'categoria_unificada_id'.
 */
export const create = async (chamado) => {
    const { 
        assunto, descricao, prioridade, status, requisitanteIdNum, 
        categoriaUnificadaIdNum, // <-- CAMPO NOVO
        nomeRequisitanteManual, emailRequisitanteManual, telefoneRequisitanteManual 
    } = chamado; 

    // Removemos 'categoria_id' e 'subcategoria_id' do SQL
    const sql = `
        INSERT INTO Chamados 
            (assunto, descricao, prioridade, status, requisitante_id, 
             categoria_unificada_id,
             nome_requisitante_manual, email_requisitante_manual, telefone_requisitante_manual)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const values = [
        assunto, 
        descricao, 
        prioridade, 
        status, 
        requisitanteIdNum, 
        categoriaUnificadaIdNum, // <-- VALOR NOVO
        nomeRequisitanteManual, 
        emailRequisitanteManual, 
        telefoneRequisitanteManual
    ];
    
    const [result] = await pool.query(sql, values);
    return result.insertId;
};

/**
 * (ATUALIZADO)
 * Busca um chamado por ID e faz o JOIN com a categoria (e sua categoria-pai).
 */
export const findById = async (id) => {
    // Trocamos os JOINS de categoria/subcategoria
    const sql = `
        SELECT 
            ch.*, 
            
            -- Dados do Requisitante
            COALESCE(ch.nome_requisitante_manual, f_req.nomeFuncionario) AS nomeRequisitante,
            ch.email_requisitante_manual AS emailRequisitante,
            ch.telefone_requisitante_manual AS telefoneRequisitante,
            
            -- Dados do Atendente (Operador)
            f_atend.nomeFuncionario AS nomeAtendente, 
            
            -- (NOVO) Dados da Categoria Unificada
            cat.nome AS nomeCategoria,
            pai.nome AS nomeCategoriaPai
            
        FROM Chamados ch
        
        -- Join para Requisitante
        LEFT JOIN Funcionario f_req ON ch.requisitante_id = f_req.id
        
        -- Join para Atendente
        LEFT JOIN Funcionario f_atend ON ch.atendente_id = f_atend.id 
        
        -- (NOVO) Joins para Categoria Unificada
        LEFT JOIN Categorias cat ON ch.categoria_unificada_id = cat.id
        LEFT JOIN Categorias pai ON cat.parent_id = pai.id 
        
        WHERE ch.id = ?
    `;
    const [rows] = await pool.query(sql, [id]);
    return rows[0];
};

/**
 * (ATUALIZADO)
 * Busca todos os chamados com a nova lógica de JOIN e Filtro.
 */
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

            -- (NOVO) Dados da Categoria Unificada
            cat.nome AS nomeCategoria,
            pai.nome AS nomeCategoriaPai
            
        FROM Chamados ch

        -- Join para Requisitante
        LEFT JOIN Funcionario f_req ON ch.requisitante_id = f_req.id
        
        -- Join para Atendente
        LEFT JOIN Funcionario f_atend ON ch.atendente_id = f_atend.id 

        -- (NOVO) Joins para Categoria Unificada
        LEFT JOIN Categorias cat ON ch.categoria_unificada_id = cat.id
        LEFT JOIN Categorias pai ON cat.parent_id = pai.id
    `;

    const values = [];
    const whereConditions = [];

    if (filtros.requisitante_id) {
        whereConditions.push("ch.requisitante_id = ?");
        values.push(parseInt(filtros.requisitante_id));
    }
    
    // (MODIFICADO) Lógica do filtro de categoria
    if (filtros.categoria_id) {
        // Esta query filtra PELA CATEGORIA PAI ou PELA PRÓPRIA CATEGORIA
        // (Ex: se filtrar por "TI", pega chamados de "TI" e "Redes")
        whereConditions.push("(cat.id = ? OR cat.parent_id = ?)");
        values.push(parseInt(filtros.categoria_id));
        values.push(parseInt(filtros.categoria_id));
    }
    // (REMOVIDO) Filtro de subcategoria_id
    
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

// --- Funções restantes (sem mudanças) ---

// Deleta um chamado
export const deleteById = async (id) => {
    const [result] = await pool.query('DELETE FROM Chamados WHERE id = ?', [id]);
    return result;
};

// ATUALIZAR STATUS
export const updateStatus = async (id, status, atendenteId) => {
    let sql;
    let values;

    if (atendenteId) {
        sql = "UPDATE Chamados SET status = ?, atendente_id = ? WHERE id = ?";
        values = [status, atendenteId, id];
    } else {
        sql = "UPDATE Chamados SET status = ?, atendente_id = NULL WHERE id = ?";
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

// ATUALIZAR SÓ O ATENDENTE
export const updateAtendente = async (id, atendenteId) => {
    const sql = "UPDATE Chamados SET atendente_id = ? WHERE id = ?";
    const [result] = await pool.query(sql, [atendenteId, id]);
    return result;
};

// CONTAR POR STATUS
export const countByStatus = async () => {
    const sql = `
        SELECT 
            status, 
            COUNT(id) as count
        FROM 
            Chamados
        GROUP BY 
            status;
    `;
    const [rows] = await pool.query(sql);
    return rows; 
};