import * as evolutionService from '../services/evolutionService.js';
import { OpenAI } from 'openai';

// ==================================================
// 1. CONFIGURAÇÕES
// ==================================================
const groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY, 
    baseURL: "https://api.groq.com/openai/v1"
});

const MODELO_IA = "llama-3.1-8b-instant"; 
const processedMessageIds = new Set();

const SISTEMA_PROMPT = `
Você é o assistente de triagem do Suporte Técnico (T.I.) do Supermercado Rosalina.
Sua missão é EXCLUSIVAMENTE tirar dúvidas sobre: uso do sistema interno, problemas com impressoras, internet, computadores e abertura de chamados.
Se não souber, peça para digitar #.
`;

// --- MEMÓRIA LOCAL (CRUCIAL PARA A FILA) ---
// Estrutura: { '55129...': { etapa: 'MENU', nomeAgente: null, ... } }
const userContext = {};

// ==================================================
// 2. MENSAGENS FIXAS
// ==================================================
const MENSAGENS = {
    SAUDACAO: (nome) => `Olá *${nome}* bem-vindo(a) ao suporte interno do Supermercado Rosalina. 
    Escolha uma fila de atendimento:
            1 - Suporte T.I (Falar com Humano)
            * - Consultar um ticket
            # - Encerrar`,
    MENU_TI_COM_FILA: `✅ *Você entrou na Fila de Suporte T.I.*
     Aguarde um momento que um humano irá te responder.`,
    ENCERRAMENTO: `Atendimento encerrado. Obrigado!`
};

// ==================================================
// 3. INTELIGÊNCIA ARTIFICIAL
// ==================================================
async function processarComGroq(numeroUsuario, textoUsuario) {
    const contexto = userContext[numeroUsuario];
    if (!contexto || contexto.botPausado) return null;

    try {
        if (!contexto.historico) contexto.historico = [{ role: "system", content: SISTEMA_PROMPT }];
        contexto.historico.push({ role: "user", content: textoUsuario });

        const completion = await groq.chat.completions.create({
            messages: contexto.historico,
            model: MODELO_IA,
            temperature: 0.1, 
            max_tokens: 150,  
        });
        const respostaIA = completion.choices[0]?.message?.content || "";
        if (respostaIA) contexto.historico.push({ role: "assistant", content: respostaIA });
        return respostaIA;
    } catch (erro) { return null; }
}

// ==================================================
// 4. WEBHOOK (LÓGICA PRINCIPAL)
// ==================================================
export const handleWebhook = async (req, res) => {
  const payload = req.body;
  const io = req.io;

  try {
    if (payload.event === 'qrcode.updated') io.emit('qrCodeRecebido', { qr: payload.data?.qrcode?.base64 });
    if (payload.event === 'connection.update') io.emit('statusConexao', { status: payload.data.state });

    if (payload.event === 'messages.upsert' && payload.data?.message) {
      const msg = payload.data;
      const idRemoto = msg.key.remoteJid;
      const isFromMe = msg.key.fromMe;
      
      if (processedMessageIds.has(msg.key.id)) return res.status(200).json({ success: true });
      processedMessageIds.add(msg.key.id);

      const nomeAutor = msg.pushName || idRemoto.split('@')[0];
      const texto = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || "").trim();

      if (idRemoto !== 'status@broadcast' && !idRemoto.includes('@g.us') && texto) {
        
        // Envia para o front (Socket)
        io.emit('novaMensagemWhatsapp', { 
            id: msg.key.id, 
            chatId: idRemoto, 
            nome: nomeAutor, 
            texto: texto, 
            fromMe: isFromMe,
            // Envia se deve aparecer na fila ou não baseado no contexto atual
            mostrarNaFila: userContext[idRemoto]?.mostrarNaFila || false 
        });

        if (!isFromMe) {
            // Inicializa contexto se não existir
            if (!userContext[idRemoto]) userContext[idRemoto] = { etapa: 'INICIO', botPausado: false, mostrarNaFila: false };
            const ctx = userContext[idRemoto];
            let respostaBot = null;
            
            const textoMin = texto.toLowerCase();
            const saudacoes = ['oi', 'ola', 'olá', 'oie', 'bom dia', 'boa tarde', 'teste'];
            const ehSaudacao = saudacoes.some(s => textoMin.startsWith(s));

            // --- LÓGICA DE NAVEGAÇÃO ---

            // 1. Início / Saudação
            if (ehSaudacao || ctx.etapa === 'INICIO') {
                ctx.etapa = 'MENU';
                ctx.botPausado = false;
                ctx.mostrarNaFila = false; // Ainda não digitou 1, não mostra na fila
                respostaBot = MENSAGENS.SAUDACAO(nomeAutor);
            }
            
            // 2. Digitou 1 -> VAI PARA A FILA
            else if (ctx.etapa === 'MENU' && (texto === '1' || textoMin.includes('suporte'))) {
                ctx.etapa = 'FILA_DE_ESPERA';
                ctx.botPausado = true; // Pausa o bot pois está na fila
                ctx.mostrarNaFila = true; // <--- AGORA APARECE NO FRONTEND
                respostaBot = MENSAGENS.MENU_TI_COM_FILA;

                // Notifica o painel que entrou um novo chamado na fila
                io.emit('notificacaoChamado', { chatId: idRemoto, nome: nomeAutor });
            }

            // 3. Fallback IA (Se não estiver na fila nem em atendimento)
            else if (!ctx.botPausado && !ctx.mostrarNaFila) {
                respostaBot = await processarComGroq(idRemoto, texto);
            }

            // Envio da resposta
            if (respostaBot) {
                await evolutionService.enviarTexto(idRemoto, respostaBot);
                io.emit('novaMensagemWhatsapp', { 
                    id: 'bot-'+Date.now(), 
                    chatId: idRemoto, 
                    nome: "Bot", 
                    texto: respostaBot, 
                    fromMe: true,
                    mostrarNaFila: ctx.mostrarNaFila 
                });
            }
        }
      }
    }
    res.status(200).json({ success: true });
  } catch (error) { console.error(error); res.status(500).json({ success: false }); }
};

