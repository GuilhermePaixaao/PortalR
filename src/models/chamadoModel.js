import pool from '../config/database.js';

// Cria um novo chamado
export const create = async (chamado) => {
    // Adicionadas as novas variáveis
    const { assunto, descricao, prioridade, status, requisitanteIdNum, categoriaIdNum, 
            nomeRequisitanteManual, emailRequisitanteManual, telefoneRequisitanteManual } = chamado; 

    // O SQL precisa incluir as novas colunas e valores
    const sql = `
        INSERT INTO Chamados (assunto, descricao, prioridade, status, requisitante_id, categoria_id, 
                              nome_requisitante_manual, email_requisitante_manual, telefone_requisitante_manual)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const values = [
        assunto, 
        descricao, 
        prioridade, 
        status, 
        requisitanteIdNum, 
        categoriaIdNum,
        // Novos valores
        nomeRequisitanteManual, 
        emailRequisitanteManual, 
        telefoneRequisitanteManual
    ];
    
    const [result] = await pool.query(sql, values);
    return result.insertId;
};

// Busca um chamado pelo ID
export const findById = async (id) => {
    const [rows] = await pool.query('SELECT * FROM Chamados WHERE id = ?', [id]);
    return rows[0];
};

// Busca todos os chamados com filtros opcionais
export const findAll = async (filtros = {}) => {
    let sql = `
        SELECT 
            ch.*, 
            -- O nome ainda usa COALESCE, assumindo que Funcionario tem 'nomeFuncionario'
            COALESCE(ch.nome_requisitante_manual, f.nomeFuncionario) AS nomeRequisitante,
            
            -- CORREÇÃO: Busca email e telefone APENAS dos campos manuais da tabela Chamados (ch)
            ch.email_requisitante_manual AS emailRequisitante,
            ch.telefone_requisitante_manual AS telefoneRequisitante,
            
            ca.nome AS nomeCategoria
        FROM Chamados ch
        -- Usamos LEFT JOIN para que funcione mesmo se requisitante_id for NULL ou inválido
        LEFT JOIN Funcionario f ON ch.requisitante_id = f.id
        LEFT JOIN Categorias ca ON ch.categoria_id = ca.id
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