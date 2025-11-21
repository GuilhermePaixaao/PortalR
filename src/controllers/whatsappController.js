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

// Memória: { "5512...": { etapa: "MENU", botPausado: true, nomeAgente: "Guilherme" } }
const userContext = {};

// ==================================================
// 2. TEXTOS FIXOS
// ==================================================
const MENSAGENS = {
    SAUDACAO: (nome) => `Olá ${nome} bem-vindo ao suporte interno do Supermercado Rosalina. Em breve, um de nossos atendentes vai te ajudar. Enquanto isso, fique à vontade para descrever seu problema.
Escolha uma fila de atendimento para ser atendido:
1 - Suporte T.I
* - Consultar um ticket (Ex. *123)`,

    OPCAO_INVALIDA: `A opção digitada não existe, digite uma opção válida!`,

    FILA_TI: `Você entrou na fila de atendimento. Aguarde um momento.`,

    AVALIACAO_INICIO: `Obrigado por entrar em contato com o Suporte . Para melhorarmos nosso atendimento, precisamos da sua opinião
Por favor, nos conte como foi o seu atendimento.

1.😔 Péssimo

2.🙁 Ruim

3.😐 Regular

4.😀 Bom

5.🤩 Excelente

9.❌ Não avaliar`,

    AVALIACAO_MOTIVO: `Agradecemos a sua avaliação, por favor descreva o motivo que levou você a classificar esse atendimento ou digite 9 para encerrar sem um motivo.`,

    ENCERRAMENTO_FINAL: `Obrigado! Caso queira iniciar uma nova conversa é só escrever o assunto`
};

