import axios from 'axios';

// IMPORTANTE: No Railway, sua EVOLUTION_API_URL deve terminar sem barra no final, ex:
// https://api-evolution.railway.app
// O '/v2' nós adicionamos direto nas chamadas ou na baseURL se preferir.
// Para facilitar, vou assumir que sua ENV vem limpa e adiciono aqui:

const BASE_URL = process.env.EVOLUTION_API_URL; // Ex: https://sua-api.railway.app
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME || "portal_whatsapp_v1";

// Cria o cliente axios
const apiClient = axios.create({
  baseURL: BASE_URL, // A Evolution V2 costuma usar /instance na raiz, ou /v2 dependendo da config
  headers: {
    'apikey': EVOLUTION_API_KEY,
    'Content-Type': 'application/json'
  }
});

/**
 * Criar instância + gerar QR Code
 */
export const criarInstancia = async () => {
  try {
    const response = await apiClient.post('/instance/create', {
      instanceName: INSTANCE_NAME,
      integration: "WHATSAPP-BAILEYS", // <--- AQUI ESTAVA O ERRO (tem que ser assim)
      qrcode: true
    });

    console.log('Instância criada. QR Code deve estar na resposta:', response.data);
    return response.data;

  } catch (error) {
    // Se der erro 409 (Conflict), significa que já existe, então tentamos conectar
    if (error.response && error.response.status === 403) {
        // Às vezes retorna 403 ou 409 quando já existe
        console.warn('Instância já existe. Tentando conectar...');
        return conectarInstancia();
    }
    
    // Tratamento específico para quando já existe (mensagem de erro comum)
    if (error.response?.data?.error === 'Instance already exists') {
        console.warn('Instância já existe. Tentando conectar...');
        return conectarInstancia();
    }

    console.error("Erro ao criar instância:", error.response?.data || error.message);
    throw new Error('Falha ao criar instância.');
  }
};

/**
 * Conectar instância existente (Puxar novo QR Code)
 */
export const conectarInstancia = async () => {
  try {
    // <--- AQUI TINHA UM ERRO: estava //connect
    // Na v2, para reconectar e pegar o QR Code de uma instância existente:
    const response = await apiClient.get(`/instance/connect/${INSTANCE_NAME}`);
    
    console.log('Solicitação de conexão feita:', response.data);
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
    // Ajuste da rota para o padrão da V2
    const url = `/message/send/text/${INSTANCE_NAME}`;

    const response = await apiClient.post(url, {
      number: numero,
      options: {
        delay: 1200,
        presence: 'composing',
        linkPreview: false
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