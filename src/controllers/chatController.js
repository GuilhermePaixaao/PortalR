// controllers/chatController.js

import openai from '../config/openai.js';

// O ID do seu assistente (correto!)
const MEU_ASSISTENTE_ID = "asst_XypLIE41vk9VgGDtIfkAEpOi";

/**
 * Função auxiliar para esperar o assistente terminar de "pensar".
 * A API de Assistentes não é instantânea.
 */
async function esperarRunCompletar(threadId, runId) {
    let run = await openai.beta.threads.runs.retrieve(threadId, runId);
    
    // Continua verificando o status a cada 1 segundo
    while (run.status === 'queued' || run.status === 'in_progress') {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Espera 1 seg
        run = await openai.beta.threads.runs.retrieve(threadId, runId);
    }
    
    // Se o status for 'failed' ou 'cancelled', joga um erro
    if (run.status !== 'completed') {
        throw new Error(`O Run do assistente falhou com status: ${run.status}`);
    }
    return run; // Retorna o 'run' completo
}


// --- ESTA É A SUA FUNÇÃO DE CHAT ATUALIZADA ---
export const handleChat = async (req, res) => {
    
    // O frontend agora envia a MENSAGEM ATUAL e o ID DA CONVERSA (threadId)
    const { message, threadId } = req.body; 

    if (!message) {
        return res.status(400).json({ error: 'Mensagem não fornecida.' });
    }

    try {
        // Passo 1: Determina o ID da Thread (a conversa)
        // Se o frontend não mandou um (threadId), nós criamos um novo
        const currentThreadId = threadId || (await openai.beta.threads.create()).id;

        // Passo 2: Adiciona a nova mensagem do usuário na Thread
        await openai.beta.threads.messages.create(
            currentThreadId,
            {
                role: "user",
                content: message // A mensagem do usuário
            }
        );

        // Passo 3: Roda o assistente usando o ID dele
        const run = await openai.beta.threads.runs.create(
            currentThreadId, // Diz em qual conversa ele deve rodar
            { 
                assistant_id: MEU_ASSISTENTE_ID // Diz qual assistente deve rodar
            }
        );

        // Passo 4: Espera o "run" completar (o assistente pensar)
        await esperarRunCompletar(currentThreadId, run.id);

        // Passo 5: Pega TODAS as mensagens da thread
        const messages = await openai.beta.threads.messages.list(currentThreadId);

        // Passo 6: Encontra a última resposta do assistente
        const botReply = messages.data
            .filter(msg => msg.role === 'assistant') // Filtra só as do assistente
            .map(msg => msg.content[0].text.value)   // Pega o texto
            .pop(); // Pega a última resposta

        // Passo 7: Envia a resposta E o threadId de volta para o frontend
        // O frontend precisa salvar o threadId para continuar a conversa
        res.json({ 
            reply: botReply || "Não obtive resposta do assistente.", 
            threadId: currentThreadId // Devolve o ID da conversa
        });

    } catch (error) {
        console.error('Erro ao chamar API de Assistentes:', error);
        res.status(500).json({ error: 'Erro no servidor.' });
    }
};