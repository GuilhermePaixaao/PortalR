import pool from '../config/database.js';

// =================================================================
// 1. NOVAS FUNÇÕES PARA O FRONT-END (CASCATA)
// =================================================================

/**
 * Busca todas as lojas cadastradas para preencher o primeiro Select.
 */
export const getTodasLojas = async () => {
    const [rows] = await pool.query('SELECT * FROM Loja ORDER BY nome ASC');
    return rows;
};

/**
 * Busca os departamentos vinculados a uma loja específica.
 */
export const getDepartamentosPorLoja = async (lojaId) => {
    const sql = `
        SELECT d.id, d.nome 
        FROM Departamento d
        INNER JOIN loja_departamento ld ON d.id = ld.departamento_id
        WHERE ld.loja_id = ?
        ORDER BY d.nome ASC
    `;
    const [rows] = await pool.query(sql, [lojaId]);
    return rows;
};


// =================================================================
// 2. FUNÇÕES CRUD DE CHAMADOS (ATUALIZADAS PARA IDs)
// =================================================================

/**
 * (ATUALIZADO)
 * Cria um novo chamado salvando os IDs de Loja e Departamento.
 */
export const create = async (chamado) => {
    const { 
        assunto, descricao, prioridade, status, requisitanteIdNum, 
        categoriaUnificadaIdNum,
        nomeRequisitanteManual, emailRequisitanteManual, telefoneRequisitanteManual,
        loja_id, departamento_id 
    } = chamado; 

    const sql = `
        INSERT INTO Chamados 
            (assunto, descricao, prioridade, status, requisitante_id, 
             categoria_unificada_id,
             nome_requisitante_manual, email_requisitante_manual, telefone_requisitante_manual,
             loja_id, departamento_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const values = [
        assunto, 
        descricao, 
        prioridade, 
        status, 
        requisitanteIdNum, 
        categoriaUnificadaIdNum,
        nomeRequisitanteManual, 
        emailRequisitanteManual, 
        telefoneRequisitanteManual,
        loja_id || null,          // Salva o ID da loja (ou null)
        departamento_id || null   // Salva o ID do departamento (ou null)
    ];
    
    const [result] = await pool.query(sql, values);
    return result.insertId;
};

/**
 * (ATUALIZADO)
 * Busca um chamado por ID e faz os JOINs para trazer os NOMES da Loja e Departamento.
 */
export const findById = async (id) => {
    const sql = `
        SELECT 
            ch.*, 
            
            -- Dados do Requisitante
            COALESCE(ch.nome_requisitante_manual, f_req.nomeFuncionario) AS nomeRequisitante,
            ch.email_requisitante_manual AS emailRequisitante,
            ch.telefone_requisitante_manual AS telefoneRequisitante,
            
            -- Dados do Atendente
            f_atend.nomeFuncionario AS nomeAtendente, 
            
            -- Dados da Categoria
            cat.nome AS nomeCategoria,
            pai.nome AS nomeCategoriaPai,
            
            -- (NOVO) Traz o NOME da loja e departamento baseado no ID salvo
            l.nome AS loja,
            d.nome AS departamento
            
        FROM Chamados ch
        
        -- Joins Padrão
        LEFT JOIN Funcionario f_req ON ch.requisitante_id = f_req.id
        LEFT JOIN Funcionario f_atend ON ch.atendente_id = f_atend.id 
        LEFT JOIN Categorias cat ON ch.categoria_unificada_id = cat.id
        LEFT JOIN Categorias pai ON cat.parent_id = pai.id 
        
        -- (NOVO) Joins com tabelas de Loja e Departamento
        LEFT JOIN Loja l ON ch.loja_id = l.id
        LEFT JOIN Departamento d ON ch.departamento_id = d.id
        
        WHERE ch.id = ?
    `;
    const [rows] = await pool.query(sql, [id]);
    return rows[0];
};

/**
 * (ATUALIZADO)
 * Busca todos os chamados listando os nomes de Loja e Departamento.
 */
export const findAll = async (filtros = {}) => {
    let sql = `
        SELECT 
            ch.*, 
            COALESCE(ch.nome_requisitante_manual, f_req.nomeFuncionario) AS nomeRequisitante,
            ch.email_requisitante_manual AS emailRequisitante,
            ch.telefone_requisitante_manual AS telefoneRequisitante,
            f_atend.nomeFuncionario AS nomeAtendente, 
            cat.nome AS nomeCategoria,
            pai.nome AS nomeCategoriaPai,

            -- (NOVO) Nomes para exibição na lista
            l.nome AS loja,
            d.nome AS departamento

        FROM Chamados ch
        LEFT JOIN Funcionario f_req ON ch.requisitante_id = f_req.id
        LEFT JOIN Funcionario f_atend ON ch.atendente_id = f_atend.id 
        LEFT JOIN Categorias cat ON ch.categoria_unificada_id = cat.id
        LEFT JOIN Categorias pai ON cat.parent_id = pai.id

        -- (NOVO) Joins
        LEFT JOIN Loja l ON ch.loja_id = l.id
        LEFT JOIN Departamento d ON ch.departamento_id = d.id
    `;

    const values = [];
    const whereConditions = [];

    if (filtros.requisitante_id) {
        whereConditions.push("ch.requisitante_id = ?");
        values.push(parseInt(filtros.requisitante_id));
    }
    
    if (filtros.categoria_id) {
        whereConditions.push("(cat.id = ? OR cat.parent_id = ?)");
        values.push(parseInt(filtros.categoria_id));
        values.push(parseInt(filtros.categoria_id));
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

// =================================================================
// 3. FUNÇÕES RESTANTES (SEM MUDANÇAS DE LÓGICA)
// =================================================================

export const deleteById = async (id) => {
    await pool.query('DELETE FROM Comentarios WHERE chamado_id = ?', [id]);
    const [result] = await pool.query('DELETE FROM Chamados WHERE id = ?', [id]);
    return result;
};

export const updateStatus = async (id, status, atendenteId) => {
    let sql;
    let values;

    if (atendenteId) {
        sql = "UPDATE Chamados SET status = ?, atendente_id = ? WHERE id = ?";
        values = [status, atendenteId, id];
    } else {
        sql = "UPDATE Chamados SET status = ? WHERE id = ?";
        values = [status, id];
    }
    
    const [result] = await pool.query(sql, values);
    return result;
};

export const updatePrioridade = async (id, prioridade) => {
    const sql = "UPDATE Chamados SET prioridade = ? WHERE id = ?";
    const [result] = await pool.query(sql, [prioridade, id]);
    return result;
};

export const updateAtendente = async (id, atendenteId) => {
    const sql = "UPDATE Chamados SET atendente_id = ? WHERE id = ?";
    const [result] = await pool.query(sql, [atendenteId, id]);
    return result;
};

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