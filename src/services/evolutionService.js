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
    const response = await apiClient.post(`/message/sendText/${INSTANCE_NAME}`, {
      number: numero,
      options: { delay: 0, presence: 'composing' },
      text: mensagem 
    });
    return response.data;
  } catch (error) {
    const erroDetalhado = error.response?.data || error.message;
    console.error("❌ ERRO AO ENVIAR MENSAGEM:", JSON.stringify(erroDetalhado, null, 2));
    throw new Error(error.response?.data?.message || 'Falha técnica ao enviar mensagem.');
  }
};

// ==============================================================================
// === [ATUALIZADO] FUNÇÃO PARA ENVIAR QUALQUER MÍDIA (IMG, VÍDEO, PDF) ===
// ==============================================================================
// src/services/evolutionService.js

// Em src/services/evolutionService.js

// src/services/evolutionService.js

// src/services/evolutionService.js

export const enviarMidia = async (numero, midiaBase64, nomeArquivo, legenda, tipo) => {
    try {
        // 1. Garante que o tipo tenha um valor válido
        const mediaTypeFinal = (tipo === 'video' || tipo === 'document' || tipo === 'audio') ? tipo : 'image';
        
        console.log(`[EVOLUTION] Enviando Mídia. Tipo: ${mediaTypeFinal} | Arquivo: ${nomeArquivo}`);

        // 2. CORREÇÃO PRINCIPAL: Removido o wrapper "mediaMessage". 
        // Os campos vão direto na raiz do objeto.
        const payload = {
            number: numero,
            mediatype: mediaTypeFinal, // <--- Agora está na raiz, onde a API procura
            mimetype: mediaTypeFinal === 'image' ? 'image/png' : (mediaTypeFinal === 'video' ? 'video/mp4' : 'application/pdf'), // Ajuda a API a não se perder
            fileName: nomeArquivo || `arquivo.${mediaTypeFinal === 'image' ? 'png' : 'pdf'}`,
            media: midiaBase64, 
            caption: legenda || ""
        };

        // Opções extras
        const options = { delay: 1000, presence: 'composing' };
        
        // Junta tudo no body
        const response = await apiClient.post(`/message/sendMedia/${INSTANCE_NAME}`, {
            ...payload,
            options
        });

        return response.data;
    } catch (error) {
        console.error("❌ ERRO AO ENVIAR MÍDIA:", JSON.stringify(error.response?.data || error.message, null, 2));
        throw new Error('Falha técnica ao enviar mídia.');
    }
};

// ==============================================================================
// === [NOVO] FUNÇÃO ESPECÍFICA PARA ÁUDIO (GRAVADO NA HORA) ===
// ==============================================================================
export const enviarAudio = async (numero, audioBase64) => {
    try {
        const response = await apiClient.post(`/message/sendWhatsAppAudio/${INSTANCE_NAME}`, {
            number: numero,
            audioMessage: {
                audio: audioBase64
            },
            options: { delay: 0, presence: 'recording', encoding: true }
        });
        return response.data;
    } catch (error) {
        console.error("❌ ERRO AO ENVIAR ÁUDIO:", error.response?.data || error.message);
        throw new Error('Falha ao enviar áudio.');
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

// ==============================================================================
// === FUNÇÃO DE BUSCA DE MENSAGENS BLINDADA E COM LOGS DETALHADOS ===
// ==============================================================================
export const buscarMensagensHistorico = async (numero, quantidade = 50) => {
  try {
    if (!numero) return [];

    // 1. CORREÇÃO DE FORMATO: Garante que o número tenha @s.whatsapp.net ou @g.us
    let remoteJid = numero;
    if (!remoteJid.includes('@') && remoteJid !== 'status@broadcast') {
        remoteJid = `${remoteJid}@s.whatsapp.net`;
    }

    console.log(`🔍 [EVOLUTION] Buscando mensagens para: ${remoteJid} (Limit: ${quantidade})`);

    // 2. TENTATIVA 1: Payload Padrão (Mais comum)
    const payloadPadrao = {
        where: {
            key: { remoteJid: remoteJid }
        },
        limit: quantidade
    };

    const response = await apiClient.post(`/chat/findMessages/${INSTANCE_NAME}`, payloadPadrao);
    const dados = response.data;

    // Verifica se retornou dados válidos
    let mensagensEncontradas = [];
    if (Array.isArray(dados)) mensagensEncontradas = dados;
    else if (dados && Array.isArray(dados.messages)) mensagensEncontradas = dados.messages;
    else if (dados && Array.isArray(dados.data)) mensagensEncontradas = dados.data;

    if (mensagensEncontradas.length > 0) {
        return mensagensEncontradas;
    }

    // 3. TENTATIVA 2: Fallback (Para versões diferentes da API)
    console.log("⚠️ [EVOLUTION] Tentativa 1 vazia. Tentando modo de compatibilidade (remoteJid direto)...");
    
    const payloadFallback = {
        where: { remoteJid: remoteJid },
        limit: quantidade
    };

    const responseFallback = await apiClient.post(`/chat/findMessages/${INSTANCE_NAME}`, payloadFallback);
    const dadosFallback = responseFallback.data;

    if (Array.isArray(dadosFallback)) return dadosFallback;
    if (dadosFallback && Array.isArray(dadosFallback.messages)) return dadosFallback.messages;
    if (dadosFallback && Array.isArray(dadosFallback.data)) return dadosFallback.data;

    console.log("❌ [EVOLUTION] Nenhuma mensagem encontrada em nenhuma tentativa.");
    return []; 

  } catch (error) {
    console.error(`❌ [EVOLUTION] Erro na busca de mensagens: ${error.message}`);
    if (error.response) {
        console.error("   Detalhes API:", JSON.stringify(error.response.data, null, 2));
    }
    return []; 
  }
};