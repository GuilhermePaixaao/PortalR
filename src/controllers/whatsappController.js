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

        // (ATUALIZADO) Removemos o filtro '!chat.isGroup' para incluir grupos
        listaDeChats = chats
            .filter(chat => (chat.isUser || chat.isGroup) && !chat.isMe) 
            .map(chat => {
                return {
                    id: chat.id._serialized,
                    name: chat.name || chat.id.user,
                    isGroup: chat.isGroup, // (NOVO) Informa ao frontend se é um grupo
                    timestamp: chat.timestamp
                };
            });
        
        console.log(`Carregou ${listaDeChats.length} chats e grupos.`);
        statusConexao = "Conectado!"; 
    } catch (err) {
        console.error("Erro CRÍTICO ao buscar chats no 'ready':", err);
        statusConexao = "Conectado! (Erro ao carregar chats)";
    }
});

client.on('message', async (message) => {
    console.log(`Mensagem recebida de ${message.from}: ${message.body}`);
    
    // (ATUALIZADO) Lógica para atualizar timestamp de chats OU grupos
    const chatIndex = listaDeChats.findIndex(chat => chat.id === message.from || chat.id === message.to);
    const chatID = message.fromMe ? message.to : message.from; // ID correto do chat

    if (chatIndex !== -1) {
        // --- CHAT JÁ EXISTE ---
        listaDeChats[chatIndex].timestamp = message.timestamp || Math.floor(Date.now() / 1000); 
        console.log(`Timestamp atualizado para o chat: ${listaDeChats[chatIndex].name}`);
    
    } else {
        // --- CHAT NOVO ---
        try {
            const newChat = await message.getChat();
            if ((newChat.isUser || newChat.isGroup) && !newChat.isMe) {
                listaDeChats.unshift({ 
                    id: newChat.id._serialized,
                    name: newChat.name || newChat.id.user, 
                    isGroup: newChat.isGroup,
                    timestamp: newChat.timestamp || Math.floor(Date.now() / 1000)
                });
                console.log(`Novo chat ADICIONADO: ${newChat.name}`);
            }
        } catch(err) {
            console.error("Erro ao adicionar novo chat via mensagem:", err);
        }
    }

    if (message.body.toLowerCase() === 'ping') {
        await client.sendMessage(chatID, 'pong');
    }
});

client.on('disconnected', (reason) => {
    console.log('Cliente foi desconectado:', reason);
    statusConexao = "Desconectado. Tentando reconectar...";
    qrCodeDataUrl = null;
    listaDeChats = [];
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

// Endpoint para buscar os chats (permanece igual na lógica)
export const getChats = (req, res) => {
    listaDeChats.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    res.status(200).json({
        status: statusConexao,
        chats: listaDeChats
    });
};

// --- (INÍCIO DAS NOVAS FUNÇÕES) ---

/**
 * (NOVO) Busca o histórico de mensagens de um chat específico.
 */
export const getMessagesForChat = async (req, res) => {
    const { chatId } = req.params;
    if (!chatId) {
        return res.status(400).json({ error: "ID do chat não fornecido." });
    }

    try {
        const chat = await client.getChatById(chatId);
        // Busca as últimas 50 mensagens
        const messages = await chat.fetchMessages({ limit: 50 });

        // Formata as mensagens para o frontend
        const formattedMessages = messages.map(msg => {
            return {
                id: msg.id._serialized,
                fromMe: msg.fromMe, // true se a mensagem foi enviada por você
                body: msg.body,
                timestamp: msg.timestamp
            };
        });
        
        res.status(200).json({ messages: formattedMessages });

    } catch (err) {
        console.error(`Erro ao buscar mensagens para ${chatId}:`, err);
        res.status(500).json({ error: "Erro ao buscar mensagens." });
    }
};

/**
 * (NOVO) Envia uma mensagem para um chat.
 */
export const sendMessageToChat = async (req, res) => {
    const { chatId, message } = req.body;
    if (!chatId || !message) {
        return res.status(400).json({ error: "ID do chat e mensagem são obrigatórios." });
    }

    try {
        const response = await client.sendMessage(chatId, message);
        res.status(201).json({ success: true, messageId: response.id._serialized });
    } catch (err) {
        console.error(`Erro ao enviar mensagem para ${chatId}:`, err);
        res.status(500).json({ error: "Erro ao enviar mensagem." });
    }
};
// --- (FIM DAS NOVAS FUNÇÕES) ---