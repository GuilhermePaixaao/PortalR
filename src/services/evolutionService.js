import axios from 'axios';

// Essas variáveis VÊM DO SEU .env (do PortalR)
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL; // (Ex: https://evo-api.railway.app)
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY; // (A senha que você criou)
const INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME ||"default"; // Nome da sua instância
const apiClient = axios.create({
  baseURL: EVOLUTION_API_URL,
  headers: {
    'apikey': EVOLUTION_API_KEY,
    'Content-Type': 'application/json'
  }
});

/**
 * Pede para a Evolution API criar uma instância e gerar um QR Code.
 * O QR Code será enviado para o nosso Webhook.
 */
export const criarInstancia = async () => {
  try {
    const response = await apiClient.post('/instance/create', {
      instanceName: INSTANCE_NAME,
      token: EVOLUTION_API_KEY, // Pode deixar vazio
      qrcode: true // Pede para gerar o QR Code
    });
    console.log('Resposta da criação da instância:', response.data);
    return response.data;
  } catch (error) {
    // Ignora o erro "already exists" (se a instância já foi criada)
    if (error.response && error.response.status === 409) {
        console.warn('Instância já existe, pedindo conexão...');
        // Se já existe, só pede para conectar (que vai gerar um novo QR)
        return conectarInstancia();
    }
    console.error("Erro ao criar instância:", error.response?.data || error.message);
    throw new Error('Falha ao criar instância.');
  }
};

/**
 * Pede para a Evolution API gerar um novo QR Code para uma instância existente.
 */
export const conectarInstancia = async () => {
    try {
        const response = await apiClient.get(`/instance/connect/${INSTANCE_NAME}`);
        console.log('Resposta da conexão da instância:', response.data);
        return response.data;
    } catch (error) {
        console.error("Erro ao conectar instância:", error.response?.data || error.message);
        throw new Error('Falha ao conectar instância.');
    }
}

/**
 * Envia uma mensagem de texto (usado pelo seu portal)
 */
export const enviarTexto = async (numero, mensagem) => {
  try {
    // --- ESTA É A CORREÇÃO ---
    // Precisamos de incluir o INSTANCE_NAME na URL da chamada
    const url = `/message/sendText/${INSTANCE_NAME}`;
    
    const response = await apiClient.post(url, { // <-- O 'url' foi para aqui
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
    console.error("Erro ao enviar texto pela Evolution API:", error.response?.data || error.message);
    throw new Error('Falha ao enviar mensagem.');
  }
};