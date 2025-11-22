import * as evolutionService from '../services/evolutionService.js';
import { OpenAI } from 'openai';

// ==================================================
// 1. CONFIGURAÇÕES GERAIS
// ==================================================
const groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY, 
    baseURL: "https://api.groq.com/openai/v1"
});

const MODELO_IA = "llama-3.1-8b-instant"; 

// --- PROTEÇÃO ANTI-DUPLICAÇÃO (EVITA MENSAGENS REPETIDAS) ---
const processedMessageIds = new Set();

const SISTEMA_PROMPT = `
Você é o assistente virtual de triagem do Suporte Técnico (T.I.) do Supermercado Rosalina.
Sua missão é EXCLUSIVAMENTE tirar dúvidas sobre: uso do sistema interno, problemas com impressoras, internet, computadores e abertura de chamados.

REGRAS RÍGIDAS DE COMPORTAMENTO:
1. Se o usuário perguntar sobre qualquer assunto que NÃO seja T.I. ou funcionamento do mercado, responda:
"Desculpe, meu sistema é limitado exclusivamente para suporte técnico e dúvidas operacionais."
2. Seja direto, técnico e educado.
3. Responda de forma breve (máximo 2 frases).
4. Se não souber a resposta técnica, peça para ele digitar # para falar com um humano.
5. Se receber mensagens curtas como "ata", "ok", "entendi", responda: "Certo. Algo mais?"
`;

// Memória local
const userContext = {};

// ==================================================
// 2. TEXTOS FIXOS
// ==================================================
const MENSAGENS = {
    OPCAO_INVALIDA: `⚠️ *Opção inválida.*\nPor favor, digite apenas o número da opção (ex: 1) ou descreva sua dúvida.`,
    
    FILA_TI: `✅ *Entendido.*\nVocê entrou na fila de atendimento do Suporte T.I. Aguarde um momento.`,
    
    AVALIACAO_INICIO: `Atendimento finalizado. Avalie nosso suporte:\n1.😔 Péssimo\n2.🙁 Ruim\n3.😐 Regular\n4.😀 Bom\n5.🤩 Excelente\n9.❌ Não avaliar`,
    
    AVALIACAO_MOTIVO: `Obrigado pela nota. Se quiser, descreva o motivo ou digite 9 para encerrar.`,
    
    ENCERRAMENTO_FINAL: `Obrigado! Caso precise de algo novo, é só chamar.`
};

// ==================================================
// 3. IA (GROQ)
// ==================================================
async function processarComGroq(numeroUsuario, textoUsuario, nomeUsuario) {
    const contexto = userContext[numeroUsuario];
    if (!contexto || contexto.botPausado) return null;

    try {
        if (!contexto.historico || contexto.historico.length === 0) {
            contexto.historico = [{ role: "system", content: SISTEMA_PROMPT }];
        }
        contexto.historico.push({ role: "user", content: textoUsuario });
        if (contexto.historico.length > 12) {
            contexto.historico = [contexto.historico[0], ...contexto.historico.slice(-10)];
        }

        const completion = await groq.chat.completions.create({
            messages: contexto.historico, model: MODELO_IA, temperature: 0.1, max_tokens: 150,
        });

        const respostaIA = completion.choices[0]?.message?.content || "";
        if (respostaIA) contexto.historico.push({ role: "assistant", content: respostaIA });
        return respostaIA;
    } catch (erro) {
        console.error("[GROQ] Erro na IA:", erro);
        return null; 
    }
}