// ==================================================
// 5. ROTAS DE API (ATENDIMENTO E LISTAGEM)
// ==================================================

export const atenderAtendimento = async (req, res) => {
    const { numero, nomeAgente } = req.body;
    try {
        if (!userContext[numero]) userContext[numero] = {};
        userContext[numero].etapa = 'ATENDIMENTO_HUMANO';
        userContext[numero].botPausado = true;
        userContext[numero].nomeAgente = nomeAgente;
        userContext[numero].mostrarNaFila = true; // Continua aparecendo na fila, mas como "Em atendimento"

        await evolutionService.enviarTexto(numero, `👨‍💻 *${nomeAgente}* assumiu seu atendimento.`);
        res.status(200).json({ success: true });
    } catch (error) { res.status(500).json({ success: false }); }
};

// --- O SEGREDO ESTÁ AQUI: FILTRAR NA LISTAGEM ---
export const listarConversas = async (req, res) => { 
    try { 
        const chatsDaEvolution = await evolutionService.buscarConversas(); 
        
        // Mapeia e adiciona as flags do nosso sistema (userContext)
        const chatsFormatados = chatsDaEvolution.map(chat => {
            const numero = chat.id;
            const ctx = userContext[numero] || {};
            
            // Apenas mostra se estiver marcado como 'mostrarNaFila' (digitou 1) 
            // OU se tiver mensagens não lidas (opcional, pra não perder msgs perdidas)
            // No seu caso, pediu só quem digitou 1.
            const deveAparecer = ctx.mostrarNaFila === true || ctx.etapa === 'ATENDIMENTO_HUMANO';

            return { 
                numero: chat.id, 
                nome: chat.pushName || chat.id.split('@')[0], 
                ultimaMensagem: chat.conversation || "...", 
                unread: chat.unreadCount > 0,
                // Envia flag pro front filtrar
                visivel: deveAparecer 
            };
        });

        // Filtra no backend ou envia tudo e o front filtra. 
        // Vamos enviar tudo com a flag 'visivel' e o front decide, pra ser mais flexível.
        res.status(200).json({ success: true, data: chatsFormatados }); 
    } catch (e) { res.status(200).json({ success: true, data: [] }); } 
};

// Outras rotas mantidas
export const handleSendMessage = async (req, res) => {
  const { numero, mensagem, nomeAgenteTemporario } = req.body;
  try {
      // Se o agente mandou mensagem, garante que aparece na fila
      if (!userContext[numero]) userContext[numero] = {};
      userContext[numero].mostrarNaFila = true; 
      
      const msgFinal = `*${nomeAgenteTemporario || "Atendente"}*\n\n${mensagem}`;
      const r = await evolutionService.enviarTexto(numero, msgFinal);
      res.status(200).json({ success: true, data: r });
  } catch (e) { res.status(500).json({ success: false }); }
};
export const connectInstance = async (req, res) => { try { const r = await evolutionService.criarInstancia(); res.status(200).json({ success: true, data: r }); } catch (e) { res.status(500).json({ success: false }); } };
export const checarStatus = async (req, res) => { try { const r = await evolutionService.consultarStatus(); res.status(200).json({ success: true, data: r }); } catch (e) { res.status(500).json({ success: false }); } };
export const configurarUrlWebhook = async (req, res) => { try { const h = req.get('host'); const p = h.includes('localhost') ? 'http' : 'https'; await evolutionService.configurarWebhook(`${p}://${h}/api/evolution/webhook`); res.status(200).json({ success: true }); } catch (e) { res.status(500).json({ success: false }); } };