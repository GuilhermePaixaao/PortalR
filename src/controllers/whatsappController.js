// src/controllers/whatsappController.js
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode';

let qrCodeDataUrl = null;
let statusConexao = "Iniciando...";

// 1. Cria o cliente do WhatsApp
const client = new Client({
    authStrategy: new LocalAuth(),
    
    // --- (INÍCIO DA ADIÇÃO) ---
    // Adicione esta seção para desativar o sandbox no Docker
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }
    // --- (FIM DA ADIÇÃO) ---
});

// 2. Ouve o evento 'qr'
client.on('qr', (qr) => {
    // ... (o resto do seu código permanece igual) ...
    console.log('QR Code recebido, gerando imagem...');
    statusConexao = "Aguardando leitura do QR Code";
    qrcode.toDataURL(qr, (err, url) => {
        if (err) {
            console.error("Erro ao gerar QR Code URL:", err);
            return;
        }
        qrCodeDataUrl = url; 
    });
});

// 3. Ouve o evento 'ready' (conectado)
client.on('ready', () => {
    // ... (o resto do seu código permanece igual) ...
    console.log('Cliente WhatsApp está pronto!');
    qrCodeDataUrl = null; 
    statusConexao = "Conectado!";
});

// 4. Ouve o evento 'disconnected'
client.on('disconnected', (reason) => {
    // ... (o resto do seu código permanece igual) ...
    console.log('Cliente foi desconectado:', reason);
    statusConexao = "Desconectado. Tentando reconectar...";
    qrCodeDataUrl = null;
    client.initialize(); 
});

// 5. Inicia o cliente
client.initialize();

// 6. Rota para o frontend
export const getStatus = (req, res) => {
    // ... (o resto do seu código permanece igual) ...
    res.status(200).json({
        status: statusConexao,
        qrCodeUrl: qrCodeDataUrl 
    });
};