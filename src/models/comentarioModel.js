// Use import (ESM) para buscar a conexão
import pool from '../config/database.js'; // Ajuste o caminho para sua conexão

const comentarioModel = {
    create: async (dados) => {
        const { texto, chamado_id, user_id } = dados;

        if (!texto || !chamado_id || !user_id) {
            throw new Error("Dados insuficientes para criar comentário.");
        }

        // Use o nome da tabela com 'C' maiúsculo, como no seu banco
        const query = `
            INSERT INTO Comentarios (texto, chamado_id, user_id) 
            VALUES (?, ?, ?)
        `;
        
        const [result] = await pool.query(query, [texto, chamado_id, user_id]);
        
        return { id: result.insertId, ...dados };
    },

    // --- (NOVA FUNÇÃO ADICIONADA) ---
    /**
     * Busca todos os comentários de um chamado específico.
     * Ela também busca o nome do funcionário que comentou.
     */
    findByChamadoId: async (chamadoId) => {
        // Confirme os nomes das tabelas (Comentarios, Funcionario)
        const query = `
            SELECT 
                c.texto, 
                c.created_at,
                f.nomeFuncionario
            FROM 
                Comentarios c
            JOIN 
                Funcionario f ON c.user_id = f.id
            WHERE 
                c.chamado_id = ?
            ORDER BY 
                c.created_at ASC;
        `;
        
        const [comentarios] = await pool.query(query, [chamadoId]);
        return comentarios;
    }
};

// Use 'export default' (ESM)
export default comentarioModel;