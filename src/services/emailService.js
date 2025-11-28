// src/services/emailService.js
import nodemailer from 'nodemailer';

// --- CONFIGURAÇÃO "HARDCODED" PARA TESTE ---
// Estamos colocando os valores direto aqui para garantir que não é erro de variável
const transporter = nodemailer.createTransport({
    service: 'gmail', // O Nodemailer tem uma predefinição otimizada para Gmail
    auth: {
        user: process.env.EMAIL_USER, // Seu e-mail
        pass: process.env.EMAIL_PASS  // Sua senha de app (sem espaços!)
    },
    // Configurações de Debug para vermos tudo no log
    logger: true,
    debug: true
});

export const enviarNotificacaoCriacao = async (destinatario, chamado) => {
    try {
        console.log(`[Email] Iniciando envio para: ${destinatario}`);
        
        const info = await transporter.sendMail({
            from: process.env.EMAIL_FROM,
            to: destinatario,
            subject: `[Portal Rosalina] Chamado #${chamado.id} Criado`,
            text: `Olá ${chamado.nomeRequisitante}, seu chamado #${chamado.id} (${chamado.assunto}) foi criado com sucesso.`,
            html: `
                <div style="font-family: Arial, color: #333;">
                    <h2 style="color: #0056b3;">Olá, ${chamado.nomeRequisitante}!</h2>
                    <p>Seu chamado foi registrado.</p>
                    <p><strong>Ticket:</strong> #${chamado.id}</p>
                    <p><strong>Assunto:</strong> ${chamado.assunto}</p>
                    <hr>
                    <p><em>Portal Supermercado Rosalina</em></p>
                </div>
            `
        });
        console.log(`[Email] SUCESSO! ID da mensagem: ${info.messageId}`);
    } catch (error) {
        // Log detalhado do erro
        console.error("[Email] ERRO DETALHADO:", error);
    }
};

export const enviarNotificacaoStatus = async (destinatario, chamado, novoStatus) => {
    try {
        console.log(`[Email] Enviando atualização de status para: ${destinatario}`);
        
        const info = await transporter.sendMail({
            from: process.env.EMAIL_FROM,
            to: destinatario,
            subject: `[Atualização] Chamado #${chamado.id}: ${novoStatus}`,
            html: `
                <div style="font-family: Arial, color: #333;">
                    <h2>Status Atualizado</h2>
                    <p>O chamado <strong>#${chamado.id}</strong> agora está: <strong>${novoStatus}</strong></p>
                </div>
            `
        });
        console.log(`[Email] SUCESSO! Status enviado: ${info.messageId}`);
    } catch (error) {
        console.error("[Email] ERRO STATUS:", error);
    }
};