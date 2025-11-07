// Substitua o conteúdo do seu comentarioModel.js por isto:

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
    }
};

// Use 'export default' (ESM)
export default comentarioModel;