// src/controllers/whatsappController.js
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode';

let qrCodeDataUrl = null;
let statusConexao = "Iniciando...";
let listaDeChats = []; // (NOVO) Variável para guardar os chats

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }
});

client.on('qr', (qr) => {
    console.log('QR Code recebido, gerando imagem...');
    statusConexao = "Aguardando leitura do QR Code";
    listaDeChats = []; // (NOVO) Limpa os chats se precisar reconectar
    qrcode.toDataURL(qr, (err, url) => {
        if (err) {
            console.error("Erro ao gerar QR Code URL:", err);
            return;
        }
        qrCodeDataUrl = url; 
    });
});

// (NOVO) Adicionado 'async'
client.on('ready', async () => {
    console.log('Cliente WhatsApp está pronto!');
    qrCodeDataUrl = null; 
    statusConexao = "Conectado!";
    
    // (NOVO) Busca os chats assim que conectar
    try {
        const chats = await client.getChats();
        // Filtra para pegar apenas conversas de usuário (não grupos)
        listaDeChats = chats
            .filter(chat => chat.isUser && !chat.isMe) // Filtra apenas usuários (e não você mesmo)
            .map(chat => {
                return {
                    id: chat.id._serialized, // ex: "5511999998888@c.us"
                    name: chat.name || chat.id.user, // Nome (ou o número se não tiver nome)
                    timestamp: chat.timestamp
                };
            });
        console.log(`Carregou ${listaDeChats.length} chats.`);
    } catch (err) {
        console.error("Erro ao buscar chats:", err);
    }
});

client.on('message', async (message) => {
    console.log(`Mensagem recebida de ${message.from}: ${message.body}`);
    
    // (NOVO) Atualiza a lista de chats se for uma nova conversa
    const chatExiste = listaDeChats.find(chat => chat.id === message.from);
    if (!chatExiste) {
        try {
            const newChat = await message.getChat();
            if (newChat.isUser && !newChat.isMe) {
                listaDeChats.unshift({ // Adiciona no início da lista
                    id: newChat.id._serialized,
                    name: newChat.name || newChat.id.user,
                    timestamp: newChat.timestamp
                });
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
    listaDeChats = []; // (NOVO) Limpa os chats
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

// (NOVO) Endpoint para buscar os chats
export const getChats = (req, res) => {
    // Ordena por timestamp mais recente
    listaDeChats.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    
    res.status(200).json({
        status: statusConexao,
        chats: listaDeChats
    });
};