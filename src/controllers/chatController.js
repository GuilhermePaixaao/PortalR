// controllers/chatController.js

import openai from '../config/openai.js';

// Nota: a SDK marca a API de Assistants/Threads como deprecated.
// Aqui migramos o fluxo para a Responses API (recomendado).

// --- Função de chat usando Responses API ---
export const handleChat = async (req, res) => {
    const { message, threadId } = req.body;
    if (!message) return res.status(400).json({ error: 'Mensagem não fornecida.' });

    try {
        // Monta o payload para a Responses API
        const payload = {
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            input: message
        };

        // Algumas versões/implementações aceitam passar o id da conversa
        if (threadId) {
            // Campo 'conversation' ou 'conversation_id' pode variar entre versões; tentamos a forma mais comum
            payload.conversation = { id: threadId };
        }

        const response = await openai.responses.create(payload);

        // Extrai o texto da resposta de forma defensiva (várias formas retornadas pela SDK)
        let botReply = null;
        if (response.output_text) {
            botReply = response.output_text;
        } else if (response.output && Array.isArray(response.output)) {
            // Junta possíveis blocos de conteúdo
            botReply = response.output
                .map(item => {
                    if (item.content && Array.isArray(item.content)) {
                        return item.content.map(c => c.text || c?.text?.value || '').join(' ');
                    }
                    return item.text || '';
                })
                .join('\n')
                .trim();
        } else if (response.output && response.output[0] && response.output[0].content && response.output[0].content[0]) {
            botReply = response.output[0].content[0].text || response.output[0].content[0].text?.value;
        }

        // A Responses API pode retornar um id de conversa em 'conversation.id' ou usar 'id' no próprio objeto
        const newThreadId = response.conversation?.id || response.id || threadId || null;

        res.json({ reply: botReply || 'Não obtive resposta do assistente.', threadId: newThreadId });
    } catch (error) {
        console.error('Erro ao chamar Responses API:', error);
        res.status(500).json({ error: 'Erro no servidor.' });
    }
};