// ==================================================
// 4. WEBHOOK (MENU EM TEXTO)
// ==================================================
export const handleWebhook = async (req, res) => {
  const payload = req.body;
  const io = req.io;

  try {
    if (payload.event === 'qrcode.updated') io.emit('qrCodeRecebido', { qr: payload.data?.qrcode?.base64 });
    if (payload.event === 'connection.update') io.emit('statusConexao', { status: payload.data.state });

    if (payload.event === 'messages.upsert' && payload.data?.message) {
      const msg = payload.data;
      const idMensagem = msg.key.id; 
      const idRemoto = msg.key.remoteJid;
      const isFromMe = msg.key.fromMe;
      
      // --- BLOQUEIO DE DUPLICAÇÃO ---
      if (processedMessageIds.has(idMensagem)) return res.status(200).json({ success: true });
      processedMessageIds.add(idMensagem);
      setTimeout(() => processedMessageIds.delete(idMensagem), 10000);

      const nomeAutor = msg.pushName || idRemoto.split('@')[0];
      const texto = (
          msg.message?.conversation || 
          msg.message?.extendedTextMessage?.text || 
          ""
      ).trim();

      const isGroup = idRemoto.includes('@g.us'); 
      const isStatus = idRemoto === 'status@broadcast'; 

      if (!isStatus && !isGroup && texto) {
        
        io.emit('novaMensagemWhatsapp', { id: idMensagem, chatId: idRemoto, nome: nomeAutor, texto: texto, fromMe: isFromMe });

        if (!isFromMe) {
            if (!userContext[idRemoto]) userContext[idRemoto] = { etapa: 'INICIO', botPausado: false, historico: [] };
            const ctx = userContext[idRemoto];
            let respostaBot = null;
            const textoMin = texto.toLowerCase();

            const saudacoes = ['oi', 'ola', 'olá', 'menu', 'bom dia', 'boa tarde', 'boa noite', 'opa', 'e ai', 'hey', 'saudações', 'inicio', 'start', 'ata', 'ok', 'entendi', 'teste'];
            const ehSaudacao = saudacoes.includes(textoMin) || saudacoes.some(s => textoMin.startsWith(s + ' '));

            // ------------------------------------------------------------------
            // 1. MENU PRINCIPAL (AGORA EM TEXTO PURO - SEM BOTÕES)
            // ------------------------------------------------------------------
            if (ehSaudacao) {
                ctx.etapa = 'MENU';
                ctx.botPausado = false;
                ctx.nomeAgente = null;
                ctx.historico = [{ role: "system", content: SISTEMA_PROMPT }];

                // MENU FORMATADO COM EMOJIS E NEGRITO
                const menuTexto = `🤖 *Suporte T.I - Supermercado Rosalina*

Olá *${nomeAutor}*! 👋
Sou seu assistente virtual. Para prosseguir, digite o número da opção desejada:

1️⃣ - *Suporte T.I* (Computadores, Impressoras, Sistema)
2️⃣ - *Consultar Ticket*
*️⃣ - *Encerrar Atendimento*

_Digite apenas o número da opção._`;

                // ENVIA COMO TEXTO NORMAL (Funciona sempre)
                await evolutionService.enviarTexto(idRemoto, menuTexto);
                
                io.emit('novaMensagemWhatsapp', { 
                    id: 'menu-' + Date.now(), 
                    chatId: idRemoto, 
                    nome: "Bot", 
                    texto: menuTexto, 
                    fromMe: true 
                });
                
                return res.status(200).json({ success: true });
            }
            
            // 2. ENCERRAR (#)
            else if (texto === '#' || texto.toLowerCase() === 'encerrar') {
                respostaBot = MENSAGENS.AVALIACAO_INICIO;
                ctx.etapa = 'AVALIACAO_NOTA';
                ctx.botPausado = true; 
                ctx.nomeAgente = null;
            }

            // 3. LÓGICA DO MENU (Detecta números ou texto)
            else if (ctx.etapa === 'MENU') {
                if (texto === '1' || texto.toLowerCase().includes('suporte')) {
                    respostaBot = MENSAGENS.FILA_TI;
                    ctx.etapa = 'FILA'; 
                    ctx.botPausado = true; 
                } 
                else if (texto === '2' || texto.toLowerCase().includes('ticket') || texto.startsWith('*')) {
                    respostaBot = `🔍 *Consultando ticket...*\n(Funcionalidade em simulação)`;
                } 
                else {
                    // Se não digitou número, manda pra IA tentar ajudar
                    console.log("🤔 Texto livre no menu, enviando para IA...");
                    respostaBot = await processarComGroq(idRemoto, texto, nomeAutor);
                    if (!respostaBot) respostaBot = MENSAGENS.OPCAO_INVALIDA;
                }
            }

            // 4. FILA (Silêncio)
            else if (ctx.etapa === 'FILA') { /* Espera humano */ }

            // 5. AVALIAÇÃO
            else if (ctx.etapa === 'AVALIACAO_NOTA') {
                if (['1', '2', '3', '4', '5'].includes(texto)) {
                    respostaBot = MENSAGENS.AVALIACAO_MOTIVO;
                    ctx.etapa = 'AVALIACAO_MOTIVO';
                } else if (texto === '9') {
                    respostaBot = MENSAGENS.ENCERRAMENTO_FINAL;
                    delete userContext[idRemoto];
                } else {
                    respostaBot = MENSAGENS.OPCAO_INVALIDA;
                }
            }

            else if (ctx.etapa === 'AVALIACAO_MOTIVO') {
                respostaBot = MENSAGENS.ENCERRAMENTO_FINAL;
                delete userContext[idRemoto]; 
            }

            // 6. FALLBACK DA IA
            else if (!respostaBot && !ctx.botPausado && ctx.etapa === 'INICIO') {
                respostaBot = await processarComGroq(idRemoto, texto, nomeAutor);
            }

            // ENVIO DA RESPOSTA FINAL
            if (respostaBot) {
                await evolutionService.enviarTexto(idRemoto, respostaBot);
                io.emit('novaMensagemWhatsapp', { id: 'bot-'+Date.now(), chatId: idRemoto, nome: "Bot", texto: respostaBot, fromMe: true });
            }
        }
      }
    }
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Erro:', error);
    res.status(500).json({ success: false });
  }
};

