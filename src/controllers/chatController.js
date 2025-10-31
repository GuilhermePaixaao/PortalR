import openai from '../config/openai.js';

// O ID do seu assistente
const MEU_ASSISTENTE_ID = process.env.OPENAI_ASSISTENTE_ID || "asst_XypLIE41vk9VgGDtIfkAEpOi";

/**
 * Função auxiliar para esperar o assistente terminar de "pensar".
 */
async function esperarRunCompletar(threadId, runId) {
    if (!threadId) {
        throw new Error("threadId está undefined em esperarRunCompletar");
    }

    let run = await openai.beta.threads.runs.retrieve(threadId, runId);

    while (run.status === 'queued' || run.status === 'in_progress') {
        await new Promise(resolve => setTimeout(resolve, 1000));
        run = await openai.beta.threads.runs.retrieve(threadId, runId);
    }

    if (run.status !== 'completed') {
        console.error('Detalhes do Run falho:', run.last_error);
        throw new Error(`O Run do assistente falhou com status: ${run.status}`);
    }
    return run;
}

// --- ESTA É A SUA FUNÇÃO DE CHAT ATUALIZADA ---
export const handleChat = async (req, res) => {
    const { message, threadId } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Mensagem não fornecida.' });
    }

    try {
        // Garante que currentThreadId seja sempre string válida
        let currentThreadId = threadId;
        if (!currentThreadId) {
            const createdThread = await openai.beta.threads.create();
            currentThreadId = createdThread.id; // Pega só o ID, que é string
        }

        if (!currentThreadId) {
            throw new Error("Falha ao definir currentThreadId");
        }

        // Adiciona a nova mensagem do usuário na Thread
        await openai.beta.threads.messages.create(
            currentThreadId,
            {
                role: "user",
                content: message
            }
        );

        // Roda o assistente usando o ID dele
        const run = await openai.beta.threads.runs.create(
            currentThreadId,
            {
                assistant_id: MEU_ASSISTENTE_ID
            }
        );

        // Espera o "run" completar
        await esperarRunCompletar(currentThreadId, run.id);

        // Pega TODAS as mensagens da thread
        const messages = await openai.beta.threads.messages.list(
            currentThreadId
        );

        // Encontra a última resposta do assistente
        const botReply = messages.data[0]?.content[0]?.text?.value;

        // Envia a resposta E o threadId de volta para o frontend
        res.json({
            reply: botReply || "Não obtive resposta do assistente.",
            threadId: currentThreadId
        });

    } catch (error) {
        console.error('Erro ao chamar API de Assistentes:', error);
        res.status(500).json({ error: 'Erro no servidor.' });
    }
};
