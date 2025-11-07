const comentarioModel = require('../models/comentarioModel'); // Ajuste o caminho

const comentarioController = {
    /**
     * Adiciona um novo comentário a um chamado específico.
     */
    addComentario: async (req, res) => {
        try {
            // Pegamos o ID do chamado pela URL (ex: /chamados/564/comentarios)
            const { id } = req.params; 

            // Pegamos o texto e o user_id do corpo (body) da requisição
            const { texto, user_id } = req.body;

            // Verificação simples
            if (!texto) {
                return res.status(400).json({ message: "O texto do comentário é obrigatório." });
            }
            if (!user_id) {
                return res.status(400).json({ message: "ID do usuário não fornecido." });
            }

            // Monta o objeto de dados para o Model
            const dadosComentario = {
                texto: texto,
                chamado_id: parseInt(id, 10), // ID da URL
                user_id: parseInt(user_id, 10) // ID do body
            };

            // Chama o Model para salvar no banco
            const novoComentario = await comentarioModel.create(dadosComentario);

            // Retorna o comentário criado com sucesso (status 201)
            res.status(201).json(novoComentario);

        } catch (error) {
            console.error("Erro ao adicionar comentário:", error);
            res.status(500).json({ message: "Erro interno no servidor.", error: error.message });
        }
    }
};

module.exports = comentarioController;