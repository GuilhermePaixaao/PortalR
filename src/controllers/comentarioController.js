// Substitua o conteúdo do seu comentarioController.js por isto:

// Use import (ESM) para buscar o model
import comentarioModel from '../models/comentarioModel.js'; // Ajuste o caminho

// Use 'export const' para criar uma exportação nomeada
export const addComentario = async (req, res) => {
    try {
        const { id } = req.params; // ID do chamado (da URL)
        const { texto, user_id } = req.body; // Dados (do fetch)

        // Validação
        if (!texto) {
            return res.status(400).json({ message: "O texto do comentário é obrigatório." });
        }
        if (!user_id) {
            return res.status(400).json({ message: "ID do usuário não fornecido." });
        }

        const dadosComentario = {
            texto: texto,
            chamado_id: parseInt(id, 10),
            user_id: parseInt(user_id, 10)
        };

        const novoComentario = await comentarioModel.create(dadosComentario);
        
        // Sucesso
        res.status(201).json(novoComentario);

    } catch (error) {
        console.error("Erro ao adicionar comentário:", error);
        res.status(500).json({ message: "Erro interno no servidor.", error: error.message });
    }
};
export const listarComentariosPorChamado = async (req, res) => {
    try {
        // Pega o ID do chamado pela URL (ex: /chamados/564/comentarios)
        const { id } = req.params;

        const comentarios = await comentarioModel.findByChamadoId(id);

        // Retorna a lista de comentários (pode ser uma lista vazia)
        res.status(200).json(comentarios);

    } catch (error) {
        console.error("Erro ao listar comentários:", error);
        res.status(500).json({ message: "Erro interno no servidor.", error: error.message });
    }
};