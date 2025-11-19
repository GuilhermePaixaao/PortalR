import axios from 'axios';

// Variáveis de Ambiente
const BASE_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
// ATENÇÃO: O nome aqui deve ser igual ao que aparece nos logs da Evolution
const INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME || "portal_whatsapp_v1"; 

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'apikey': EVOLUTION_API_KEY,
    'Content-Type': 'application/json'
  }
});

export const criarInstancia = async () => {
  try {
    const response = await apiClient.post('/instance/create', {
      instanceName: INSTANCE_NAME,
      token: "", 
      qrcode: true,
      integration: "WHATSAPP-BAILEYS" 
    });
    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 409) {
        return conectarInstancia();
    }
    throw new Error('Falha ao criar instância.');
  }
};

export const conectarInstancia = async () => {
    try {
        const response = await apiClient.get(`/instance/connect/${INSTANCE_NAME}`);
        return response.data;
    } catch (error) {
        throw new Error('Falha ao conectar instância.');
    }
}

// ======================================================
// === CORREÇÃO APLICADA AQUI ===
// ======================================================
export const enviarTexto = async (numero, mensagem) => {
  try {
    console.log(`[EVOLUTION] Tentando enviar mensagem...`);
    console.log(`   > Instância: ${INSTANCE_NAME}`);
    console.log(`   > Número: ${numero}`);

    // MUDANÇA: Trocado 'textMessage: { text: mensagem }' por apenas 'text: mensagem'
    const response = await apiClient.post(`/message/sendText/${INSTANCE_NAME}`, {
      number: numero,
      options: { delay: 1200, presence: 'composing' },
      text: mensagem 
    });
    
    return response.data;

  } catch (error) {
    const erroDetalhado = error.response?.data || error.message;
    console.error("❌ ERRO CRÍTICO AO ENVIAR MENSAGEM:", JSON.stringify(erroDetalhado, null, 2));
    
    throw new Error(error.response?.data?.message || 'Falha técnica ao enviar mensagem.');
  }
};

export const consultarStatus = async () => {
  try {
    const response = await apiClient.get(`/instance/connectionState/${INSTANCE_NAME}`);
    return response.data;
  } catch (error) {
    return { instance: { state: 'close' } }; 
  }
};

export const buscarConversas = async () => {
  try {
    const response = await apiClient.post(`/chat/findChats/${INSTANCE_NAME}`, {
        where: {},
        limit: 50,
        offset: 0
    });
    return response.data;
  } catch (error) {
    console.error("Erro ao buscar conversas:", error.message);
    return []; 
  }
};

export const configurarWebhook = async (urlWebhook) => {
    if (!urlWebhook) throw new Error("URL do Webhook é obrigatória");
    try {
        const response = await apiClient.post(`/webhook/set/${INSTANCE_NAME}`, {
            webhook: {
                enabled: true,
                url: urlWebhook,
                events: ["QRCODE_UPDATED", "MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE"]
            }
        });
        return response.data;
    } catch (error) {
        console.error("Erro ao configurar webhook:", error.response?.data || error.message);
        throw error;
    }
};

// === NOVA FUNÇÃO: BUSCAR MENSAGENS (Caso precise da funcionalidade anterior) ===
export const buscarMensagens = async (numero) => {
    try {
        const response = await apiClient.post(`/chat/findMessages/${INSTANCE_NAME}`, {
            where: {
                key: { remoteJid: numero }
            },
            limit: 50, // Traz as últimas 50 mensagens
            offset: 0
        });
        return response.data; // Retorna o array de mensagens
    } catch (error) {
        console.error(`Erro ao buscar mensagens de ${numero}:`, error.message);
        return []; 
    }
};