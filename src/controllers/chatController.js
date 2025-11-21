// src/controllers/chatController.js
import openai from '../config/openai.js';

// Memória temporária para as conversas do site
// Ex: { "thread_123": [ { role: "user", content: "oi" } ] }
const chatSessions = {};

// Configuração do Modelo
const MODELO_IA = "llama3-8b-8192";

const SISTEMA_PROMPT = `
Você é o assistente virtual do Portal Supermercado.
Responda de forma prestativa, breve e profissional.
Você ajuda funcionários com dúvidas sobre chamados, impressoras e sistema.
`;

export const handleChat = async (req, res) => {
    const { message, threadId } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Mensagem não fornecida.' });
    }

    try {
        // 1. Gerencia o ID da Sessão (Thread)
        // Se não veio threadId, cria um novo ID usando Data + Número Aleatório (sem precisar de uuid)
        let currentThreadId = threadId || `thread_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

        // 2. Recupera ou Cria o Histórico
        if (!chatSessions[currentThreadId]) {
            chatSessions[currentThreadId] = [
                { role: "system", content: SISTEMA_PROMPT }
            ];
        }

        // 3. Adiciona a mensagem do usuário
        chatSessions[currentThreadId].push({ role: "user", content: message });

        // 4. Limita o histórico (últimas 10 mensagens para não estourar limite)
        if (chatSessions[currentThreadId].length > 12) {
            // Mantém o system (index 0) e pega as últimas 10
            const systemMsg = chatSessions[currentThreadId][0];
            const ultimas = chatSessions[currentThreadId].slice(-10);
            chatSessions[currentThreadId] = [systemMsg, ...ultimas];
        }

        // 5. Chama a Groq
        const completion = await openai.chat.completions.create({
            messages: chatSessions[currentThreadId],
            model: MODELO_IA,
            temperature: 0.5,
            max_tokens: 500
        });

        const botReply = completion.choices[0]?.message?.content || "Desculpe, não consegui processar sua resposta.";

        // 6. Adiciona a resposta ao histórico
        chatSessions[currentThreadId].push({ role: "assistant", content: botReply });

        // 7. Responde para o Frontend
        res.json({
            reply: botReply,
            threadId: currentThreadId
        });

    } catch (error) {
        console.error('[CHAT WEB] Erro:', error);
        res.status(500).json({ error: 'Erro interno no servidor de IA.' });
    }
};