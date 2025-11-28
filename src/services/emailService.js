import nodemailer from 'nodemailer';

// --- PALETA DE CORES ROSALINA ---
const CORES = {
    fundo: '#f4f4f7',       // Cinza claro fundo
    card: '#ffffff',        // Branco card
    texto: '#333333',       // Texto padrão
    primaria: '#3b4a9c',    // AZUL ROSALINA (Cabeçalho)
    secundaria: '#e31c23',  // VERMELHO ROSALINA (Destaques)
    borda: '#eaeaec'
};

// Configuração do Nodemailer (Gmail)
// Usa as variáveis já configuradas no Railway
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    logger: true,
    debug: true
});

// --- HELPER: Gera o HTML do E-mail (Reutilizável) ---
const gerarHtmlRosalina = (titulo, mensagemPrincipal, detalhesChamado) => {
    // Formata a data para exibir bonito no e-mail
    const dataFormatada = new Date(detalhesChamado.created_at || new Date()).toLocaleString('pt-BR');

    return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="background-color: ${CORES.fundo}; font-family: sans-serif; padding: 40px 0; margin: 0;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0">
            <tr>
                <td align="center">
                    <div style="margin-bottom: 20px;">
                       <h2 style="color: ${CORES.primaria}; margin: 0;">ROSALINA SUPERMERCADOS</h2>
                    </div>

                    <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: ${CORES.card}; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                        
                        <tr>
                            <td style="background-color: ${CORES.primaria}; padding: 25px; text-align: center; border-bottom: 4px solid ${CORES.secundaria};">
                                <h1 style="color: #ffffff; margin: 0; font-size: 24px;">${titulo}</h1>
                            </td>
                        </tr>

                        <tr>
                            <td style="padding: 40px 30px;">
                                <p style="color: ${CORES.texto}; font-size: 16px; margin-bottom: 20px;">
                                    ${mensagemPrincipal}
                                </p>

                                <table width="100%" style="background-color: #f8f9fa; border-left: 5px solid ${CORES.secundaria}; margin-top: 20px; font-size: 14px; color: #555;">
                                    <tr>
                                        <td style="padding: 20px;">
                                            <p style="margin: 5px 0;"><strong>Ticket ID:</strong> #${detalhesChamado.id}</p>
                                            <p style="margin: 5px 0;"><strong>Assunto:</strong> ${detalhesChamado.assunto}</p>
                                            <p style="margin: 5px 0;"><strong>Data:</strong> ${dataFormatada}</p>
                                            <p style="margin: 5px 0;"><strong>Prioridade:</strong> ${detalhesChamado.prioridade}</p>
                                            
                                            <p style="margin: 5px 0; font-size: 16px;">
                                                <strong>Status Atual:</strong> 
                                                <span style="color:${CORES.primaria}; font-weight:bold; text-transform:uppercase;">${detalhesChamado.status}</span>
                                            </p>
                                            
                                            <hr style="border: 0; border-top: 1px solid #ddd; margin: 15px 0;">
                                            
                                            <p style="margin: 0 0 5px 0; font-size: 12px; color: #999; text-transform: uppercase;">Descrição:</p>
                                            <p style="margin: 0; font-size: 14px; color: #333; line-height: 1.5; font-style: italic; background-color: #fff; padding: 10px; border: 1px solid #eee; border-radius: 4px;">
                                                "${detalhesChamado.descricao}"
                                            </p>
                                        </td>
                                    </tr>
                                </table>

                                <br>
                                <p style="text-align: center; color: #999; font-size: 12px;">
                                    Acesse o Portal Interno para interagir com este chamado.
                                </p>
                            </td>
                        </tr>

                        <tr>
                            <td style="background-color: #f1f1f1; padding: 20px; text-align: center; font-size: 12px; color: #888;">
                                <p style="margin: 0;">Rosalina Supermercados &copy; ${new Date().getFullYear()}</p>
                                <p style="margin: 5px 0 0;">Departamento de Tecnologia</p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;
};

// =====================================================================
// 1. NOTIFICAÇÃO DE CRIAÇÃO (Exportada)
// =====================================================================
export const enviarNotificacaoCriacao = async (destinatario, chamado) => {
    try {
        console.log(`[Email] Enviando Criação (Template Rosalina) para: ${destinatario}`);
        
        const htmlEmail = gerarHtmlRosalina(
            "Chamado Registrado",
            `Olá, <strong>${chamado.nomeRequisitante}</strong>. Seu chamado foi aberto com sucesso e nossa equipe já foi notificada.`,
            chamado
        );

        const info = await transporter.sendMail({
            from: process.env.EMAIL_FROM,
            to: destinatario,
            subject: `🎫 Chamado #${chamado.id} Aberto: ${chamado.assunto}`,
            html: htmlEmail
        });
        console.log(`[Email] Sucesso! ID: ${info.messageId}`);
    } catch (error) {
        console.error("[Email] Erro Criação:", error);
    }
};

// =====================================================================
// 2. NOTIFICAÇÃO DE STATUS (Exportada - CORREÇÃO DO ERRO)
// =====================================================================
export const enviarNotificacaoStatus = async (destinatario, chamado, novoStatus) => {
    try {
        console.log(`[Email] Enviando Status (Template Rosalina) para: ${destinatario}`);

        // Atualiza o objeto chamado com o novo status para aparecer correto no template
        const chamadoAtualizado = { ...chamado, status: novoStatus };

        const htmlEmail = gerarHtmlRosalina(
            "Status Atualizado",
            `Olá! O status do seu chamado mudou para <strong style="color: ${CORES.secundaria}; font-size: 18px;">${novoStatus.toUpperCase()}</strong>. Veja os detalhes atualizados abaixo:`,
            chamadoAtualizado
        );

        const info = await transporter.sendMail({
            from: process.env.EMAIL_FROM,
            to: destinatario,
            subject: `🔄 Atualização: Chamado #${chamado.id} está ${novoStatus}`,
            html: htmlEmail
        });
        console.log(`[Email] Sucesso! ID: ${info.messageId}`);
    } catch (error) {
        console.error("[Email] Erro Status:", error);
    }
};