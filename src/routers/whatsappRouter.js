import { Router } from 'express';
import * as WhatsappController from '../controllers/whatsappController.js';

const router = Router();

// Webhook (Evolution chama isso)
router.post('/api/evolution/webhook', WhatsappController.handleWebhook);

// Frontend chama isso para conectar/gerar QR
router.get('/api/whatsapp/connect', WhatsappController.connectInstance);

// Frontend chama isso para enviar msg
router.post('/api/whatsapp/send', WhatsappController.handleSendMessage);

// Frontend chama isso para ver se já está conectado
router.get('/api/whatsapp/status', WhatsappController.checarStatus);

// Rota para listar conversas (Sidebar)
router.get('/api/whatsapp/chats', WhatsappController.listarConversas);

// Rota para listar mensagens de um chat específico
router.post('/api/whatsapp/messages', WhatsappController.listarMensagensChat);

// Rota para o agente assumir o chamado
router.post('/api/whatsapp/atender', WhatsappController.atenderAtendimento);

// Rota para finalizar atendimento
router.post('/api/whatsapp/finalizar', WhatsappController.finalizarAtendimento);

// Rota para transferir atendimento
router.post('/api/whatsapp/transferir', WhatsappController.transferirAtendimento);

// =========================================================
// === NOVAS ROTAS (TICKETS) ===
// =========================================================

// Validar se um ticket existe (Botão Associar)
router.post('/api/whatsapp/ticket/verificar', WhatsappController.verificarTicket);

// Criar um novo ticket a partir do chat (Botão Criar)
router.post('/api/whatsapp/ticket/criar', WhatsappController.criarChamadoDoChat);

// =========================================================

// Rota para forçar a configuração do Webhook
router.get('/api/whatsapp/configure-webhook', WhatsappController.configurarUrlWebhook);

router.post('/api/whatsapp/disconnect', WhatsappController.handleDisconnect);

// =========================================================
// === ROTA DE CORREÇÃO DO HISTÓRICO (CORRIGIDA v2) ===
// =========================================================
router.get('/api/fix-history', async (req, res) => {
    try {
        const axios = await import('axios');
        
        const instanceName = process.env.EVOLUTION_INSTANCE_NAME || "portal_whatsapp_v1";
        const baseUrl = process.env.EVOLUTION_API_URL;
        const apiKey = process.env.EVOLUTION_API_KEY;

        console.log(`[FIX] Tentando ativar histórico para: ${instanceName} em ${baseUrl}`);

        const url = `${baseUrl}/settings/set/${instanceName}`;
        
        // --- CORREÇÃO: Usando camelCase conforme exigido pelo erro 400 ---
        const settingsPayload = {
            "rejectCall": false,
            "groupsIgnore": false,
            "alwaysOnline": true,
            "readMessages": false,
            "readStatus": false,
            "syncFullHistory": false 
        };

        // Envia o comando para a Evolution API
        const response = await axios.default.post(url, settingsPayload, {
            headers: { 
                'apikey': apiKey,
                'Content-Type': 'application/json'
            }
        });

        res.send(`
            <div style="font-family: sans-serif; padding: 20px;">
                <h1 style="color: green;">✅ SUCESSO!</h1>
                <p>Configuração aplicada na Evolution API!</p>
                <p>O recurso <b>syncFullHistory</b> foi ativado.</p>
                <hr>
                <p><b>Próximos passos:</b></p>
                <ol>
                    <li>Envie uma mensagem NOVA para o bot.</li>
                    <li>Verifique se ela aparece no Histórico Global.</li>
                </ol>
                <details>
                    <summary>Ver resposta técnica da API</summary>
                    <pre>${JSON.stringify(response.data, null, 2)}</pre>
                </details>
            </div>
        `);
    } catch (error) {
        console.error("Erro ao ativar histórico:", error);
        
        // Exibe o erro detalhado da API na tela para facilitar
        const errorDetails = error.response?.data || error.message;

        res.status(500).send(`
            <h1 style="color: red;">❌ Erro ${error.response?.status || 500}</h1>
            <p>A API rejeitou o comando novamente.</p>
            <pre>${JSON.stringify(errorDetails, null, 2)}</pre>
        `);
    }
});

export default router;