import * as evolutionService from '../services/evolutionService.js';
import openai from '../config/openai.js';

// ==================================================
// 1. CONFIGURAÇÕES E TEXTOS FIXOS
// ==================================================
const MEU_ASSISTENTE_ID = process.env.OPENAI_ASSISTENTE_ID || "asst_XypLIE41vk9VgGDtIfkAEpOi";

// Sua lista de mensagens fixa (Limitação do Bot)
const MENSAGENS = {
    SAUDACAO: (nome) => `Olá ${nome}, bem-vindo ao suporte interno do Supermercado Rosalina. Em breve, um de nossos atendentes vai te ajudar. Enquanto isso, fique à vontade para descrever seu problema.

Escolha uma fila de atendimento para ser atendido:
1 - Suporte T.I
* - Consultar um ticket (Ex. *123)
# - Finalizar o chat.`,

    OPCAO_INVALIDA: "A opção digitada não existe, digite uma opção válida!",

    FILA_TI: `Opção selecionada: Suporte T.I
Você entrou na fila, logo você será atendido.

Você é o 1° na fila. Em caso de urgência pode nos acionar no número: (12) 99999-9999`,

    AVALIACAO_INICIO: `Obrigado por entrar em contato com o Suporte. Para melhorarmos nosso atendimento, precisamos da sua opinião.
Por favor, nos conte como foi o seu atendimento:

1.😔 Péssimo
2.🙁 Ruim
3.😐 Regular
4.😀 Bom
5.🤩 Excelente
9.❌ Não avaliar`,

    AVALIACAO_MOTIVO: `Agradecemos a sua avaliação! Por favor, descreva o motivo que levou você a classificar esse atendimento ou digite 9 para encerrar sem um motivo.`,

    ENCERRAMENTO_FINAL: `Atendimento encerrado. Obrigado!`
};

// Memória local: { "551299...@s.whatsapp.net": { threadId: "...", etapa: "MENU", botPausado: false } }
const userContext = {};

// ==================================================
// 2. LÓGICA DA OPENAI (IA)
// ==================================================
async function processarComOpenAI(numeroUsuario, textoUsuario, nomeUsuario) {
    const contexto = userContext[numeroUsuario];
    if (!contexto || contexto.botPausado) return null;

    try {
        // Cria thread se não existir
        if (!contexto.threadId) {
            const thread = await openai.beta.threads.create();
            contexto.threadId = thread.id;
        }

        // Adiciona mensagem e roda o assistente
        await openai.beta.threads.messages.create(contexto.threadId, { role: "user", content: textoUsuario });
        const run = await openai.beta.threads.runs.create(contexto.threadId, { assistant_id: MEU_ASSISTENTE_ID });

        // Espera resposta
        let runStatus = await openai.beta.threads.runs.retrieve(contexto.threadId, run.id);
        while (runStatus.status === 'queued' || runStatus.status === 'in_progress') {
            await new Promise(r => setTimeout(r, 1000));
            runStatus = await openai.beta.threads.runs.retrieve(contexto.threadId, run.id);
        }

        if (runStatus.status === 'completed') {
            const messages = await openai.beta.threads.messages.list(contexto.threadId);
            return messages.data[0].content[0].text.value;
        }
        return null;
    } catch (e) {
        console.error("[IA] Erro:", e);
        return null; // Silêncio em caso de erro da IA
    }
}

