import { Resend } from 'resend';

// ==============================================================================
// 1. CONFIGURAÇÕES VISUAIS & LAYOUT (O Design do E-mail)
// ==============================================================================

// Paleta de Cores Oficial Rosalina
const CORES = {
    fundo: '#f4f4f7',
    card: '#ffffff',
    primaria: '#3b4a9c',    // Azul Rosalina
    secundaria: '#e31c23',  // Vermelho Rosalina
    texto: '#333333'
};

// ⚠️ IMPORTANTE: Troque este link por um link público do seu logo (Imgur, S3, etc)
// Enquanto não tiver, vai aparecer um ícone genérico.
const LOGO_URL = "https://cdn-icons-png.flaticon.com/512/372/372986.png"; 

// Função que cria a estrutura base do HTML (Cabeçalho, Rodapé, Card)
const renderLayout = (titulo, conteudoCentral) => {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            @media only screen and (max-width: 600px) { .main-card { width: 100% !important; } }
        </style>
    </head>
    <body style="background-color: ${CORES.fundo}; font-family: sans-serif; padding: 40px 0; margin: 0;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0">
            <tr>
                <td align="center">
                    
                    <!-- NOME DA EMPRESA (TOPO) -->
                    <div style="margin-bottom: 20px;">
                        <!-- Se tiver o link da imagem real, desbloqueie a linha abaixo -->
                        <!-- <img src="${LOGO_URL}" height="50" style="display: block; margin: 0 auto;"> -->
                        <h2 style="color: ${CORES.primaria}; margin: 0; font-family: Arial, sans-serif;">ROSALINA SUPERMERCADOS</h2>
                    </div>

                    <!-- CARD PRINCIPAL -->
                    <table class="main-card" width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: ${CORES.card}; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                        
                        <!-- BARRA DE TÍTULO (AZUL E VERMELHO) -->
                        <tr>
                            <td style="background-color: ${CORES.primaria}; padding: 25px; text-align: center; border-bottom: 4px solid ${CORES.secundaria};">
                                <h1 style="color: #ffffff; margin: 0; font-size: 24px;">${titulo}</h1>
                            </td>
                        </tr>

                        <!-- CONTEÚDO VARIÁVEL -->
                        <tr>
                            <td style="padding: 40px 30px;">
                                ${conteudoCentral}
                            </td>
                        </tr>
                        
                        <!-- RODAPÉ -->
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

// Helper para criar a caixinha cinza com os detalhes do chamado
const renderDetalhesChamado = (chamado) => {
    const dataFormatada = new Date(chamado.created_at || new Date()).toLocaleString('pt-BR');
    return `
    <table width="100%" style="background-color: #f8f9fa; border-left: 5px solid ${CORES.secundaria}; margin-top: 20px; font-size: 14px; color: #555;">
        <tr>
            <td style="padding: 20px;">
                <p style="margin: 5px 0;"><strong>Ticket ID:</strong> #${chamado.id}</p>
                <p style="margin: 5px 0;"><strong>Assunto:</strong> ${chamado.assunto}</p>
                <p style="margin: 5px 0;"><strong>Data:</strong> ${dataFormatada}</p>
                <p style="margin: 5px 0;"><strong>Prioridade:</strong> ${chamado.prioridade || 'Normal'}</p>
                
                <hr style="border: 0; border-top: 1px solid #ddd; margin: 15px 0;">
                
                <p style="margin: 0 0 5px 0; font-size: 12px; color: #999; text-transform: uppercase;">Descrição:</p>
                <p style="margin: 0; font-size: 14px; color: #333; line-height: 1.5; font-style: italic; background-color: #fff; padding: 10px; border: 1px solid #eee; border-radius: 4px;">
                    "${chamado.descricao}"
                </p>
            </td>
        </tr>
    </table>
    `;
};

// ==============================================================================
// 2. LÓGICA DE ENVIO (SERVICES)
// ==============================================================================

// Inicializa o cliente Resend com a chave que está nas variáveis do Railway
const resend = new Resend(process.env.RESEND_API_KEY);

// Configuração do Remetente
// Se não tiver domínio próprio configurado no Resend, OBRIGATORIAMENTE use 'onboarding@resend.dev'
// O nome antes do <...> você pode mudar à vontade.
const EMAIL_REMETENTE = 'Portal Rosalina <onboarding@resend.dev>'; 

// --- FUNÇÃO 1: Enviar Notificação de CRIAÇÃO ---
export const enviarNotificacaoCriacao = async (destinatario, chamado) => {
    try {
        console.log(`[Email] Preparando envio de CRIAÇÃO para: ${destinatario}`);
        
        // Monta o HTML específico
        const miolo = `
            <p style="color: ${CORES.texto}; font-size: 16px; margin-bottom: 20px;">
                Olá, <strong>${chamado.nomeRequisitante}</strong>.
                <br><br>
                Seu chamado foi registrado com sucesso e nossa equipe técnica já foi notificada.
            </p>
            ${renderDetalhesChamado(chamado)}
            <div style="text-align: center; margin-top: 30px;">
                 <p style="color: #999; font-size: 12px;">Aguarde nosso retorno.</p>
            </div>
        `;
        
        const htmlFinal = renderLayout("Chamado Registrado", miolo);

        // Envia via API (Porta 443 - Não bloqueia no Railway)
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
        // Loga o erro mas não trava o sistema
        console.error("[Email] Erro ao enviar Criação:", error);
    }
};

// --- FUNÇÃO 2: Enviar Notificação de STATUS ---
export const enviarNotificacaoStatus = async (destinatario, chamado, novoStatus) => {
    try {
        console.log(`[Email] Preparando envio de STATUS para: ${destinatario}`);

        // --- LÓGICA DO OPERADOR (NOVO) ---
        // Verifica se o status é "Em Andamento" e se existe um nome de atendente
        let mensagemAtendente = '';
        if (novoStatus === 'Em Andamento' && chamado.nomeAtendente) {
            mensagemAtendente = `
                <p style="color: ${CORES.texto}; font-size: 15px; margin-top: 15px; background-color: #f0fdf4; padding: 10px; border-radius: 4px; border: 1px solid #dcfce7;">
                    👨‍💻 O operador <strong>${chamado.nomeAtendente}</strong> assumiu seu chamado e já está trabalhando nele.
                </p>
            `;
        }

        // Monta o HTML específico
        const miolo = `
            <p style="color: ${CORES.texto}; font-size: 16px; margin-bottom: 20px;">
                Olá! O status do seu chamado mudou para:
                <br><br>
                <strong style="color: ${CORES.primaria}; font-size: 24px; text-transform: uppercase; background-color: #eef2ff; padding: 5px 10px; border-radius: 4px;">
                    ${novoStatus}
                </strong>
            </p>
            ${mensagemAtendente}
            ${renderDetalhesChamado(chamado)}
            <div style="text-align: center; margin-top: 30px;">
                 <p style="color: #999; font-size: 12px;">Acesse o portal para mais detalhes.</p>
            </div>
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