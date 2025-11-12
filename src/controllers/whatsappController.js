// src/controllers/whatsappController.js
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode';

let qrCodeDataUrl = null;
let statusConexao = "Iniciando...";
let listaDeChats = []; 

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }
});

client.on('qr', (qr) => {
    console.log('QR Code recebido, gerando imagem...');
    statusConexao = "Aguardando leitura do QR Code";
    listaDeChats = []; 
    qrcode.toDataURL(qr, (err, url) => {
        if (err) { console.error("Erro ao gerar QR Code URL:", err); return; }
        qrCodeDataUrl = url; 
    });
});

client.on('ready', async () => {
    console.log('Cliente WhatsApp está pronto!');
    qrCodeDataUrl = null; 
    statusConexao = "Conectado! Carregando chats..."; 

    try {
        const chats = await client.getChats();
        console.log(`Encontrou ${chats.length} chats no total.`);

        listaDeChats = chats
            .filter(chat => chat.isUser && !chat.isMe && !chat.isGroup) 
            .map(chat => {
                return {
                    id: chat.id._serialized,
                    name: chat.name || chat.id.user,
                    timestamp: chat.timestamp
                };
            });
        
        console.log(`Carregou ${listaDeChats.length} chats de usuários.`);
        statusConexao = "Conectado!"; 
    } catch (err) {
        console.error("Erro CRÍTICO ao buscar chats no 'ready':", err);
        statusConexao = "Conectado! (Erro ao carregar chats)";
    }
});


// --- (INÍCIO DA CORREÇÃO DEFINITIVA) ---
client.on('message', async (message) => {
    console.log(`Mensagem recebida de ${message.from}: ${message.body}`);
    
    const chatIndex = listaDeChats.findIndex(chat => chat.id === message.from);
    
    if (chatIndex !== -1) {
        // --- CHAT JÁ EXISTE ---
        // Apenas atualiza o timestamp
        listaDeChats[chatIndex].timestamp = message.timestamp || Math.floor(Date.now() / 1000); 
        console.log(`Timestamp atualizado para o chat: ${listaDeChats[chatIndex].name}`);
    
    } else {
        // --- CHAT NOVO ---
        // NÃO vamos usar 'await message.getChat()' pois é instável.
        // Vamos criar o chat manualmente com o que temos.
        
        // Tenta pegar o nome (como aparece na notificação) ou usa o número
        const newChatName = message._data.notifyName || message.from.split('@')[0];
        
        listaDeChats.unshift({ 
            id: message.from,
            name: newChatName, 
            timestamp: message.timestamp || Math.floor(Date.now() / 1000)
        });
        console.log(`Novo chat ADICIONADO (via mensagem): ${newChatName}`);
    }

    if (message.body.toLowerCase() === 'ping') {
        await client.sendMessage(message.from, 'pong');
    }
});
// --- (FIM DA CORREÇÃO DEFINITIVA) ---


client.on('disconnected', (reason) => {
    console.log('Cliente foi desconectado:', reason);
    statusConexao = "Desconectado. Tentando reconectar...";
    qrCodeDataUrl = null;
    listaDeChats = [];
    client.initialize(); 
});

client.initialize();

export const getStatus = (req, res) => {
    res.status(200).json({
        status: statusConexao,
        qrCodeUrl: qrCodeDataUrl 
    });
};

export const getChats = (req, res) => {
    listaDeChats.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    res.status(200).json({
        status: statusConexao,
        chats: listaDeChats
    });
};