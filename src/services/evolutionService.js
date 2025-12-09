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

export const desconectarInstancia = async () => {
    try {
        console.log(`[EVOLUTION] Tentando DELETAR/DESCONECTAR (DELETE /instance/delete/) instância: ${INSTANCE_NAME}`);
        const response = await apiClient.delete(`/instance/delete/${INSTANCE_NAME}`);
        return response.data;
    } catch (error) {
        const evolutionMessage = error.response?.data?.message || error.message || "Erro desconhecido de rede/API ao desconectar.";
        throw new Error(`Falha Evolution API ao Desconectar: ${evolutionMessage}. Verifique se o nome da instância (${INSTANCE_NAME}) está correto.`);
    }
};

export const enviarTexto = async (numero, mensagem) => {
  try {
    console.log(`[EVOLUTION] Tentando enviar mensagem...`);
    console.log(`   > Instância: ${INSTANCE_NAME}`);
    console.log(`   > Número: ${numero}`);

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

export const buscarConversas = async (limit = 50, offset = 0) => {
  try {
    const response = await apiClient.post(`/chat/findChats/${INSTANCE_NAME}`, {
        where: {},
        limit: limit,
        offset: offset
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

// === CORREÇÃO: TENTATIVA DE BUSCA MAIS ABRANGENTE ===
export const buscarMensagensHistorico = async (numero, quantidade = 50) => {
  try {
    // Tenta buscar usando o formato padrão (key -> remoteJid)
    let payload = {
        where: { key: { remoteJid: numero } },
        limit: quantidade
    };

    // DEBUG: Se quiser testar o outro formato, descomente a linha abaixo e comente a de cima
    // payload = { where: { remoteJid: numero }, limit: quantidade };

    const response = await apiClient.post(`/chat/findMessages/${INSTANCE_NAME}`, payload);
    
    // Se não retornou nada, tenta o fallback (outro formato de query comum em algumas versões)
    if (!response.data || (Array.isArray(response.data) && response.data.length === 0) || (response.data.messages && response.data.messages.length === 0)) {
         console.log("[EVOLUTION] Tentando fallback de busca por remoteJid direto...");
         const responseFallback = await apiClient.post(`/chat/findMessages/${INSTANCE_NAME}`, {
            where: { remoteJid: numero },
            limit: quantidade
         });
         return responseFallback.data;
    }

    return response.data; 
  } catch (error) {
    console.error("Erro ao buscar histórico de mensagens:", error.message);
    return []; 
  }
};