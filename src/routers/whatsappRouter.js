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

// --- [CORREÇÃO] ROTA QUE FALTAVA ---
// Rota para listar mensagens de um chat específico
router.post('/api/whatsapp/messages', WhatsappController.listarMensagensChat);
// -----------------------------------

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
// === ROTA DE CORREÇÃO DO HISTÓRICO (RAILWAY) ===
// =========================================================
router.get('/api/fix-history', async (req, res) => {
    try {
        // Importação dinâmica do Axios para não quebrar se faltar no topo
        const axios = await import('axios');
        
        const instanceName = process.env.EVOLUTION_INSTANCE_NAME || "portal_whatsapp_v1";
        const baseUrl = process.env.EVOLUTION_API_URL;
        const apiKey = process.env.EVOLUTION_API_KEY;

        console.log(`[FIX] Tentando ativar histórico para: ${instanceName} em ${baseUrl}`);

        // Payload para ativar o armazenamento de mensagens
        const settingsPayload = {
            store: {
                enabled: true,
                messages: true,
                messageContent: true,
                contacts: true
            }
        };

        // Envia o comando para a Evolution API
        await axios.default.post(`${baseUrl}/instance/settings/${instanceName}`, settingsPayload, {
            headers: { 
                'apikey': apiKey,
                'Content-Type': 'application/json'
            }
        });

        res.send(`
            <div style="font-family: sans-serif; padding: 20px;">
                <h1 style="color: green;">✅ SUCESSO!</h1>
                <p>O histórico foi ativado na configuração da sua Evolution API.</p>
                <hr>
                <p><b>O que fazer agora?</b></p>
                <ol>
                    <li>Envie uma mensagem <b>NOVA</b> do seu celular para o Bot (ex: "Teste 123").</li>
                    <li>Volte no painel e abra o Histórico Global.</li>
                    <li>A mensagem nova deve aparecer.</li>
                </ol>
                <p style="color: gray; font-size: 0.9em;">Nota: Mensagens antigas (de antes de agora) continuarão invisíveis pois não foram salvas na época.</p>
            </div>
        `);
    } catch (error) {
        console.error("Erro ao ativar histórico:", error);
        res.status(500).send(`
            <h1 style="color: red;">❌ Erro</h1>
            <p>${error.message}</p>
            <pre>${JSON.stringify(error.response?.data || {}, null, 2)}</pre>
        `);
    }
});

export default router;