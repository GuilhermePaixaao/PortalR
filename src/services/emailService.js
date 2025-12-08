import { Resend } from 'resend';

// ==============================================================================
// 1. CONFIGURAÇÕES VISUAIS & LAYOUT (O Design do E-mail)
// ==============================================================================

const CORES = {
    fundo: '#f4f4f7',
    card: '#ffffff',
    primaria: '#3b4a9c',    // Azul Rosalina
    secundaria: '#e31c23',  // Vermelho Rosalina
    texto: '#333333'
};

const LOGO_URL = "src/views/imgrosa.png"; 

// Função que cria a estrutura base do HTML
const renderLayout = (titulo, conteudoCentral) => {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style> @media only screen and (max-width: 600px) { .main-card { width: 100% !important; } } </style>
    </head>
    <body style="background-color: ${CORES.fundo}; font-family: sans-serif; padding: 40px 0; margin: 0;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0">
            <tr>
                <td align="center">
                    <div style="margin-bottom: 20px;">
                        <h2 style="color: ${CORES.primaria}; margin: 0;">ROSALINA SUPERMERCADOS</h2>
                    </div>
                    <table class="main-card" width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: ${CORES.card}; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                        <tr>
                            <td style="background-color: ${CORES.primaria}; padding: 25px; text-align: center; border-bottom: 4px solid ${CORES.secundaria};">
                                <h1 style="color: #ffffff; margin: 0; font-size: 24px;">${titulo}</h1>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 40px 30px;">
                                ${conteudoCentral}
                            </td>
                        </tr>
                        <tr>
                            <td style="background-color: #f1f1f1; padding: 20px; text-align: center; font-size: 12px; color: #888;">
                                <p>Rosalina Supermercados &copy; ${new Date().getFullYear()}</p>
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

// Helper para detalhes do chamado
const renderDetalhesChamado = (chamado) => {
    const dataFormatada = new Date(chamado.created_at || new Date()).toLocaleString('pt-BR');
    return `
    <table width="100%" style="background-color: #f8f9fa; border-left: 5px solid ${CORES.secundaria}; margin-top: 20px; font-size: 14px; color: #555;">
        <tr>
            <td style="padding: 20px;">
                <p><strong>Ticket ID:</strong> #${chamado.id}</p>
                <p><strong>Assunto:</strong> ${chamado.assunto}</p>
                <p><strong>Data:</strong> ${dataFormatada}</p>
                <p><strong>Prioridade:</strong> ${chamado.prioridade || 'Normal'}</p>
                <hr style="border: 0; border-top: 1px solid #ddd; margin: 15px 0;">
                <p style="font-size: 12px; color: #999;">DESCRIÇÃO:</p>
                <p style="font-style: italic;">"${chamado.descricao}"</p>
            </td>
        </tr>
    </table>
    `;
};

// ==============================================================================
// 2. LÓGICA DE ENVIO (USANDO RESEND + DOMÍNIO OFICIAL)
// ==============================================================================

const resend = new Resend(process.env.RESEND_API_KEY);

// ✅ CONFIGURAÇÃO DO DOMÍNIO DA EMPRESA
const EMAIL_REMETENTE = 'Portal Rosalina <nao-responder@smrosalina.com.br>'; 

// --- FUNÇÃO 1: Enviar Notificação de CRIAÇÃO ---
export const enviarNotificacaoCriacao = async (destinatario, chamado) => {
    try {
        console.log(`[Email] Preparando envio de CRIAÇÃO para: ${destinatario}`);
        
        const miolo = `
            <p style="color: ${CORES.texto}; font-size: 16px; margin-bottom: 20px;">
                Olá, <strong>${chamado.nomeRequisitante}</strong>.<br><br>
                Seu chamado foi registrado com sucesso.
            </p>
            ${renderDetalhesChamado(chamado)}
        `;
        
        const htmlFinal = renderLayout("Chamado Registrado", miolo);

        const { data, error } = await resend.emails.send({
            from: EMAIL_REMETENTE,
            to: [destinatario],
            subject: `🎫 Chamado #${chamado.id} Aberto: ${chamado.assunto}`,
            html: htmlFinal
        });

        if (error) throw new Error(error.message);
        console.log(`[Email] Sucesso! ID Resend: ${data.id}`);
        return data;

    } catch (error) {
        console.error("[Email] Erro ao enviar Criação:", error);
    }
};

// --- FUNÇÃO 2: Enviar Notificação de STATUS ---
export const enviarNotificacaoStatus = async (destinatario, chamado, novoStatus) => {
    try {
        console.log(`[Email] Preparando envio de STATUS para: ${destinatario}`);

        let mensagemAtendente = '';
        if (novoStatus === 'Em Andamento' && chamado.nomeAtendente) {
            mensagemAtendente = `<p style="background-color: #f0fdf4; padding: 10px;">👨‍💻 O operador <strong>${chamado.nomeAtendente}</strong> assumiu seu chamado.</p>`;
        }

        const miolo = `
            <p style="color: ${CORES.texto}; font-size: 16px;">
                O status do seu chamado mudou para: <strong style="color: ${CORES.primaria}; text-transform: uppercase;">${novoStatus}</strong>
            </p>
            ${mensagemAtendente}
            ${renderDetalhesChamado(chamado)}
        `;

        const htmlFinal = renderLayout("Status Atualizado", miolo);

        const { data, error } = await resend.emails.send({
            from: EMAIL_REMETENTE,
            to: [destinatario],
            subject: `🔄 Atualização: Chamado #${chamado.id} está ${novoStatus}`,
            html: htmlFinal
        });

        if (error) throw new Error(error.message);
        console.log(`[Email] Sucesso! ID Resend: ${data.id}`);
        return data;

    } catch (error) {
        console.error("[Email] Erro ao enviar Status:", error);
    }
};