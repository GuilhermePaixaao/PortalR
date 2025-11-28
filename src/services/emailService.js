// src/services/emailService.js
import nodemailer from 'nodemailer';

// Cria o transportador usando as variáveis do Railway
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false, // Geralmente false para porta 587
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// =====================================================================
// NOME CORRIGIDO: enviarNotificacaoCriacao (Para bater com o Controller)
// =====================================================================
export const enviarNotificacaoCriacao = async (destinatario, chamado) => {
    try {
        const info = await transporter.sendMail({
            from: process.env.EMAIL_FROM,
            to: destinatario,
            subject: `[Portal Rosalina] Chamado #${chamado.id} Criado - ${chamado.assunto}`,
            html: `
                <div style="font-family: Arial, sans-serif; color: #333;">
                    <h2 style="color: #0d6efd;">Olá, ${chamado.nomeRequisitante}!</h2>
                    <p>Recebemos seu chamado com sucesso.</p>
                    <hr>
                    <p><strong>Ticket:</strong> #${chamado.id}</p>
                    <p><strong>Assunto:</strong> ${chamado.assunto}</p>
                    <p><strong>Status:</strong> ${chamado.status}</p>
                    <p><strong>Prioridade:</strong> ${chamado.prioridade}</p>
                    <p><strong>Descrição:</strong> ${chamado.descricao}</p>
                    <br>
                    <p>Você será notificado a cada atualização de status.</p>
                    <p><em>Portal Supermercado Rosalina</em></p>
                </div>
            `
        });
        console.log(`[Email] Notificação de criação enviada para ${destinatario}: ${info.messageId}`);
    } catch (error) {
        console.error("[Email] Erro ao enviar notificação de criação:", error);
        // Não lançamos o erro novamente para não travar o fluxo do chamado
    }
};

// =====================================================================
// NOME CORRIGIDO: enviarNotificacaoStatus (Para bater com o Controller)
// =====================================================================
export const enviarNotificacaoStatus = async (destinatario, chamado, novoStatus) => {
    try {
        let corStatus = '#333';
        if (novoStatus === 'Concluído') corStatus = 'green';
        if (novoStatus === 'Em Andamento') corStatus = 'blue';
        if (novoStatus === 'Pausado') corStatus = 'orange';

        const info = await transporter.sendMail({
            from: process.env.EMAIL_FROM,
            to: destinatario,
            subject: `[Atualização] Chamado #${chamado.id} mudou para: ${novoStatus}`,
            html: `
                <div style="font-family: Arial, sans-serif; color: #333;">
                    <h2>Atualização de Chamado</h2>
                    <p>O status do seu chamado <strong>#${chamado.id}</strong> foi alterado.</p>
                    <div style="padding: 15px; background-color: #f8f9fa; border-left: 5px solid ${corStatus};">
                        <p><strong>Novo Status:</strong> <span style="color: ${corStatus}; font-weight: bold;">${novoStatus}</span></p>
                        <p><strong>Assunto:</strong> ${chamado.assunto}</p>
                    </div>
                    <br>
                    <p>Acesse o Portal para ver mais detalhes.</p>
                    <p><em>Portal Supermercado Rosalina</em></p>
                </div>
            `
        });
        console.log(`[Email] Notificação de status enviada para ${destinatario}: ${info.messageId}`);
    } catch (error) {
        console.error("[Email] Erro ao enviar notificação de status:", error);
    }
};