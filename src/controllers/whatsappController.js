// --- (INÍCIO DA CORREÇÃO) ---
// Importa o pacote como 'padrão'
import pkg from 'whatsapp-web.js';
// Extrai as classes que precisamos (Client e LocalAuth)
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode';

// Esta variável vai armazenar o QR Code para que o frontend possa buscá-lo
let qrCodeDataUrl = null;
let statusConexao = "Iniciando...";

// 1. Cria o cliente do WhatsApp
const client = new Client({
    authStrategy: new LocalAuth() // Salva a sessão localmente para não escanear sempre
});

// 2. Ouve o evento 'qr'
client.on('qr', (qr) => {
    // A biblioteca nos deu um texto de QR, vamos converter em imagem URL
    console.log('QR Code recebido, gerando imagem...');
    statusConexao = "Aguardando leitura do QR Code";
    qrcode.toDataURL(qr, (err, url) => {
        if (err) {
            console.error("Erro ao gerar QR Code URL:", err);
            return;
        }
        qrCodeDataUrl = url; // Salva a imagem URL na variável
    });
});

// 3. Ouve o evento 'ready' (conectado)
client.on('ready', () => {
    console.log('Cliente WhatsApp está pronto!');
    qrCodeDataUrl = null; // Limpa o QR Code, pois já foi lido
    statusConexao = "Conectado!";
});

// 4. Ouve o evento 'disconnected'
client.on('disconnected', (reason) => {
    console.log('Cliente foi desconectado:', reason);
    statusConexao = "Desconectado. Tentando reconectar...";
    qrCodeDataUrl = null;
    client.initialize(); // Tenta reconectar
});

// 5. Inicia o cliente
client.initialize();

// 6. Rota para o frontend buscar o status e o QR Code
export const getStatus = (req, res) => {
    res.status(200).json({
        status: statusConexao,
        qrCodeUrl: qrCodeDataUrl 
    });
};