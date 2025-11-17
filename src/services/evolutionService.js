import axios from 'axios';

// Variáveis do ambiente (locais OU do Railway)
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME || "default";

// Cria o cliente axios configurado
const apiClient = axios.create({
  baseURL: EVOLUTION_API_URL,
  headers: {
    'apikey': EVOLUTION_API_KEY,
    'Content-Type': 'application/json'
  }
});

/**
 * Cria instância + gera QR Code
 */
export const criarInstancia = async () => {
  try {
    const response = await apiClient.post('/instance/create', {
      instanceName: INSTANCE_NAME,
      // integration: "WHATSAPP-MULTI-DEVICE",  // <-- LINHA REMOVIDA
      qrcode: true
    });

    console.log('Resposta da criação da instância:', response.data);
    return response.data;

  } catch (error) {

    // Instância já existe → pedir novo QR
    if (error.response && error.response.status === 409) {
      console.warn('Instância já existe, pedindo novo QR...');
      return conectarInstancia();
    }

    console.error("Erro ao criar instância:", error.response?.data || error.message);
    throw new Error('Falha ao criar instância.');
  }
};

/**
 * Conectar instância existente + gerar novo QR Code
 */
export const conectarInstancia = async () => {
  try {
    const response = await apiClient.get(`/instance/connect/${INSTANCE_NAME}`);
    console.log('Resposta da conexão:', response.data);
    return response.data;

  } catch (error) {
    console.error("Erro ao conectar instância:", error.response?.data || error.message);
    throw new Error('Falha ao conectar instância.');
  }
};

/**
 * Enviar texto
 */
export const enviarTexto = async (numero, mensagem) => {
  try {
    const url = `/message/sendText/${INSTANCE_NAME}`;

    const response = await apiClient.post(url, {
      number: numero,
      options: {
        delay: 1200,
        presence: 'composing'
      },
      textMessage: {
        text: mensagem
      }
    });

    return response.data;

  } catch (error) {
    console.error("Erro ao enviar texto:", error.response?.data || error.message);
    throw new Error('Falha ao enviar mensagem.');
  }
};