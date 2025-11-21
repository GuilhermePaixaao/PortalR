import * as evolutionService from '../services/evolutionService.js';
import { OpenAI } from 'openai';

// ==================================================
// 1. CONFIGURAÇÕES DA GROQ (GRÁTIS)
// ==================================================
const groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY, 
    baseURL: "https://api.groq.com/openai/v1"
});

const MODELO_IA = "llama-3.1-8b-instant"; 

// Prompt do Sistema
const SISTEMA_PROMPT = `
Você é o assistente de triagem do Suporte Técnico (T.I.) do Supermercado Rosalina.
Sua missão é EXCLUSIVAMENTE tirar dúvidas sobre: uso do sistema interno, problemas com impressoras, internet, computadores e abertura de chamados.

REGRAS RÍGIDAS DE COMPORTAMENTO:
1. Se o usuário perguntar sobre qualquer assunto que NÃO seja T.I. ou funcionamento do mercado (ex: futebol, receitas, política, piadas, clima, conversa fiada), você DEVE responder APENAS:
"Desculpe, meu sistema é limitado exclusivamente para suporte técnico e dúvidas operacionais do mercado."

2. Não tente ser simpático demais nem render assunto fora do trabalho.
3. Responda de forma breve e direta (máximo 2 frases).
4. Se não souber a resposta técnica, peça para ele digitar # para falar com um humano.
`;

const userContext = {};

// ==================================================
// 2. TEXTOS FIXOS (MENSAGENS)
// ==================================================
const MENSAGENS = {
    OPCAO_INVALIDA: `A opção digitada não é válida. Por favor, clique em um dos botões acima ou reinicie com "Oi".`,

    FILA_TI: `Certo! Você entrou na fila de atendimento do Suporte T.I. Aguarde um momento, um técnico irá te responder.`,

    AVALIACAO_INICIO: `Obrigado por entrar em contato com o Suporte. Para melhorarmos nosso atendimento, precisamos da sua opinião.
Por favor, nos conte como foi o seu atendimento:

1. 😔 Péssimo
2. 🙁 Ruim
3. 😐 Regular
4. 😀 Bom
5. 🤩 Excelente
9. ❌ Não avaliar`,

    AVALIACAO_MOTIVO: `Agradecemos a sua avaliação, por favor descreva o motivo que levou você a classificar esse atendimento ou digite 9 para encerrar sem um motivo.`,

    ENCERRAMENTO_FINAL: `Obrigado! Caso queira iniciar uma nova conversa é só mandar um "Oi".`
};

