// Assumindo que você tem um arquivo de conexão com o banco (ex: db.js ou pool.js)
const pool = require('../config/db'); // Ajuste o caminho para sua conexão

const comentarioModel = {
    /**
     * Cria um novo comentário no banco de dados.
     * @param {object} dados - Contém { texto, chamado_id, user_id }
     */
    create: async (dados) => {
        const { texto, chamado_id, user_id } = dados;

        // Validação básica
        if (!texto || !chamado_id || !user_id) {
            throw new Error("Dados insuficientes para criar comentário.");
        }

        const query = `
            INSERT INTO comentarios (texto, chamado_id, user_id) 
            VALUES (?, ?, ?)
        `;
        
        // O seu frontend envia o user_id (requisitante_id) no corpo da requisição
        const [result] = await pool.query(query, [texto, chamado_id, user_id]);
        
        return { id: result.insertId, ...dados };
    }
};

module.exports = comentarioModel;