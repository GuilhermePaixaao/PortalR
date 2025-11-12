// src/controllers/whatsappController.js
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode';

let qrCodeDataUrl = null;
let statusConexao = "Iniciando...";
let listaDeChats = []; // Nossos chats começarão vazios

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }
});

client.on('qr', (qr) => {
    console.log('QR Code recebido, gerando imagem...');
    statusConexao = "Aguardando leitura do QR Code";
    listaDeChats = []; // Limpa os chats se precisar reconectar
    qrcode.toDataURL(qr, (err, url) => {
        if (err) {
            console.error("Erro ao gerar QR Code URL:", err);
            return;
        }
        qrCodeDataUrl = url; 
    });
});

// (ATUALIZADO) Removemos o 'async' e a busca por 'getChats()'
client.on('ready', () => {
    console.log('Cliente WhatsApp está pronto!');
    qrCodeDataUrl = null; 
    statusConexao = "Conectado!";
    // Não vamos mais buscar os chats aqui, vamos esperar as mensagens chegarem.
});

client.on('message', async (message) => {
    console.log(`Mensagem recebida de ${message.from}: ${message.body}`);
    
    // Verifica se já temos esse chat na nossa lista
    const chatExiste = listaDeChats.find(chat => chat.id === message.from);
    
    // Se for um chat novo, adiciona ele na lista
    if (!chatExiste) {
        try {
            const newChat = await message.getChat();
            if (newChat.isUser && !newChat.isMe) {
                listaDeChats.unshift({ // Adiciona no início da lista
                    id: newChat.id._serialized,
                    name: newChat.name || newChat.id.user, // Nome ou número
                    timestamp: newChat.timestamp
                });
                console.log(`Novo chat adicionado: ${newChat.name}`);
            }
        } catch (err) {
            console.error("Erro ao buscar novo chat:", err);
        }
    }

    // Resposta de teste
    if (message.body.toLowerCase() === 'ping') {
        await client.sendMessage(message.from, 'pong');
    }
});

client.on('disconnected', (reason) => {
    console.log('Cliente foi desconectado:', reason);
    statusConexao = "Desconectado. Tentando reconectar...";
    qrCodeDataUrl = null;
    listaDeChats = []; // Limpa os chats
    client.initialize(); 
});

client.initialize();

// Endpoint de Status (permanece igual)
export const getStatus = (req, res) => {
    res.status(200).json({
        status: statusConexao,
        qrCodeUrl: qrCodeDataUrl 
    });
};

// Endpoint para buscar os chats (permanece igual)
export const getChats = (req, res) => {
    // Ordena por timestamp mais recente
    listaDeChats.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    
    res.status(200).json({
        status: statusConexao,
        chats: listaDeChats
    });
};