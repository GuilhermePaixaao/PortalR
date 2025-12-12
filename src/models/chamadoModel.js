import pool from '../config/database.js';

// =================================================================
// 1. FUNÇÕES AUXILIARES (DADOS DINÂMICOS E CÁLCULOS)
// =================================================================

/**
 * Busca todas as lojas cadastradas para preencher o select.
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

/**
 * [NOVO] Calcula o tempo que o chamado ficou em cada status.
 * Requer a tabela 'chamado_status_historico'.
 */
export const getTemposChamado = async (chamadoId) => {
    const [chamado] = await pool.query('SELECT created_at, status FROM Chamados WHERE id = ?', [chamadoId]);
    if (!chamado.length) return null;
    
    const sqlHist = `SELECT * FROM chamado_status_historico WHERE chamado_id = ? ORDER BY data_alteracao ASC`;
    const [historico] = await pool.query(sqlHist, [chamadoId]);

    let tempoAberto = 0;     
    let tempoAndamento = 0; 
    
    let ultimoMarco = new Date(chamado[0].created_at);
    let statusAtualNoLoop = 'Aberto'; 

    for (const reg of historico) {
        const dataAlteracao = new Date(reg.data_alteracao);
        const diferenca = dataAlteracao - ultimoMarco;

        if (statusAtualNoLoop === 'Aberto') {
            tempoAberto += diferenca;
        } else if (statusAtualNoLoop === 'Em Andamento') {
            tempoAndamento += diferenca;
        }

        ultimoMarco = dataAlteracao;
        statusAtualNoLoop = reg.status_novo;
    }

    if (statusAtualNoLoop !== 'Concluído') {
        const agora = new Date();
        const diferenca = agora - ultimoMarco;
        
        if (statusAtualNoLoop === 'Aberto') tempoAberto += diferenca;
        if (statusAtualNoLoop === 'Em Andamento') tempoAndamento += diferenca;
    }

    const formatarTempo = (ms) => {
        if (ms <= 0) return "0m";
        const minutos = Math.floor((ms / (1000 * 60)) % 60);
        const horas = Math.floor((ms / (1000 * 60 * 60)) % 24);
        const dias = Math.floor(ms / (1000 * 60 * 60 * 24));
        
        let resultado = "";
        if (dias > 0) resultado += `${dias}d `;
        if (horas > 0) resultado += `${horas}h `;
        resultado += `${minutos}m`;
        return resultado;
    };

    return {
        tempoAbertoMs: tempoAberto,
        tempoAndamentoMs: tempoAndamento,
        tempoAbertoFormatado: formatarTempo(tempoAberto),
        tempoAndamentoFormatado: formatarTempo(tempoAndamento)
    };
};


// =================================================================
// 2. FUNÇÕES CRUD DE CHAMADOS
// =================================================================

/**
 * Cria um novo chamado salvando os IDs de Loja, Departamento e agora ATENDENTE.
 */