// ==================================================
// 3. LÓGICA DA INTELIGÊNCIA ARTIFICIAL
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
      
      // Captura texto digitado OU resposta de botão
      const texto = (
          msg.message?.conversation || 
          msg.message?.extendedTextMessage?.text || 
          msg.message?.buttonsResponseMessage?.selectedButtonId || 
          msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId || 
          ""
      ).trim();

      const isGroup = idRemoto.includes('@g.us'); 
      const isStatus = idRemoto === 'status@broadcast'; 

      if (!isStatus && !isGroup && texto) {
        
        io.emit('novaMensagemWhatsapp', { chatId: idRemoto, nome: nomeAutor, texto: texto, fromMe: isFromMe });

        if (!isFromMe) {
            
            if (!userContext[idRemoto]) userContext[idRemoto] = { etapa: 'INICIO', botPausado: false, historico: [] };
            const ctx = userContext[idRemoto];
            let respostaBot = null;
            const textoMin = texto.toLowerCase();

            const saudacoes = ['oi', 'ola', 'olá', 'menu', 'bom dia', 'boa tarde', 'boa noite', 'opa', 'e ai', 'hey', 'saudações'];
            const ehSaudacao = saudacoes.some(s => textoMin.startsWith(s));

            // --- A. REGRAS FIXAS ---
            
            // 1. SAUDAÇÃO -> ENVIA BOTÕES
            if (ehSaudacao) {
                ctx.etapa = 'MENU';
                ctx.botPausado = false;
                ctx.nomeAgente = null; // Limpa agente anterior se houver
                ctx.historico = [{ role: "system", content: SISTEMA_PROMPT }];

                const titulo = `Olá ${nomeAutor} bem-vindo ao suporte interno do Supermercado Rosalina.`;
                const descricao = `Em breve, um de nossos atendentes vai te ajudar. Enquanto isso, fique à vontade para descrever seu problema.\n\nEscolha uma fila de atendimento para ser atendido:`;
                
                const botoes = [
                    { id: '1', label: 'Suporte T.I' },
                    { id: 'ticket', label: 'Consultar Ticket' }
                ];

                await evolutionService.enviarBotoes(idRemoto, titulo, descricao, botoes);
                
                // Emite para o painel que o menu foi enviado
                io.emit('novaMensagemWhatsapp', { chatId: idRemoto, nome: "Bot", texto: "[Menu de Opções Enviado]", fromMe: true });
                return res.status(200).json({ success: true });
            }
            
            // 2. FINALIZAR (#)
            else if (texto === '#' || texto.toLowerCase() === 'encerrar') {
                respostaBot = MENSAGENS.AVALIACAO_INICIO;
                ctx.etapa = 'AVALIACAO_NOTA';
                ctx.botPausado = true; 
                ctx.nomeAgente = null; // Libera o agente
            }

            // --- B. LÓGICA POR ETAPAS ---

            // 3. MENU 
            else if (ctx.etapa === 'MENU') {
                if (texto === '1' || texto.toLowerCase().includes('suporte')) {
                    respostaBot = MENSAGENS.FILA_TI;
                    ctx.etapa = 'FILA'; 
                    ctx.botPausado = true; // Pausa IA, espera humano clicar em "Atender"
                } 
                else if (texto === 'ticket' || texto.startsWith('*')) {
                    respostaBot = `Consultando ticket... (Simulação)`;
                } 
                else {
                    respostaBot = MENSAGENS.OPCAO_INVALIDA;
                }
            }

            // 4. FILA (Mudo)
            else if (ctx.etapa === 'FILA') {
                // Silêncio, aguardando o humano clicar em "Atender" no painel
            }

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

            // --- C. IA (GROQ) ---
            // Só responde se não estiver pausado
            else if (!respostaBot && !ctx.botPausado && ctx.etapa === 'INICIO') {
                console.log("🤔 Consultando Groq AI...");
                respostaBot = await processarComGroq(idRemoto, texto, nomeAutor);
            }

            // --- ENVIO ---
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
// 5. CONTROLES DO PAINEL (NOVOS)
// ==================================================

// Rota: POST /api/whatsapp/atender
export const atenderAtendimento = async (req, res) => {
    const { numero, nomeAgente } = req.body;

    try {
        if (!userContext[numero]) userContext[numero] = { historico: [] };
        
        // 1. Pausa o Bot
        userContext[numero].botPausado = true;
        userContext[numero].etapa = 'ATENDIMENTO_HUMANO';
        
        // 2. Salva quem está atendendo
        userContext[numero].nomeAgente = nomeAgente;

        // 3. Avisa o cliente
        const msg = `*Atendimento iniciado*\nAgora você está falando com *${nomeAgente}*.`;
        await evolutionService.enviarTexto(numero, msg);

        res.status(200).json({ success: true, message: "Você assumiu o atendimento." });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Rota: POST /api/whatsapp/finalizar
export const finalizarAtendimento = async (req, res) => {
    const { numero } = req.body;

    try {
        if (!userContext[numero]) userContext[numero] = {};
        
        // Joga para a avaliação e mantém pausado
        userContext[numero].etapa = 'AVALIACAO_NOTA';
        userContext[numero].botPausado = true;
        userContext[numero].nomeAgente = null; // Remove a assinatura

        const msg = MENSAGENS.AVALIACAO_INICIO;
        await evolutionService.enviarTexto(numero, msg);

        res.status(200).json({ success: true, message: "Atendimento finalizado." });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Rota: POST /api/whatsapp/send (Modificada para incluir assinatura)
export const handleSendMessage = async (req, res) => {
  const { numero, mensagem, nomeAgenteTemporario } = req.body;
  
  try {
      let mensagemFinal = mensagem;
      const contexto = userContext[numero];

      // LÓGICA DA ASSINATURA:
      // Se tiver um agente vinculado a esse número, adiciona o nome em negrito
      if (contexto && contexto.nomeAgente) {
          mensagemFinal = `*${contexto.nomeAgente}*:\n${mensagem}`;
      } 
      // Caso de segurança (se o servidor reiniciou e perdeu a memória, usa o que veio do front)
      else if (nomeAgenteTemporario) {
          mensagemFinal = `*${nomeAgenteTemporario}*:\n${mensagem}`;
      }

      const r = await evolutionService.enviarTexto(numero, mensagemFinal);
      res.status(200).json({ success: true, data: r });

  } catch (e) { 
      res.status(500).json({ success: false, message: e.message }); 
  }
};

// Rotas auxiliares (mantidas)
export const connectInstance = async (req, res) => { try { const r = await evolutionService.criarInstancia(); res.status(200).json({ success: true, data: r }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
export const checarStatus = async (req, res) => { try { const r = await evolutionService.consultarStatus(); res.status(200).json({ success: true, data: r }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
export const listarConversas = async (req, res) => { try { const c = await evolutionService.buscarConversas(); const m = c.map(x => ({ numero: x.id, nome: x.pushName || x.id.split('@')[0], ultimaMensagem: x.conversation || "...", unread: x.unreadCount > 0 })); res.status(200).json({ success: true, data: m }); } catch (e) { res.status(200).json({ success: true, data: [] }); } };
export const configurarUrlWebhook = async (req, res) => { try { const h = req.get('host'); const p = h.includes('localhost') ? 'http' : 'https'; await evolutionService.configurarWebhook(`${p}://${h}/api/evolution/webhook`); res.status(200).json({ success: true }); } catch (e) { res.status(500).json({ success: false }); } };