// src/services/emailService.js
import nodemailer from 'nodemailer';

// --- CONFIGURAÇÃO CORRIGIDA PARA RAILWAY ---
const transporter = nodemailer.createTransport({
    // REMOVEMOS "service: 'gmail'" para ter controle total
    host: 'smtp.gmail.com', 
    port: 587, 
    secure: false, // false para porta 587 (STARTTLS)
    auth: {
        user: process.env.EMAIL_USER, 
        pass: process.env.EMAIL_PASS  
    },
    // --- AS CORREÇÕES VITAIS ABAIXO ---
    family: 4, // <--- OBRIGATÓRIO: Força o uso de IPv4 (evita o timeout)
    connectionTimeout: 10000, // 10s para desistir se não conectar
    greetingTimeout: 5000,    // 5s para esperar o "olá" do servidor
    tls: {
        rejectUnauthorized: false // Ajuda a evitar erros de certificado em container
    },
    logger: true,
    debug: true
});

export const enviarNotificacaoCriacao = async (destinatario, chamado) => {
    try {
        console.log(`[Email] Iniciando envio para: ${destinatario}`);
        
        const info = await transporter.sendMail({
            from: process.env.EMAIL_FROM || process.env.EMAIL_USER, // Fallback se EMAIL_FROM não existir
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
        return info; // É boa prática retornar o info
    } catch (error) {
        console.error("[Email] ERRO DETALHADO:", error);
        throw error; // Lança o erro para quem chamou a função saber que falhou
    }
};

export const enviarNotificacaoStatus = async (destinatario, chamado, novoStatus) => {
    try {
        console.log(`[Email] Enviando atualização de status para: ${destinatario}`);
        
        const info = await transporter.sendMail({
            from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
            to: destinatario,
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
        console.log(`[Email] SUCESSO! Status enviado: ${info.messageId}`);
        return info;
    } catch (error) {
        console.error("[Email] ERRO STATUS:", error);
        throw error;
    }
};