// ==================================================
// 3. WEBHOOK (LÓGICA HÍBRIDA: MENU + IA)
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

      if (idRemoto !== 'status@broadcast' && texto) {
        // 1. Mostra no Painel (sempre)
        io.emit('novaMensagemWhatsapp', { chatId: idRemoto, nome: nomeAutor, texto: texto, fromMe: isFromMe });

        // 2. Se a mensagem é do cliente (não é minha), processa a resposta
        if (!isFromMe) {
            
            // Inicializa contexto se não existir
            if (!userContext[idRemoto]) userContext[idRemoto] = { etapa: 'INICIO', botPausado: false };
            const ctx = userContext[idRemoto];
            let respostaBot = null;

            // --- A. REGRAS FIXAS (LIMITAÇÃO) ---
            
            // Comando "Oi" (Reinicia/Menu)
            if (['oi', 'ola', 'olá'].includes(texto.toLowerCase())) {
                respostaBot = MENSAGENS.SAUDACAO(nomeAutor);
                ctx.etapa = 'MENU';
                ctx.botPausado = false; // Reativa o bot se estava pausado
            }
            
            // Comando "#" (Finalizar/Avaliar)
            else if (texto === '#') {
                respostaBot = MENSAGENS.AVALIACAO_INICIO;
                ctx.etapa = 'AVALIACAO_NOTA';
                ctx.botPausado = true; // Pausa IA durante avaliação
            }

            // Navegação do Menu
            else if (ctx.etapa === 'MENU') {
                if (texto === '1') {
                    respostaBot = MENSAGENS.FILA_TI;
                    ctx.etapa = 'FILA';
                    ctx.botPausado = true; // Pausa a IA pois entrou na fila humana
                } else if (texto.startsWith('*')) {
                    respostaBot = "Consultando ticket... (Simulação)";
                } else {
                    // Se não digitou opção válida, deixa a IA tentar responder ou avisa erro?
                    // Aqui vou deixar a IA responder se não for número, 
                    // mas se for número inválido, manda aviso.
                    if(['2','3','4','5','6','7','8','9','0'].includes(texto)) {
                         respostaBot = MENSAGENS.OPCAO_INVALIDA;
                    }
                }
            }

            // Fluxo de Avaliação
            else if (ctx.etapa === 'AVALIACAO_NOTA') {
                if (['1', '2', '3', '4', '5'].includes(texto)) {
                    respostaBot = MENSAGENS.AVALIACAO_MOTIVO;
                    ctx.etapa = 'AVALIACAO_MOTIVO';
                } else if (texto === '9') {
                    respostaBot = MENSAGENS.ENCERRAMENTO_FINAL;
                    delete userContext[idRemoto];
                }
            }
            else if (ctx.etapa === 'AVALIACAO_MOTIVO') {
                respostaBot = MENSAGENS.ENCERRAMENTO_FINAL;
                delete userContext[idRemoto];
            }

            // --- B. INTELIGÊNCIA ARTIFICIAL (Só se não caiu nas regras acima) ---
            
            if (!respostaBot && !ctx.botPausado) {
                console.log("🤔 Enviando para IA...");
                respostaBot = await processarComOpenAI(idRemoto, texto, nomeAutor);
            }

            // --- C. ENVIO DA RESPOSTA ---
            if (respostaBot) {
                await evolutionService.enviarTexto(idRemoto, respostaBot);
                io.emit('novaMensagemWhatsapp', { chatId: idRemoto, nome: "Bot/IA", texto: respostaBot, fromMe: true });
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
// 4. FUNÇÕES DO PAINEL
// ==================================================
export const notificarAtribuicao = async (numero, nomeAgente) => {
    if(!userContext[numero]) userContext[numero] = {};
    userContext[numero].botPausado = true; // Pausa o bot para o humano assumir
    const msg = `Atendimento assumido por ${nomeAgente}.`;
    await evolutionService.enviarTexto(numero, msg);
    return msg;
};

export const notificarFinalizacao = async (numero) => {
    if(userContext[numero]) userContext[numero].etapa = 'AVALIACAO_NOTA';
    const msg = MENSAGENS.AVALIACAO_INICIO;
    await evolutionService.enviarTexto(numero, msg);
    return msg;
};

// Rotas auxiliares (connect, send, etc) mantidas iguais...
export const connectInstance = async (req, res) => { try { const r = await evolutionService.criarInstancia(); res.status(200).json({ success: true, data: r }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
export const handleSendMessage = async (req, res) => { const { numero, mensagem } = req.body; try { const r = await evolutionService.enviarTexto(numero, mensagem); res.status(200).json({ success: true, data: r }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
export const checarStatus = async (req, res) => { try { const r = await evolutionService.consultarStatus(); res.status(200).json({ success: true, data: r }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
export const listarConversas = async (req, res) => { try { const c = await evolutionService.buscarConversas(); const m = c.map(x => ({ numero: x.id, nome: x.pushName || x.id.split('@')[0], ultimaMensagem: x.conversation || "...", unread: x.unreadCount > 0 })); res.status(200).json({ success: true, data: m }); } catch (e) { res.status(200).json({ success: true, data: [] }); } };
export const configurarUrlWebhook = async (req, res) => { try { const h = req.get('host'); const p = h.includes('localhost') ? 'http' : 'https'; await evolutionService.configurarWebhook(`${p}://${h}/api/evolution/webhook`); res.status(200).json({ success: true }); } catch (e) { res.status(500).json({ success: false }); } };