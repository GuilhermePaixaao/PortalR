import * as evolutionService from '../services/evolutionService.js';
import { OpenAI } from 'openai';

// ==================================================
// 1. CONFIGURAÇÕES DA GROQ (GRÁTIS)
// ==================================================
const groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY, 
    baseURL: "https://api.groq.com/openai/v1"
});

const MODELO_IA = "llama3-8b-8192"; 

const SISTEMA_PROMPT = `
Você é o assistente virtual do Supermercado Rosalina.
Seu tom é educado, prestativo e breve (respostas curtas para WhatsApp).
Você ajuda com dúvidas sobre horário de funcionamento, localização e produtos.
Se não souber algo, peça para o cliente digitar # para falar com um humano.
`;

const userContext = {};

// ==================================================
// 2. TEXTOS FIXOS (MENU)
// ==================================================
const MENSAGENS = {
    SAUDACAO: (nome) => `Olá ${nome}, bem-vindo ao suporte do Supermercado Rosalina! 🛒

Como posso te ajudar hoje?
1️⃣ - Falar com Suporte T.I
#️⃣ - Finalizar atendimento

*Ou pode me fazer uma pergunta diretamente!*`,

    FILA_TI: `Certo! Você entrou na fila do Suporte T.I. 💻
Um técnico irá te atender em breve. 
(Digite # a qualquer momento para encerrar)`,

    AVALIACAO_INICIO: `Atendimento finalizado! 🏁
Para nos ajudar, avalie nosso atendimento:

1. 😠 Péssimo
2. 🙁 Ruim
3. 😐 Regular
4. 🙂 Bom
5. 🤩 Excelente
9. ❌ Sair`,

    ENCERRAMENTO_FINAL: `Obrigado pela sua avaliação! O Supermercado Rosalina agradece. Até logo! 👋`
};

// ==================================================
// 3. LÓGICA DA INTELIGÊNCIA ARTIFICIAL (GROQ)
// ==================================================
async function processarComGroq(numeroUsuario, textoUsuario, nomeUsuario) {
    const contexto = userContext[numeroUsuario];
    
    if (!contexto || contexto.botPausado) return null;

    try {
        if (!contexto.historico) {
            contexto.historico = [
                { role: "system", content: SISTEMA_PROMPT }
            ];
        }

        contexto.historico.push({ role: "user", content: textoUsuario });

        if (contexto.historico.length > 12) {
            contexto.historico = [contexto.historico[0], ...contexto.historico.slice(-10)];
        }

        const completion = await groq.chat.completions.create({
            messages: contexto.historico,
            model: MODELO_IA,
            temperature: 0.5, 
            max_tokens: 300,  
        });

        const respostaIA = completion.choices[0]?.message?.content || "";

        if (respostaIA) {
            contexto.historico.push({ role: "assistant", content: respostaIA });
        }

        return respostaIA;

    } catch (erro) {
        console.error("[GROQ] Erro na IA:", erro);
        return null; 
    }
}