export const create = async (chamado) => {
    const { 
        assunto, descricao, prioridade, status, requisitanteIdNum, 
        categoriaUnificadaIdNum,
        nomeRequisitanteManual, emailRequisitanteManual, telefoneRequisitanteManual,
        loja_id, departamento_id, atendenteId 
    } = chamado; 

    // [CORREÇÃO] Adicionada a coluna atendente_id no INSERT
    const sql = `
        INSERT INTO Chamados 
            (assunto, descricao, prioridade, status, requisitante_id, 
             categoria_unificada_id,
             nome_requisitante_manual, email_requisitante_manual, telefone_requisitante_manual,
             loja_id, departamento_id, atendente_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        loja_id || null,          
        departamento_id || null,
        atendenteId || null // Passa o ID do Daniel (ou null)
    ];
    
    const [result] = await pool.query(sql, values);
    return result.insertId;
};

/**
 * Busca um chamado por ID e faz os JOINs para trazer os NOMES da Loja e Departamento.
 */
export const findById = async (id) => {
    const sql = `
        SELECT 
            ch.*, 
            COALESCE(ch.nome_requisitante_manual, f_req.nomeFuncionario) AS nomeRequisitante,
            ch.email_requisitante_manual AS emailRequisitante,
            ch.telefone_requisitante_manual AS telefoneRequisitante,
            f_atend.nomeFuncionario AS nomeAtendente, 
            f_atend.email AS emailAtendente,
            cat.nome AS nomeCategoria,
            pai.nome AS nomeCategoriaPai,
            l.nome AS loja,
            d.nome AS departamento
            
        FROM Chamados ch
        LEFT JOIN Funcionario f_req ON ch.requisitante_id = f_req.id
        LEFT JOIN Funcionario f_atend ON ch.atendente_id = f_atend.id 
        LEFT JOIN Categorias cat ON ch.categoria_unificada_id = cat.id
        LEFT JOIN Categorias pai ON cat.parent_id = pai.id 
        LEFT JOIN Loja l ON ch.loja_id = l.id
        LEFT JOIN Departamento d ON ch.departamento_id = d.id
        
        WHERE ch.id = ?
    `;
    const [rows] = await pool.query(sql, [id]);
    return rows[0];
};

/**
 * Busca todos os chamados com filtros opcionais.
 */
export const findAll = async (filtros = {}) => {
    let sql = `
        SELECT 
            ch.*, 
            COALESCE(ch.nome_requisitante_manual, f_req.nomeFuncionario) AS nomeRequisitante,
            ch.email_requisitante_manual AS emailRequisitante,
            ch.telefone_requisitante_manual AS telefoneRequisitante,
            f_atend.nomeFuncionario AS nomeAtendente, 
            f_atend.email AS emailAtendente,
            cat.nome AS nomeCategoria,
            pai.nome AS nomeCategoriaPai,
            l.nome AS loja,
            d.nome AS departamento

        FROM Chamados ch
        LEFT JOIN Funcionario f_req ON ch.requisitante_id = f_req.id
        LEFT JOIN Funcionario f_atend ON ch.atendente_id = f_atend.id 
        LEFT JOIN Categorias cat ON ch.categoria_unificada_id = cat.id
        LEFT JOIN Categorias pai ON cat.parent_id = pai.id
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
    
    if (filtros.loja_id) {
        whereConditions.push("ch.loja_id = ?");
        values.push(parseInt(filtros.loja_id));
    }

    // Filtro de Operador (Atendente)
    if (filtros.atendente_id) {
        whereConditions.push("ch.atendente_id = ?");
        values.push(parseInt(filtros.atendente_id));
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
// 3. FUNÇÕES DE UPDATE E DELETE
// =================================================================

export const deleteById = async (id) => {
    await pool.query('DELETE FROM Comentarios WHERE chamado_id = ?', [id]);
    const [result] = await pool.query('DELETE FROM Chamados WHERE id = ?', [id]);
    return result;
};

/**
 * Atualiza o status do chamado e registra no histórico.
 */
export const updateStatus = async (id, status, atendenteId) => {
    const [rows] = await pool.query('SELECT status FROM Chamados WHERE id = ?', [id]);
    const statusAnterior = rows[0] ? rows[0].status : null;

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

    if (result.affectedRows > 0 && statusAnterior && statusAnterior !== status) {
        try {
            await pool.query(
                'INSERT INTO chamado_status_historico (chamado_id, status_anterior, status_novo) VALUES (?, ?, ?)',
                [id, statusAnterior, status]
            );
        } catch (error) {
            console.error("Erro ao salvar histórico:", error);
        }
    }

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

export const updateCategoria = async (id, categoriaId) => {
    const sql = "UPDATE Chamados SET categoria_unificada_id = ? WHERE id = ?";
    const [result] = await pool.query(sql, [categoriaId, id]);
    return result;
};

export const updateAssunto = async (id, assunto) => {
    const sql = "UPDATE Chamados SET assunto = ? WHERE id = ?";
    const [result] = await pool.query(sql, [assunto, id]);
    return result;
};

export const updateDescricao = async (id, descricao) => {
    const sql = "UPDATE Chamados SET descricao = ? WHERE id = ?";
    const [result] = await pool.query(sql, [descricao, id]);
    return result;
};

export const updateRequisitante = async (id, requisitanteId) => {
    const sql = "UPDATE Chamados SET requisitante_id = ?, nome_requisitante_manual = NULL, email_requisitante_manual = NULL, telefone_requisitante_manual = NULL WHERE id = ?";
    const [result] = await pool.query(sql, [requisitanteId, id]);
    return result;
};

export const updateLojaDepartamento = async (id, lojaId, departamentoId) => {
    const sql = "UPDATE Chamados SET loja_id = ?, departamento_id = ? WHERE id = ?";
    const [result] = await pool.query(sql, [lojaId, departamentoId, id]);
    return result;
};