import pool from '../config/database.js';

// Busca ou Cria a sessão do usuário
export const findOrCreateSession = async (numero, nomeContato) => {
    let [rows] = await pool.query('SELECT * FROM whatsapp_sessoes WHERE numero = ?', [numero]);
    
    if (rows.length === 0) {
        // Cria se não existir
        await pool.query(
            'INSERT INTO whatsapp_sessoes (numero, nome_contato, etapa, historico_ia) VALUES (?, ?, ?, ?)', 
            [numero, nomeContato, 'INICIO', '[]']
        );
        return { 
            numero, 
            nome_contato: nomeContato, 
            etapa: 'INICIO', 
            bot_pausado: 0, 
            historico_ia: [] 
        };
    }

    // Faz parse do histórico que vem como string do banco
    const sessao = rows[0];
    try {
        sessao.historico_ia = sessao.historico_ia ? JSON.parse(sessao.historico_ia) : [];
    } catch (e) {
        sessao.historico_ia = [];
    }
    
    // Converte tinyint (booleano do mysql) para boolean JS
    sessao.bot_pausado = !!sessao.bot_pausado;
    
    return sessao;
};

// Atualiza qualquer campo da sessão
export const updateSession = async (numero, dados) => {
    const campos = [];
    const valores = [];

    if (dados.etapa !== undefined) { campos.push('etapa = ?'); valores.push(dados.etapa); }
    if (dados.nome_agente !== undefined) { campos.push('nome_agente = ?'); valores.push(dados.nome_agente); }
    if (dados.bot_pausado !== undefined) { campos.push('bot_pausado = ?'); valores.push(dados.bot_pausado); }
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

// Limpa sessão (reseta para inicio ou deleta, dependendo da sua lógica. Aqui reseta)
export const resetSession = async (numero) => {
    await pool.query(
        "UPDATE whatsapp_sessoes SET etapa = 'INICIO', bot_pausado = 0, nome_agente = NULL, historico_ia = '[]' WHERE numero = ?", 
        [numero]
    );
};