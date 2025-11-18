import axios from 'axios';

// Variáveis de Ambiente
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
// Usa 'default' se não houver nome definido no .env
const INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME || "default"; 

const apiClient = axios.create({
  baseURL: EVOLUTION_API_URL,
  headers: {
    'apikey': EVOLUTION_API_KEY,
    'Content-Type': 'application/json'
  }
});

/**
 * Cria a instância e pede o QR Code.
 */
export const criarInstancia = async () => {
  try {
    // Tenta criar a instância
    const response = await apiClient.post('/instance/create', {
      instanceName: INSTANCE_NAME,
      token: "", 
      qrcode: true,
      integration: "WHATSAPP-BAILEYS" // Importante para evitar erros
    });
    console.log('Instância criada:', response.data);
    return response.data;
  } catch (error) {
    // Se já existe (Erro 409), apenas conecta
    if (error.response && error.response.status === 409) {
        console.warn('Instância já existe, conectando...');
        return conectarInstancia();
    }
    console.error("Erro ao criar instância:", error.response?.data || error.message);
    throw new Error('Falha ao criar instância.');
  }
};

/**
 * Pede apenas o QR Code (para instância já existente).
 */
export const conectarInstancia = async () => {
    try {
        const response = await apiClient.get(`/instance/connect/${INSTANCE_NAME}`);
        return response.data;
    } catch (error) {
        console.error("Erro ao conectar instância:", error.response?.data || error.message);
        throw new Error('Falha ao conectar instância.');
    }
}

/**
 * Envia mensagem de texto.
 */
export const enviarTexto = async (numero, mensagem) => {
  try {
    const response = await apiClient.post(`/message/sendText/${INSTANCE_NAME}`, {
      number: numero,
      options: { delay: 1200, presence: 'composing' },
      textMessage: { text: mensagem }
    });
    return response.data;
  } catch (error) {
    console.error("Erro ao enviar mensagem:", error.response?.data || error.message);
    throw new Error('Falha ao enviar mensagem.');
  }
};

/**
 * (NOVO) Consulta o status da conexão.
 */
export const consultarStatus = async () => {
  try {
    const response = await apiClient.get(`/instance/connectionState/${INSTANCE_NAME}`);
    return response.data;
  } catch (error) {
    // Se der erro (ex: 404 instância não encontrada), retorna 'close'
    return { instance: { state: 'close' } }; 
  }
};