// ==================================================
// 5. FUNÇÕES DO PAINEL
// ==================================================
export const atenderAtendimento = async (req, res) => {
    const { numero, nomeAgente } = req.body;
    try {
        if (!userContext[numero]) userContext[numero] = { historico: [] };
        userContext[numero].nomeAgente = nomeAgente;
        userContext[numero].botPausado = true; 
        userContext[numero].etapa = 'ATENDIMENTO_HUMANO';
        const msg = `*Atendimento iniciado*\nAgora você está falando com *${nomeAgente}*.`;
        await evolutionService.enviarTexto(numero, msg);
        res.status(200).json({ success: true });
    } catch (error) { res.status(500).json({ success: false }); }
};

export const finalizarAtendimento = async (req, res) => {
    const { numero } = req.body;
    try {
        if (!userContext[numero]) userContext[numero] = {};
        userContext[numero].etapa = 'AVALIACAO_NOTA';
        userContext[numero].botPausado = true;
        userContext[numero].nomeAgente = null;
        const msg = MENSAGENS.AVALIACAO_INICIO;
        await evolutionService.enviarTexto(numero, msg);
        res.status(200).json({ success: true });
    } catch (error) { res.status(500).json({ success: false }); }
};

export const handleSendMessage = async (req, res) => {
  const { numero, mensagem, nomeAgenteTemporario } = req.body;
  try {
      let mensagemFinal = mensagem;
      const contexto = userContext[numero];
      if (contexto && contexto.nomeAgente) mensagemFinal = `*${contexto.nomeAgente}*:\n${mensagem}`;
      else if (nomeAgenteTemporario) mensagemFinal = `*${nomeAgenteTemporario}*:\n${mensagem}`;
      const r = await evolutionService.enviarTexto(numero, mensagemFinal);
      res.status(200).json({ success: true, data: r });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

export const connectInstance = async (req, res) => { try { const r = await evolutionService.criarInstancia(); res.status(200).json({ success: true, data: r }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
export const checarStatus = async (req, res) => { try { const r = await evolutionService.consultarStatus(); res.status(200).json({ success: true, data: r }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
export const listarConversas = async (req, res) => { try { const c = await evolutionService.buscarConversas(); const m = c.map(x => ({ numero: x.id, nome: x.pushName || x.id.split('@')[0], ultimaMensagem: x.conversation || "...", unread: x.unreadCount > 0 })); res.status(200).json({ success: true, data: m }); } catch (e) { res.status(200).json({ success: true, data: [] }); } };
export const configurarUrlWebhook = async (req, res) => { try { const h = req.get('host'); const p = h.includes('localhost') ? 'http' : 'https'; await evolutionService.configurarWebhook(`${p}://${h}/api/evolution/webhook`); res.status(200).json({ success: true }); } catch (e) { res.status(500).json({ success: false }); } };