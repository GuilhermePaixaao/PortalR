import pool from '../config/database.js';

// Busca ou Cria a sessão do usuário
export const findOrCreateSession = async (numero, nomeContato) => {
    const [rows] = await pool.query('SELECT * FROM whatsapp_sessoes WHERE numero = ?', [numero]);
    
    if (rows.length === 0) {
        // Cria se não existir
        await pool.query(
            'INSERT INTO whatsapp_sessoes (numero, nome_contato, etapa, historico_ia, mostrar_na_fila) VALUES (?, ?, ?, ?, ?)', 
            [numero, nomeContato, 'INICIO', '[]', 0]
        );
        return { 
            numero, 
            nome_contato: nomeContato, 
            etapa: 'INICIO', 
            bot_pausado: false, 
            historico_ia: [],
            mostrar_na_fila: false,
            nome_agente: null
        };
    }

    const sessao = rows[0];
    try {
        sessao.historico_ia = sessao.historico_ia ? JSON.parse(sessao.historico_ia) : [];
    } catch (e) {
        sessao.historico_ia = [];
    }
    
    // Converte tinyint (0/1) para boolean (false/true)
    sessao.bot_pausado = !!sessao.bot_pausado;
    sessao.mostrar_na_fila = !!sessao.mostrar_na_fila;
    
    return sessao;
};

// Atualiza qualquer campo da sessão
export const updateSession = async (numero, dados) => {
    const campos = [];
    const valores = [];

    if (dados.etapa !== undefined) { campos.push('etapa = ?'); valores.push(dados.etapa); }
    if (dados.nome_agente !== undefined) { campos.push('nome_agente = ?'); valores.push(dados.nome_agente); }
    if (dados.bot_pausado !== undefined) { campos.push('bot_pausado = ?'); valores.push(dados.bot_pausado); }
    if (dados.mostrar_na_fila !== undefined) { campos.push('mostrar_na_fila = ?'); valores.push(dados.mostrar_na_fila); }
    if (dados.historico_ia !== undefined) { 
        campos.push('historico_ia = ?'); 
        valores.push(JSON.stringify(dados.historico_ia)); 
    }
    if (dados.ultimo_ticket_id !== undefined) { campos.push('ultimo_ticket_id = ?'); valores.push(dados.ultimo_ticket_id); }

    if (campos.length === 0) return;

    valores.push(numero);
    const sql = `UPDATE whatsapp_sessoes SET ${campos.join(', ')} WHERE numero = ?`;
    await pool.query(sql, valores);
};

// Conta quantas pessoas estão na fila
export const contarFila = async () => {
    const [rows] = await pool.query("SELECT COUNT(*) as total FROM whatsapp_sessoes WHERE etapa = 'FILA_ESPERA'");
    return rows[0].total;
};

// Reseta a sessão (quando finaliza atendimento)
export const resetSession = async (numero) => {
    await pool.query(
        "UPDATE whatsapp_sessoes SET etapa = 'INICIO', bot_pausado = 0, nome_agente = NULL, historico_ia = '[]', mostrar_na_fila = 0 WHERE numero = ?", 
        [numero]
    );
};

// [ESSA É A FUNÇÃO QUE FALTAVA E ESTÁ CAUSANDO O ERRO]
export const getAllSessions = async () => {
    const [rows] = await pool.query("SELECT * FROM whatsapp_sessoes");
    return rows;
};