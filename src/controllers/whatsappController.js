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
        if (err) {
            console.error("Erro ao gerar QR Code URL:", err);
            return;
        }
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


// --- (INÍCIO DA CORREÇÃO) ---
client.on('message', async (message) => {
    console.log(`Mensagem recebida de ${message.from}: ${message.body}`); // Esta linha funciona
    
    // Procura o ÍNDICE do chat na lista
    const chatIndex = listaDeChats.findIndex(chat => chat.id === message.from);
    
    if (chatIndex !== -1) {
        // --- CHAT JÁ EXISTE ---
        // Apenas atualiza o timestamp para trazê-lo para o topo
        // (Usamos o timestamp atual em segundos)
        listaDeChats[chatIndex].timestamp = Math.floor(Date.now() / 1000); 
        console.log(`Timestamp atualizado para o chat: ${listaDeChats[chatIndex].name}`);
    } else {
        // --- CHAT NOVO ---
        // Tenta buscar os dados do chat e adicioná-lo
        try {
            const newChat = await message.getChat();
            if (newChat.isUser && !newChat.isMe) {
                listaDeChats.unshift({ // Adiciona no início da lista
                    id: newChat.id._serialized,
                    name: newChat.name || newChat.id.user, 
                    timestamp: newChat.timestamp || Math.floor(Date.now() / 1000)
                });
                console.log(`Novo chat adicionado: ${newChat.name}`);
            }
        } catch (err) {
            console.error("Erro ao buscar novo chat:", err);
        }
    }

    if (message.body.toLowerCase() === 'ping') {
        await client.sendMessage(message.from, 'pong');
    }
});
// --- (FIM DA CORREÇÃO) ---


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
    // Esta ordenação agora vai funcionar
    listaDeChats.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    
    res.status(200).json({
        status: statusConexao,
        chats: listaDeChats
    });
};