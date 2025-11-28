// src/services/emailService.js
import nodemailer from 'nodemailer';

// --- CONFIGURAÇÃO ATUALIZADA PARA PORTA 465 (SSL) ---
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST, // smtp.gmail.com
    port: process.env.EMAIL_PORT, // Deve ser 465 no Railway
    secure: true, // <--- MUDANÇA IMPORTANTE: true para a porta 465
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    // Adiciona timeout para não ficar travado para sempre se falhar
    connectionTimeout: 10000, // 10 segundos
    greetingTimeout: 10000
});

export const enviarNotificacaoCriacao = async (destinatario, chamado) => {
    try {
        console.log(`[Email] Tentando conectar ao Gmail para enviar criação...`);
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
        console.log(`[Email] Sucesso! Criação enviada: ${info.messageId}`);
    } catch (error) {
        console.error("[Email] Erro CRÍTICO ao enviar notificação de criação:", error.message);
    }
};

export const enviarNotificacaoStatus = async (destinatario, chamado, novoStatus) => {
    try {
        console.log(`[Email] Tentando conectar ao Gmail para enviar status...`);
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
        console.log(`[Email] Sucesso! Status enviado: ${info.messageId}`);
    } catch (error) {
        console.error("[Email] Erro CRÍTICO ao enviar notificação de status:", error.message);
    }
};