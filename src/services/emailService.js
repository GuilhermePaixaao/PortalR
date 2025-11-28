// src/services/emailService.js
import { Resend } from 'resend';

// Inicializa com a chave que você colocou nas variáveis do Railway
const resend = new Resend(process.env.RESEND_API_KEY);

export const enviarNotificacaoCriacao = async (destinatario, chamado) => {
    try {
        console.log(`[Email] Iniciando envio via API Resend para: ${destinatario}`);
        
        const { data, error } = await resend.emails.send({
            // MANTENHA 'onboarding@resend.dev' se você não configurou domínio próprio (DNS)
            from: 'Portal Rosalina <onboarding@resend.dev>', 
            to: [destinatario],
            subject: `[Portal Rosalina] Chamado #${chamado.id} Criado`,
            html: `
                <div style="font-family: Arial, color: #333;">
                    <h2 style="color: #0056b3;">Olá, ${chamado.nomeRequisitante}!</h2>
                    <p>Seu chamado foi registrado com sucesso.</p>
                    <p><strong>Ticket:</strong> #${chamado.id}</p>
                    <p><strong>Assunto:</strong> ${chamado.assunto}</p>
                    <hr>
                    <p><em>Portal Supermercado Rosalina</em></p>
                </div>
            `
        });

        if (error) {
            console.error('[Email] Erro retornado pela API:', error);
            throw new Error(error.message);
        }

        console.log(`[Email] SUCESSO! ID Resend: ${data.id}`);
        return data;
    } catch (err) {
        console.error("[Email] FALHA AO ENVIAR:", err);
        // Não vamos travar a aplicação, apenas logar o erro
    }
};

export const enviarNotificacaoStatus = async (destinatario, chamado, novoStatus) => {
    try {
        console.log(`[Email] Atualizando status via API Resend para: ${destinatario}`);
        
        const { data, error } = await resend.emails.send({
            from: 'Portal Rosalina <onboarding@resend.dev>',
            to: [destinatario],
            subject: `[Atualização] Chamado #${chamado.id}: ${novoStatus}`,
            html: `
                <div style="font-family: Arial, color: #333;">
                    <h2>Status Atualizado</h2>
                    <p>O chamado <strong>#${chamado.id}</strong> agora está: <strong>${novoStatus}</strong></p>
                    <hr>
                    <p><em>Portal Supermercado Rosalina</em></p>
                </div>
            `
        });

        if (error) {
            console.error('[Email] Erro retornado pela API:', error);
            throw new Error(error.message);
        }

        console.log(`[Email] SUCESSO! ID Resend: ${data.id}`);
        return data;
    } catch (err) {
        console.error("[Email] FALHA AO ENVIAR:", err);
    }
};