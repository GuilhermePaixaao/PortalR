import axios from 'axios';

// Variáveis de Ambiente
const BASE_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME || "default"; 

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
    console.error("Erro ao criar:", error.message);
    throw new Error('Falha ao criar instância.');
  }
};

export const conectarInstancia = async () => {
    try {
        const response = await apiClient.get(`/instance/connect/${INSTANCE_NAME}`);
        return response.data;
    } catch (error) {
        console.error("Erro ao conectar:", error.message);
        throw new Error('Falha ao conectar instância.');
    }
}

export const enviarTexto = async (numero, mensagem) => {
  try {
    const response = await apiClient.post(`/message/sendText/${INSTANCE_NAME}`, {
      number: numero,
      options: { delay: 1200, presence: 'composing' },
      textMessage: { text: mensagem }
    });
    return response.data;
  } catch (error) {
    throw new Error('Falha ao enviar mensagem.');
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

/**
 * (CORRIGIDO) Busca conversas usando POST (Padrão da Evolution)
 * Adicionado 'where: {}' para evitar erros em algumas versões.
 */
export const buscarConversas = async () => {
  try {
    const response = await apiClient.post(`/chat/findChats/${INSTANCE_NAME}`, {
        where: {}, // Importante para algumas versões
        limit: 50,
        offset: 0
    });
    return response.data;
  } catch (error) {
    // Loga o erro mas retorna array vazio para não travar o front
    console.error("Erro ao buscar conversas:", error.message);
    if (error.response) {
        console.error("Detalhes do erro API:", error.response.data);
    }
    return []; 
  }
};