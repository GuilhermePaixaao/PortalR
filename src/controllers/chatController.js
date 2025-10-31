import openai from '../config/openai.js';

// O ID do seu assistente
const MEU_ASSISTENTE_ID = process.env.OPENAI_ASSISTANT_ID || "asst_XypLIE41vk9VgGDtIfkAEpOi"; // (Recomendação: usar variável de ambiente)

/**
 * Função auxiliar para esperar o assistente terminar de "pensar".
 */
async function esperarRunCompletar(threadId, runId) {
    // ATUALIZADO AQUI (Formato de objeto)
    let run = await openai.beta.threads.runs.retrieve({
        thread_id: threadId,
        run_id: runId
    });
    
    // Continua verificando o status a cada 1 segundo
    while (run.status === 'queued' || run.status === 'in_progress') {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Espera 1 seg
        
        // ATUALIZADO AQUI (Formato de objeto)
        run = await openai.beta.threads.runs.retrieve({
            thread_id: threadId,
            run_id: runId
        });
    }
    
    // Se o status for 'failed' ou 'cancelled', joga um erro
    if (run.status !== 'completed') {
        console.error('Detalhes do Run falho:', run.last_error);
        throw new Error(`O Run do assistente falhou com status: ${run.status}`);
    }
    return run; // Retorna o 'run' completo
}


// --- ESTA É A SUA FUNÇÃO DE CHAT ATUALIZADA ---
export const handleChat = async (req, res) => {
    
    const { message, threadId } = req.body; 

    if (!message) {
        return res.status(400).json({ error: 'Mensagem não fornecida.' });
    }

    try {
        // Passo 1: Determina o ID da Thread
        const currentThreadId = threadId || (await openai.beta.threads.create()).id;

        // Passo 2: Adiciona a nova mensagem do usuário na Thread
        // ATUALIZADO AQUI (Formato de objeto)
        await openai.beta.threads.messages.create({
            thread_id: currentThreadId,
            role: "user",
            content: message // A mensagem do usuário
        });

        // Passo 3: Roda o assistente usando o ID dele
        // ATUALIZADO AQUI (Formato de objeto)
        const run = await openai.beta.threads.runs.create({
            thread_id: currentThreadId, // Diz em qual conversa ele deve rodar
            assistant_id: MEU_ASSISTENTE_ID // Diz qual assistente deve rodar
        });

        // Passo 4: Espera o "run" completar (o assistente pensar)
        // (A chamada para nossa função auxiliar não muda)
        await esperarRunCompletar(currentThreadId, run.id);

        // Passo 5: Pega TODAS as mensagens da thread
        // ATUALIZADO AQUI (Formato de objeto)
        const messages = await openai.beta.threads.messages.list({
            thread_id: currentThreadId
        });

        // Passo 6: Encontra a última resposta do assistente
        const botReply = messages.data[0]?.content[0]?.text?.value;

        // Passo 7: Envia a resposta E o threadId de volta para o frontend
        res.json({ 
            reply: botReply || "Não obtive resposta do assistente.", 
            threadId: currentThreadId // Devolve o ID da conversa
        });

    } catch (error) {
        console.error('Erro ao chamar API de Assistentes:', error);
        res.status(500).json({ error: 'Erro no servidor.' });
    }
};