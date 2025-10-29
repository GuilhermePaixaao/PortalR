// Importa o cliente configurado
import openai from '../config/openai.js';

// Exporta a função 'handleChat' diretamente
export const handleChat = async (req, res) => {
    try {
        const history = req.body.history; // Pega o histórico do frontend

        if (!history) {
            return res.status(400).json({ error: 'Histórico não fornecido.' });
        }

        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo", // Ou o modelo que você usa
            messages: history,
        });

        const botReply = completion.choices[0].message.content;
        res.json({ reply: botReply });

    } catch (error) {
        console.error('Erro ao chamar API da OpenAI:', error);
        res.status(500).json({ error: 'Erro no servidor.' });
    }
};