// ==================================================
// 4. WEBHOOK (COM FILTRO DE GRUPOS)
// ==================================================
export const handleWebhook = async (req, res) => {
  const payload = req.body;
  const io = req.io;

  try {
    // Eventos de Sistema
    if (payload.event === 'qrcode.updated') io.emit('qrCodeRecebido', { qr: payload.data?.qrcode?.base64 });
    if (payload.event === 'connection.update') io.emit('statusConexao', { status: payload.data.state });

    // Processamento de Mensagem
    if (payload.event === 'messages.upsert' && payload.data?.message) {
      const msg = payload.data;
      const idRemoto = msg.key.remoteJid;
      const isFromMe = msg.key.fromMe;
      const nomeAutor = msg.pushName || idRemoto.split('@')[0];
      const texto = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || "").trim();

      // --- FILTROS DE SEGURANÇA ---
      const isGroup = idRemoto.includes('@g.us'); // Verifica se é grupo
      const isStatus = idRemoto === 'status@broadcast'; // Verifica se é status

      // Só processa se: NÃO for status, NÃO for grupo e TIVER texto
      if (!isStatus && !isGroup && texto) {
        
        // 1. Atualiza Painel
        io.emit('novaMensagemWhatsapp', { chatId: idRemoto, nome: nomeAutor, texto: texto, fromMe: isFromMe });

        // 2. Se a mensagem é do cliente
        if (!isFromMe) {
            
            // Inicializa contexto
            if (!userContext[idRemoto]) userContext[idRemoto] = { etapa: 'INICIO', botPausado: false, historico: [] };
            const ctx = userContext[idRemoto];
            let respostaBot = null;

            // --- A. REGRAS FIXAS ---
            
            if (['oi', 'ola', 'olá', 'menu'].includes(texto.toLowerCase())) {
                respostaBot = MENSAGENS.SAUDACAO(nomeAutor);
                ctx.etapa = 'MENU';
                ctx.botPausado = false;
                ctx.historico = [{ role: "system", content: SISTEMA_PROMPT }];
            }
            
            else if (texto === '#') {
                respostaBot = MENSAGENS.AVALIACAO_INICIO;
                ctx.etapa = 'AVALIACAO_NOTA';
                ctx.botPausado = true; 
            }

            else if (ctx.etapa === 'MENU') {
                if (texto === '1') {
                    respostaBot = MENSAGENS.FILA_TI;
                    ctx.etapa = 'FILA';
                    ctx.botPausado = true; 
                } 
            }

            else if (ctx.etapa === 'AVALIACAO_NOTA') {
                if (['1', '2', '3', '4', '5', '9'].includes(texto)) {
                    respostaBot = MENSAGENS.ENCERRAMENTO_FINAL;
                    delete userContext[idRemoto]; 
                } else {
                    respostaBot = "Por favor, digite apenas o número da nota (1 a 5).";
                }
            }

            // --- B. INTELIGÊNCIA ARTIFICIAL (GROQ) ---
            if (!respostaBot && !ctx.botPausado) {
                console.log("🤔 Consultando Groq AI...");
                respostaBot = await processarComGroq(idRemoto, texto, nomeAutor);
            }

            // --- C. ENVIO ---
            if (respostaBot) {
                await evolutionService.enviarTexto(idRemoto, respostaBot);
                io.emit('novaMensagemWhatsapp', { chatId: idRemoto, nome: "Bot (Groq)", texto: respostaBot, fromMe: true });
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
// 5. CONTROLES DO PAINEL (HUMANO)
// ==================================================
export const notificarAtribuicao = async (numero, nomeAgente) => {
    if(!userContext[numero]) userContext[numero] = { historico: [] };
    userContext[numero].botPausado = true; 
    
    const msg = `Atendimento assumido por ${nomeAgente}.`;
    await evolutionService.enviarTexto(numero, msg);
    return msg;
};

export const notificarFinalizacao = async (numero) => {
    if(userContext[numero]) {
        userContext[numero].etapa = 'AVALIACAO_NOTA';
        userContext[numero].botPausado = true; 
    }
    const msg = MENSAGENS.AVALIACAO_INICIO;
    await evolutionService.enviarTexto(numero, msg);
    return msg;
};

// Rotas auxiliares (sem mudanças)
export const connectInstance = async (req, res) => { try { const r = await evolutionService.criarInstancia(); res.status(200).json({ success: true, data: r }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
export const handleSendMessage = async (req, res) => { const { numero, mensagem } = req.body; try { const r = await evolutionService.enviarTexto(numero, mensagem); res.status(200).json({ success: true, data: r }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
export const checarStatus = async (req, res) => { try { const r = await evolutionService.consultarStatus(); res.status(200).json({ success: true, data: r }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
export const listarConversas = async (req, res) => { try { const c = await evolutionService.buscarConversas(); const m = c.map(x => ({ numero: x.id, nome: x.pushName || x.id.split('@')[0], ultimaMensagem: x.conversation || "...", unread: x.unreadCount > 0 })); res.status(200).json({ success: true, data: m }); } catch (e) { res.status(200).json({ success: true, data: [] }); } };
export const configurarUrlWebhook = async (req, res) => { try { const h = req.get('host'); const p = h.includes('localhost') ? 'http' : 'https'; await evolutionService.configurarWebhook(`${p}://${h}/api/evolution/webhook`); res.status(200).json({ success: true }); } catch (e) { res.status(500).json({ success: false }); } };