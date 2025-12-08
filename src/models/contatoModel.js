import pool from '../config/database.js';

/**
 * Salva ou atualiza um contato no histórico.
 * Se o contato já existir, atualiza o nome e a data da última interação.
 */
export const salvarContato = async (numero, nome, fotoUrl = null) => {
    // Garante que o número está limpo (apenas dígitos se preferires, ou mantém o remoteJid)
    // Aqui assumimos que 'numero' é o remoteJid (ex: 55129...@s.whatsapp.net)
    
    const sql = `
        INSERT INTO historico_contatos (telefone, nome_perfil, url_foto, ultima_interacao)
        VALUES (?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE 
            nome_perfil = VALUES(nome_perfil),
            ultima_interacao = NOW();
    `;
    
    // Se tiveres a coluna 'url_foto', adiciona ao update também se quiseres manter atualizado
    // url_foto = VALUES(url_foto),

    const [result] = await pool.query(sql, [numero, nome, fotoUrl]);
    return result;
};

/**
 * Lista os contatos para exibires no teu painel depois
 */
export const listarContatos = async () => {
    const [rows] = await pool.query('SELECT * FROM historico_contatos ORDER BY ultima_interacao DESC');
    return rows;
};