// ==================================================
// 3. LÓGICA DA INTELIGÊNCIA ARTIFICIAL (GROQ)
// ==================================================
async function processarComGroq(numeroUsuario, textoUsuario, nomeUsuario) {
    const contexto = userContext[numeroUsuario];
    
    if (!contexto || contexto.botPausado) return null;

    try {
        if (!contexto.historico || contexto.historico.length === 0) {
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
            temperature: 0.3, 
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
// 4. WEBHOOK
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
      const nomeAutor = msg.pushName || idRemoto.split('@')[0];

      // --- [MODIFICADO] LEITURA ROBUSTA (Texto + Botões) ---
      // Se for texto normal, pega conversation/extendedTextMessage
      // Se for clique em botão, pega buttonsResponseMessage.selectedButtonId
      const texto = (
          msg.message?.conversation || 
          msg.message?.extendedTextMessage?.text || 
          msg.message?.buttonsResponseMessage?.selectedButtonId || 
          ""
      ).trim();

      const isGroup = idRemoto.includes('@g.us'); 
      const isStatus = idRemoto === 'status@broadcast'; 

      // Só processa se: NÃO for status, NÃO for grupo e TIVER texto/clique
      if (!isStatus && !isGroup && texto) {
        
        // Emite para o frontend (chat em tempo real)
        // Se for botão, o 'texto' será o ID (ex: '1'), mas para o chat humano pode ficar confuso.
        // O ideal seria tratar a exibição, mas para simplificar enviamos o ID ou Texto.
        io.emit('novaMensagemWhatsapp', { chatId: idRemoto, nome: nomeAutor, texto: texto, fromMe: isFromMe });

        if (!isFromMe) {
            
            if (!userContext[idRemoto]) userContext[idRemoto] = { etapa: 'INICIO', botPausado: false, historico: [] };
            const ctx = userContext[idRemoto];
            let respostaBot = null;
            const textoMin = texto.toLowerCase();

            // --- LISTA DE SAUDAÇÕES ---
            const saudacoes = [
                'oi', 'ola', 'olá', 'menu', 
                'bom dia', 'boa tarde', 'boa noite', 
                'opa', 'e ai', 'hey', 'saudações'
            ];

            // Verifica se começa com alguma saudação
            const ehSaudacao = saudacoes.some(s => textoMin.startsWith(s));

            // --- A. REGRAS FIXAS ---
            
            // Se for saudação (Reiniciar / Menu) -> AGORA ENVIA BOTÕES
            if (ehSaudacao) {
                
                await evolutionService.enviarBotoes(
                    idRemoto, 
                    `Olá ${nomeAutor}, bem-vindo ao suporte!`, 
                    "Como podemos te ajudar hoje? Selecione uma opção:",
                    [
                        { id: '1', texto: '🖥️ Suporte T.I.' },
                        { id: '2', texto: '🎫 Consultar Ticket' },
                        { id: '3', texto: '💬 Falar com Humano' }
                    ]
                );

                ctx.etapa = 'MENU';
                ctx.botPausado = false;
                ctx.historico = [{ role: "system", content: SISTEMA_PROMPT }];
                
                // Avisa o painel que o bot respondeu com menu
                io.emit('novaMensagemWhatsapp', { chatId: idRemoto, nome: "Bot", texto: "[Menu de Botões Enviado]", fromMe: true });
                
                respostaBot = null; // Já enviamos os botões, não enviar texto extra
            }
            
            // Finalizar (#)
            else if (texto === '#') {
                respostaBot = MENSAGENS.AVALIACAO_INICIO;
                ctx.etapa = 'AVALIACAO_NOTA';
                ctx.botPausado = true; 
            }

            // --- B. LÓGICA POR ETAPAS ---

            // 1. MENU (Agora responde aos IDs dos botões)
            else if (ctx.etapa === 'MENU') {
                if (texto === '1') {
                    // Clicou em "Suporte T.I."
                    respostaBot = MENSAGENS.FILA_TI;
                    ctx.etapa = 'FILA'; 
                    ctx.botPausado = true; // Pausa IA, espera humano
                } 
                else if (texto === '2') {
                    // Clicou em "Consultar Ticket"
                    respostaBot = "Por favor, digite o número do ticket que deseja consultar (ex: *123).";
                    // Mantém no menu ou cria etapa CONSULTA
                } 
                else if (texto === '3') {
                    // Clicou em "Falar com Humano"
                    respostaBot = "Entendido. Estou transferindo para um atendente. Aguarde um momento.";
                    ctx.etapa = 'FILA';
                    ctx.botPausado = true;
                }
                else if (texto.startsWith('*')) {
                    const ticketId = texto.replace('*', '');
                    respostaBot = `Consultando ticket ${ticketId}... (Simulação: Ticket Em Aberto)`;
                } 
                else {
                    // Se a pessoa digitou texto em vez de clicar
                    respostaBot = MENSAGENS.OPCAO_INVALIDA;
                }
            }

            // 2. FILA (Bot Mudo)
            else if (ctx.etapa === 'FILA') {
                // Silêncio total
            }

            // 3. AVALIAÇÃO - NOTA
            else if (ctx.etapa === 'AVALIACAO_NOTA') {
                if (['1', '2', '3', '4', '5'].includes(texto)) {
                    respostaBot = MENSAGENS.AVALIACAO_MOTIVO;
                    ctx.etapa = 'AVALIACAO_MOTIVO';
                } else if (texto === '9') {
                    respostaBot = MENSAGENS.ENCERRAMENTO_FINAL;
                    delete userContext[idRemoto];
                } else {
                    respostaBot = "Por favor, digite apenas o número da nota (1 a 5) ou 9 para sair.";
                }
            }

            // 4. AVALIAÇÃO - MOTIVO
            else if (ctx.etapa === 'AVALIACAO_MOTIVO') {
                // Aceita qualquer texto
                respostaBot = MENSAGENS.ENCERRAMENTO_FINAL;
                delete userContext[idRemoto]; 
            }

            // --- C. IA (GROQ) ---
            // Só responde se estiver no INÍCIO (não entrou no menu ainda) e não for comando fixo
            else if (!respostaBot && !ctx.botPausado && ctx.etapa === 'INICIO') {
                console.log("🤔 Consultando Groq AI...");
                respostaBot = await processarComGroq(idRemoto, texto, nomeAutor);
            }

            // --- ENVIO FINAL DE TEXTO ---
            // Se alguma lógica acima definiu uma resposta de TEXTO (respostaBot), enviamos aqui.
            if (respostaBot) {
                await evolutionService.enviarTexto(idRemoto, respostaBot);
                io.emit('novaMensagemWhatsapp', { chatId: idRemoto, nome: "Bot", texto: respostaBot, fromMe: true });
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
// 5. CONTROLES DO PAINEL
// ==================================================
export const notificarAtribuicao = async (numero, nomeAgente) => {
    if(!userContext[numero]) userContext[numero] = { historico: [] };
    userContext[numero].botPausado = true; 
    const msg = `Atendimento assumido por ${nomeAgente}.`;
    await evolutionService.enviarTexto(numero, msg);
    return msg;
};

export const notificarFinalizacao = async (numero) => {
    if(!userContext[numero]) userContext[numero] = {};
    userContext[numero].etapa = 'AVALIACAO_NOTA';
    userContext[numero].botPausado = true;
    const msg = MENSAGENS.AVALIACAO_INICIO;
    await evolutionService.enviarTexto(numero, msg);
    return msg;
};

// Rotas auxiliares
export const connectInstance = async (req, res) => { try { const r = await evolutionService.criarInstancia(); res.status(200).json({ success: true, data: r }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
export const handleSendMessage = async (req, res) => { const { numero, mensagem } = req.body; try { const r = await evolutionService.enviarTexto(numero, mensagem); res.status(200).json({ success: true, data: r }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
export const checarStatus = async (req, res) => { try { const r = await evolutionService.consultarStatus(); res.status(200).json({ success: true, data: r }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
export const listarConversas = async (req, res) => { try { const c = await evolutionService.buscarConversas(); const m = c.map(x => ({ numero: x.id, nome: x.pushName || x.id.split('@')[0], ultimaMensagem: x.conversation || "...", unread: x.unreadCount > 0 })); res.status(200).json({ success: true, data: m }); } catch (e) { res.status(200).json({ success: true, data: [] }); } };
export const configurarUrlWebhook = async (req, res) => { try { const h = req.get('host'); const p = h.includes('localhost') ? 'http' : 'https'; await evolutionService.configurarWebhook(`${p}://${h}/api/evolution/webhook`); res.status(200).json({ success: true }); } catch (e) { res.status(500).json({ success: false }); } };