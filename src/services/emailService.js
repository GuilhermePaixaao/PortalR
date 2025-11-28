// src/services/emailService.js
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// --- PALETA DE CORES ROSALINA ---
const CORES = {
    fundo: '#f4f4f7',       // Cinza claro para o fundo da tela
    card: '#ffffff',        // Branco para o cartão
    texto: '#333333',       // Cinza escuro para leitura
    primaria: '#3b4a9c',    // AZUL ROSALINA (Cabeçalho e Botões)
    secundaria: '#e31c23',  // VERMELHO ROSALINA (Detalhes e Bordas)
    borda: '#eaeaec'
};

// COLOQUE AQUI O LINK DA SUA IMAGEM HOSPEDADA:
const LOGO_URL = "src/views/imgrosa.png"; 

export const enviarNotificacaoCriacao = async (destinatario, chamado) => {
    try {
        console.log(`[Email] Enviando Template Rosalina para: ${destinatario}`);
        
        const { data, error } = await resend.emails.send({
           from: 'Suporte Rosalina <nao-responda@supermercadorosalina.com.br>',
            to: [destinatario],
            subject: `🎫 Chamado #${chamado.id} Recebido`,
            html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    @media only screen and (max-width: 600px) {
                        .main-card { width: 100% !important; }
                    }
                </style>
            </head>
            <body style="background-color: ${CORES.fundo}; font-family: sans-serif; padding: 40px 0; margin: 0;">
                
                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                    <tr>
                        <td align="center">
                            
                            <div style="margin-bottom: 20px;">
                                <img src="${LOGO_URL}" height="50" alt="Rosalina Supermercados" style="display: block; border: 0;">
                            </div>

                            <table class="main-card" width="500" border="0" cellspacing="0" cellpadding="0" style="background-color: ${CORES.card}; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                                
                                <tr>
                                    <td style="background-color: ${CORES.primaria}; padding: 25px; text-align: center; border-bottom: 4px solid ${CORES.secundaria};">
                                        <h1 style="color: #ffffff; margin: 0; font-size: 22px; letter-spacing: 0.5px;">Chamado Registrado</h1>
                                    </td>
                                </tr>

                                <tr>
                                    <td style="padding: 40px 30px;">
                                        <p style="color: ${CORES.texto}; font-size: 16px; margin-bottom: 20px;">
                                            Olá, <strong>${chamado.nomeRequisitante}</strong>.
                                        </p>
                                        <p style="color: ${CORES.texto}; font-size: 15px; line-height: 24px; margin-bottom: 25px;">
                                            Recebemos sua solicitação no Portal Rosalina. Nossa equipe de TI já está analisando o caso.
                                        </p>

                                        <table width="100%" style="background-color: #f8f9fa; border-left: 4px solid ${CORES.primaria}; margin-bottom: 25px;">
                                            <tr>
                                                <td style="padding: 15px;">
                                                    <p style="margin: 5px 0; font-size: 14px; color: #555;"><strong>Ticket:</strong> #${chamado.id}</p>
                                                    <p style="margin: 5px 0; font-size: 14px; color: #555;"><strong>Assunto:</strong> ${chamado.assunto}</p>
                                                </td>
                                            </tr>
                                        </table>

                                       
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
            `
        });

        if (error) throw new Error(error.message);
        console.log(`[Email] Enviado com sucesso: ${data.id}`);
        return data;
    } catch (err) {
        console.error("[Email] Erro:", err);
    }
};

// Se quiser atualizar a função de Status também, basta copiar o HTML acima e mudar o texto do cabeçalho e do corpo.