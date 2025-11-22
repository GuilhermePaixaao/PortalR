import * as evolutionService from '../services/evolutionService.js';
import { OpenAI } from 'openai';

// ==================================================
// 1. CONFIGURAÇÕES DA GROQ (IA)
// ==================================================
const groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY, 
    baseURL: "https://api.groq.com/openai/v1"
});

const MODELO_IA = "llama-3.1-8b-instant"; 

// --- CÉREBRO DO BOT (REGRAS RÍGIDAS) ---
const SISTEMA_PROMPT = `
Você é o assistente virtual de triagem do Suporte Técnico (T.I.) do Supermercado Rosalina.
Sua missão é EXCLUSIVAMENTE tirar dúvidas sobre: uso do sistema interno, problemas com impressoras, internet, computadores e abertura de chamados.

REGRAS RÍGIDAS DE COMPORTAMENTO (Protocolo de Bloqueio):
1. Se o usuário perguntar sobre qualquer assunto que NÃO seja T.I. ou funcionamento do mercado (ex: futebol, receitas, política, piadas, clima, conversa fiada), você DEVE responder APENAS:
"Desculpe, meu sistema é limitado exclusivamente para suporte técnico e dúvidas operacionais."

2. Não tente ser simpático demais. Seja direto, técnico e educado.
3. Responda de forma breve (máximo 2 frases).
4. Se não souber a resposta técnica ou se for um problema físico complexo, peça para ele digitar # para falar com um humano.
5. Se o usuário enviar mensagens curtas de concordância (ex: "ata", "entendi", "ok", "certo", "beleza"), responda APENAS: "Certo. Posso ajudar em algo mais?"
`;

// Memória local das conversas
const userContext = {};

// ==================================================
// 2. TEXTOS FIXOS
// ==================================================
const MENSAGENS = {
    // A saudação agora é gerada dinamicamente no código para incluir botões
    OPCAO_INVALIDA: `Opção inválida ou não entendi sua dúvida. Digite uma opção do menu ou tente reformular sua pergunta.`,

    FILA_TI: `Entendido. Você entrou na fila de atendimento do Suporte T.I. Aguarde um momento.`,

    AVALIACAO_INICIO: `Atendimento finalizado. Para melhorarmos, avalie nosso suporte:
1.😔 Péssimo
2.🙁 Ruim
3.😐 Regular
4.😀 Bom
5.🤩 Excelente
9.❌ Não avaliar`,

    AVALIACAO_MOTIVO: `Obrigado pela nota. Se quiser, descreva o motivo ou digite 9 para encerrar.`,

    ENCERRAMENTO_FINAL: `Obrigado! Caso precise de algo novo, é só chamar.`
};

