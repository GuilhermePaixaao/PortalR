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
// === ROTA DE CORREÇÃO DO HISTÓRICO (CORRIGIDA) ===
// =========================================================
router.get('/api/fix-history', async (req, res) => {
    try {
        const axios = await import('axios');
        
        const instanceName = process.env.EVOLUTION_INSTANCE_NAME || "portal_whatsapp_v1";
        const baseUrl = process.env.EVOLUTION_API_URL;
        const apiKey = process.env.EVOLUTION_API_KEY;

        console.log(`[FIX] Tentando ativar histórico para: ${instanceName} em ${baseUrl}`);

        // --- CORREÇÃO 1: Rota ajustada para /settings/set/ ---
        const url = `${baseUrl}/settings/set/${instanceName}`;
        
        // --- CORREÇÃO 2: Payload compatível com V2 ---
        const settingsPayload = {
            "reject_call": false,
            "groups_ignore": false,
            "always_online": true,
            "read_messages": false,
            "read_status": false,
            "sync_full_history": true  // Isso força a baixar mensagens antigas se possível
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
                <h1 style="color: green;">✅ SUCESSO (Código 200)</h1>
                <p>Configuração aplicada na Evolution API!</p>
                <p><b>Importante:</b> Se mesmo assim as mensagens não aparecerem, você precisa ativar as variáveis de ambiente no Railway (veja abaixo).</p>
                <hr>
                <details>
                    <summary>Ver resposta da API</summary>
                    <pre>${JSON.stringify(response.data, null, 2)}</pre>
                </details>
            </div>
        `);
    } catch (error) {
        console.error("Erro ao ativar histórico:", error);
        res.status(500).send(`
            <h1 style="color: red;">❌ Erro ${error.response?.status || 500}</h1>
            <p>${error.message}</p>
            <p>Verifique se o nome da instância <b>${process.env.EVOLUTION_INSTANCE_NAME}</b> está correto.</p>
            <pre>${JSON.stringify(error.response?.data || {}, null, 2)}</pre>
        `);
    }
});

export default router;