// ==================================================
// 3. LÓGICA DA INTELIGÊNCIA ARTIFICIAL (GROQ)
// ==================================================
async function processarComGroq(numeroUsuario, textoUsuario, nomeUsuario) {
    const contexto = userContext[numeroUsuario];
    
    if (!contexto || contexto.botPausado) return null;

    try {
        // Inicializa histórico se não existir
        if (!contexto.historico || contexto.historico.length === 0) {
            contexto.historico = [
                { role: "system", content: SISTEMA_PROMPT }
            ];
        }

        contexto.historico.push({ role: "user", content: textoUsuario });

        // Mantém apenas as últimas 10 mensagens para economizar memória/tokens
        if (contexto.historico.length > 12) {
            contexto.historico = [contexto.historico[0], ...contexto.historico.slice(-10)];
        }

        const completion = await groq.chat.completions.create({
            messages: contexto.historico,
            model: MODELO_IA,
            temperature: 0.1, // <--- TEMPERATURA BAIXA: Deixa o bot "robótico" e fiel às regras
            max_tokens: 150,  
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
// 4. WEBHOOK PRINCIPAL
// ==================================================
export const handleWebhook = async (req, res) => {
  const payload = req.body;
  const io = req.io;

  try {
    // Eventos de conexão e QR Code
    if (payload.event === 'qrcode.updated') io.emit('qrCodeRecebido', { qr: payload.data?.qrcode?.base64 });
    if (payload.event === 'connection.update') io.emit('statusConexao', { status: payload.data.state });

    // Processamento de Mensagens
    if (payload.event === 'messages.upsert' && payload.data?.message) {
      const msg = payload.data;
      const idRemoto = msg.key.remoteJid;
      const isFromMe = msg.key.fromMe;
      const nomeAutor = msg.pushName || idRemoto.split('@')[0];
      
      // Captura segura de texto (Botão, Lista, Texto simples)
      const texto = (
          msg.message?.conversation || 
          msg.message?.extendedTextMessage?.text || 
          msg.message?.buttonsResponseMessage?.selectedButtonId || 
          msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId || 
          msg.message?.templateButtonReplyMessage?.selectedId ||
          ""
      ).trim();

      const isGroup = idRemoto.includes('@g.us'); 
      const isStatus = idRemoto === 'status@broadcast'; 

      // Só processa se tiver texto e não for grupo/status
      if (!isStatus && !isGroup && texto) {
        
        // Envia para o Front-end (Chat em tempo real)
        io.emit('novaMensagemWhatsapp', { chatId: idRemoto, nome: nomeAutor, texto: texto, fromMe: isFromMe });

        // --- LÓGICA DO BOT ---
        if (!isFromMe) {
            
            // Cria contexto se não existir
            if (!userContext[idRemoto]) userContext[idRemoto] = { etapa: 'INICIO', botPausado: false, historico: [] };
            const ctx = userContext[idRemoto];
            let respostaBot = null;
            const textoMin = texto.toLowerCase();

            // Lista expandida de gatilhos para menu direto
            const saudacoes = [
                'oi', 'ola', 'olá', 'menu', 'bom dia', 'boa tarde', 'boa noite', 
                'opa', 'e ai', 'hey', 'saudações', 'inicio', 'start',
                'ata', 'ok', 'entendi', 'teste' // <--- "Ata" e "Ok" agora puxam o menu se for no inicio
            ];
            
            // Verifica se a mensagem é exatamente uma saudação ou começa com uma
            const ehSaudacao = saudacoes.includes(textoMin) || saudacoes.some(s => textoMin.startsWith(s + ' '));

            // ------------------------------------------------
            // 1. SAUDAÇÃO / MENU PRINCIPAL (Direto ao Ponto)
            // ------------------------------------------------
            if (ehSaudacao) {
                ctx.etapa = 'MENU';
                ctx.botPausado = false;
                ctx.nomeAgente = null;
                // Reseta a mente da IA para começar limpo
                ctx.historico = [{ role: "system", content: SISTEMA_PROMPT }];

                const titulo = `Suporte T.I - Supermercado Rosalina`;
                // Texto direto, sem pedir descrição
                const descricao = `Olá ${nomeAutor}. Selecione uma opção abaixo para prosseguir:`;
                
                const botoes = [
                    { id: '1', label: 'Suporte T.I' },
                    { id: 'ticket', label: 'Consultar Ticket' }
                ];

                await evolutionService.enviarBotoes(idRemoto, titulo, descricao, botoes);
                
                // Avisa o front que o bot respondeu
                io.emit('novaMensagemWhatsapp', { chatId: idRemoto, nome: "Bot", texto: "[Menu Principal Enviado]", fromMe: true });
                return res.status(200).json({ success: true });
            }
            
            // ------------------------------------------------
            // 2. COMANDO DE SAÍDA (#)
            // ------------------------------------------------
            else if (texto === '#' || texto.toLowerCase() === 'encerrar') {
                respostaBot = MENSAGENS.AVALIACAO_INICIO;
                ctx.etapa = 'AVALIACAO_NOTA';
                ctx.botPausado = true; 
                ctx.nomeAgente = null;
            }

            // ------------------------------------------------
            // 3. ETAPA: MENU (Trata Botões E Dúvidas Escritas)
            // ------------------------------------------------
            else if (ctx.etapa === 'MENU') {
                if (texto === '1' || texto.toLowerCase().includes('suporte')) {
                    respostaBot = MENSAGENS.FILA_TI;
                    ctx.etapa = 'FILA'; 
                    ctx.botPausado = true; // Pausa para humano atender
                } 
                else if (texto === 'ticket' || texto.startsWith('*')) {
                    respostaBot = `Consultando ticket... (Simulação)`;
                } 
                else {
                    // CORREÇÃO CRÍTICA: Se não for botão, deixa a IA tentar responder!
                    console.log("🤔 Texto livre no menu, enviando para IA...");
                    respostaBot = await processarComGroq(idRemoto, texto, nomeAutor);
                    
                    // Se a IA falhar ou devolver vazio, aí sim dá erro
                    if (!respostaBot) {
                        respostaBot = MENSAGENS.OPCAO_INVALIDA;
                    }
                }
            }

            // ------------------------------------------------
            // 4. ETAPA: FILA (Modo Silencioso)
            // ------------------------------------------------
            else if (ctx.etapa === 'FILA') { 
                // Não faz nada, espera humano responder pelo painel
            }

            // ------------------------------------------------
            // 5. ETAPA: AVALIAÇÃO
            // ------------------------------------------------
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

            // ------------------------------------------------
            // 6. FALLBACK DA IA (Para mensagens soltas no inicio)
            // ------------------------------------------------
            else if (!respostaBot && !ctx.botPausado && ctx.etapa === 'INICIO') {
                console.log("🤔 Consultando Groq AI (Início)...");
                respostaBot = await processarComGroq(idRemoto, texto, nomeAutor);
            }

            // ------------------------------------------------
            // ENVIO DA RESPOSTA
            // ------------------------------------------------
            if (respostaBot) {
                await evolutionService.enviarTexto(idRemoto, respostaBot);
                io.emit('novaMensagemWhatsapp', { chatId: idRemoto, nome: "Bot", texto: respostaBot, fromMe: true });
            }
        }
      }
    }
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Erro no Webhook:', error);
    res.status(500).json({ success: false });
  }
};

// ==================================================
// 5. FUNÇÕES AUXILIARES E ROTAS (Painel e Conexão)
// ==================================================

// Iniciar atendimento humano
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

// Finalizar atendimento humano
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

// Enviar mensagem manual (Agente)
export const handleSendMessage = async (req, res) => {
  const { numero, mensagem, nomeAgenteTemporario } = req.body;
  try {
      let mensagemFinal = mensagem;
      const contexto = userContext[numero];
      
      // Adiciona o nome do agente se estiver em atendimento
      if (contexto && contexto.nomeAgente) mensagemFinal = `*${contexto.nomeAgente}*:\n${mensagem}`;
      else if (nomeAgenteTemporario) mensagemFinal = `*${nomeAgenteTemporario}*:\n${mensagem}`;

      const r = await evolutionService.enviarTexto(numero, mensagemFinal);
      res.status(200).json({ success: true, data: r });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// Configurações do sistema
export const connectInstance = async (req, res) => { try { const r = await evolutionService.criarInstancia(); res.status(200).json({ success: true, data: r }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
export const checarStatus = async (req, res) => { try { const r = await evolutionService.consultarStatus(); res.status(200).json({ success: true, data: r }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
export const listarConversas = async (req, res) => { try { const c = await evolutionService.buscarConversas(); const m = c.map(x => ({ numero: x.id, nome: x.pushName || x.id.split('@')[0], ultimaMensagem: x.conversation || "...", unread: x.unreadCount > 0 })); res.status(200).json({ success: true, data: m }); } catch (e) { res.status(200).json({ success: true, data: [] }); } };
export const configurarUrlWebhook = async (req, res) => { try { const h = req.get('host'); const p = h.includes('localhost') ? 'http' : 'https'; await evolutionService.configurarWebhook(`${p}://${h}/api/evolution/webhook`); res.status(200).json({ success: true }); } catch (e) { res.status(500).json({ success: false }); } };