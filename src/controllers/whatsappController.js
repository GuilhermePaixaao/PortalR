import * as evolutionService from '../services/evolutionService.js';
import * as chamadoModel from '../models/chamadoModel.js'; 
import * as EmailService from '../services/emailService.js'; // [NOVO] Necessário para enviar e-mail ao criar chamado
import { OpenAI } from 'openai';

// ==================================================
// 1. CONFIGURAÇÕES DA GROQ (GRÁTIS)
// ==================================================
const groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY, 
    baseURL: "https://api.groq.com/openai/v1"
});

const MODELO_IA = "llama-3.1-8b-instant"; 

// --- CACHE ANTI-DUPLICAÇÃO (Impede mensagens repetidas) ---
const processedMessageIds = new Set();

const SISTEMA_PROMPT = `
Você é o assistente de triagem do Suporte Técnico (T.I.) do Supermercado Rosalina.
Sua missão é EXCLUSIVAMENTE tirar dúvidas sobre: uso do sistema interno, problemas com impressoras, internet, computadores e abertura de chamados.

REGRAS RÍGIDAS DE COMPORTAMENTO:
1. Se o usuário perguntar sobre qualquer assunto que NÃO seja T.I. ou funcionamento do mercado, você DEVE responder APENAS:
"Desculpe, meu sistema é limitado exclusivamente para suporte técnico e dúvidas operacionais do mercado."

2. Não tente ser simpático demais nem render assunto fora do trabalho.
3. Responda de forma breve e direta (máximo 2 frases).
4. Se não souber a resposta técnica, peça para ele digitar # para falar com um humano.
5. Se receber mensagens curtas como "ata", "ok", "entendi", responda: "Certo. Algo mais?"
`;

// Memória local
const userContext = {};

// ==================================================
// 2. TEXTOS FIXOS
// ==================================================
const MENSAGENS = {
    SAUDACAO: (nome) => `Olá *${nome}* bem-vindo(a) ao suporte interno do Supermercado Rosalina. 
    Em breve, um de nossos atendentes vai te ajudar. Enquanto isso, fique à vontade para descrever seu problema.
        Escolha uma fila de atendimento para ser atendido:
            1 - Suporte T.I
            * - Consultar um ticket (Ex. *123)
            Para encerrar o atendimento a qualquer momento, digite #.`,

    MENU_TI_COM_FILA: `✅ *Você acessou a Fila de Suporte T.I.*
    
Para agilizar, escolha uma opção:

1️⃣ - Abrir um Chamado Automático (Bot)
2️⃣ - Aguardar Atendente Humano
3️⃣ - Voltar ao Início

Digite o número da opção:`,

    OPCAO_INVALIDA: `A opção digitada não existe, digite uma opção válida!`,

    FILA_TI: `🔔 Entendido. Já notifiquei a equipe. Aguarde um momento que um humano irá te responder.`,

    AVALIACAO_INICIO: `Obrigado por entrar em contato com o Suporte. Para melhorarmos nosso atendimento, precisamos da sua opinião.
Por favor, nos avalie de 1 a 5 e conte como foi o seu atendimento.
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
            temperature: 0.1, 
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
      const idMensagem = msg.key.id; 
      const idRemoto = msg.key.remoteJid;
      const isFromMe = msg.key.fromMe;
      
      // --- 1. ANTI-DUPLICAÇÃO ---
      if (processedMessageIds.has(idMensagem)) return res.status(200).json({ success: true });
      processedMessageIds.add(idMensagem);
      setTimeout(() => processedMessageIds.delete(idMensagem), 10000);

      const nomeAutor = msg.pushName || idRemoto.split('@')[0];
      const texto = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || "").trim();
      const isGroup = idRemoto.includes('@g.us'); 
      const isStatus = idRemoto === 'status@broadcast'; 

      if (!isStatus && !isGroup && texto) {
        
        // --- NOTIFICA O FRONTEND (SOCKET) ---
        const ctxAtual = userContext[idRemoto] || {};
        io.emit('novaMensagemWhatsapp', { 
            id: idMensagem, 
            chatId: idRemoto, 
            nome: nomeAutor, 
            texto: texto, 
            fromMe: isFromMe,
            mostrarNaFila: ctxAtual.mostrarNaFila || false 
        });

        if (!isFromMe) {
            if (!userContext[idRemoto]) userContext[idRemoto] = { etapa: 'INICIO', botPausado: false, historico: [], mostrarNaFila: false };
            const ctx = userContext[idRemoto];
            let respostaBot = null;
            
            const textoMin = texto.toLowerCase();

            // Saudação robusta
            const saudacoes = [
                'oi', 'olá', 'ola', 'oie', 'menu', 'inicio', 'start', 
                'bom dia', 'boa tarde', 'boa noite', 'opa', 'e ai', 'eai', 'hey', 
                'saudações', 'ata', 'ok', 'entendi', 'teste'
            ];
            const textoLimpo = textoMin.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"").trim(); 
            const ehSaudacao = saudacoes.some(s => {
                const sLimpa = s.replace(/\s/g, '');
                if (textoLimpo === sLimpa) return true;
                if (sLimpa.length > 2 && textoLimpo.startsWith(sLimpa)) return true;
                return false;
            });

            // ------------------------------------------------
            // 1. MENU PRINCIPAL
            // ------------------------------------------------
            if (ehSaudacao) {
                if (ctx.etapa === 'MENU' && textoMin !== 'menu' && textoMin !== 'inicio') {
                    respostaBot = MENSAGENS.OPCAO_INVALIDA;
                    await evolutionService.enviarTexto(idRemoto, respostaBot);
                    
                    io.emit('novaMensagemWhatsapp', { 
                        id: 'opt_invalida-'+Date.now(), 
                        chatId: idRemoto, 
                        nome: "Bot", 
                        texto: respostaBot, 
                        fromMe: true 
                    });
                    return res.status(200).json({ success: true });
                } else {
                    ctx.etapa = 'MENU';
                    ctx.botPausado = false;
                    ctx.nomeAgente = null;
                    ctx.mostrarNaFila = false;
                    ctx.historico = [{ role: "system", content: SISTEMA_PROMPT }];

                    const textoSaudacao = MENSAGENS.SAUDACAO(nomeAutor);
                    await evolutionService.enviarTexto(idRemoto, textoSaudacao);
                    
                    io.emit('novaMensagemWhatsapp', { id: 'menu-'+Date.now(), chatId: idRemoto, nome: "Bot", texto: textoSaudacao, fromMe: true });
                    return res.status(200).json({ success: true });
                }
            }
            
            // 2. FINALIZAR (#)
            else if (texto === '#' || texto.toLowerCase() === 'encerrar') {
                respostaBot = MENSAGENS.AVALIACAO_INICIO;
                ctx.etapa = 'AVALIACAO_NOTA';
                ctx.botPausado = true; 
                ctx.nomeAgente = null;
            }

            // 3. ETAPA: MENU -> SUBMENU T.I
            else if (ctx.etapa === 'MENU') {
                if (texto === '1' || textoMin.includes('suporte')) {
                    respostaBot = MENSAGENS.MENU_TI_COM_FILA;
                    ctx.etapa = 'SUBMENU_TI'; 
                    ctx.botPausado = false; 
                    ctx.mostrarNaFila = true; 
                    io.emit('notificacaoChamado', { 
                        chatId: idRemoto, 
                        nome: nomeAutor,
                        status: 'PENDENTE_TI' 
                    });
                } 
                else if (texto.startsWith('*') || textoMin === 'ticket') {
                    let ticketNumeroStr = '';
                    if (texto.startsWith('*')) {
                        ticketNumeroStr = texto.substring(1).trim();
                    } else if (textoMin === 'ticket') {
                        respostaBot = "Por favor, digite o *número do ticket* após o asterisco. Exemplo: *123";
                        ctx.etapa = 'MENU'; 
                        ctx.botPausado = true;
                        setTimeout(() => { ctx.botPausado = false; }, 30000); 
                        await evolutionService.enviarTexto(idRemoto, respostaBot);
                        io.emit('novaMensagemWhatsapp', { 
                            id: 'bot-'+Date.now(), chatId: idRemoto, nome: "Bot", texto: respostaBot, fromMe: true, mostrarNaFila: ctx.mostrarNaFila
                        });
                        return res.status(200).json({ success: true });
                    }
                    
                    const ticketId = parseInt(ticketNumeroStr);
                    if (isNaN(ticketId) || ticketId <= 0) {
                        respostaBot = "⚠️ Por favor, digite um número de ticket válido após o asterisco. Exemplo: *123";
                    } else {
                        const ticket = await chamadoModel.findById(ticketId); 
                        if (ticket) {
                            const categoriaNome = ticket.nomeCategoriaPai ? `${ticket.nomeCategoriaPai} / ${ticket.nomeCategoria}` : ticket.nomeCategoria;
                            respostaBot = `🎫 *Detalhes do Ticket #${ticket.id}*\n`;
                            respostaBot += `*Assunto:* ${ticket.assunto}\n`;
                            respostaBot += `*Status:* ${ticket.status}\n`;
                            respostaBot += `*Categoria:* ${categoriaNome || 'Não Atribuída'}\n`;
                            if (ticket.atendente_id) {
                                respostaBot += `*Atendente:* ${ticket.nomeAtendente || 'Em Atribuição'}\n`;
                            }
                            respostaBot += `*Prioridade:* ${ticket.prioridade}`;
                            ctx.etapa = 'MENU';
                            ctx.botPausado = true;
                            setTimeout(() => { ctx.botPausado = false; }, 30000); 
                        } else {
                            respostaBot = `❌ O Ticket #${ticketId} não foi encontrado.`;
                        }
                    }
                } else {
                    respostaBot = MENSAGENS.OPCAO_INVALIDA;
                }
            }

            // 4. ETAPA: SUBMENU T.I
            else if (ctx.etapa === 'SUBMENU_TI') {
                if (texto === '1') {
                    respostaBot = "📝 Certo. Por favor, *descreva o problema* resumidamente em uma mensagem para eu registrar.";
                    ctx.etapa = 'REGISTRAR_CHAMADO';
                }
                else if (texto === '2') {
                    respostaBot = MENSAGENS.FILA_TI;
                    ctx.etapa = 'FILA';
                    ctx.botPausado = true; 
                    ctx.mostrarNaFila = true; 
                }
                else if (texto === '3') {
                    respostaBot = MENSAGENS.SAUDACAO(nomeAutor);
                    ctx.etapa = 'MENU';
                    ctx.mostrarNaFila = false; 
                }
                else {
                    respostaBot = MENSAGENS.OPCAO_INVALIDA;
                }
            }

            // 5. FILA / AVALIAÇÃO
            else if (ctx.etapa === 'FILA') { /* Silêncio */ }
            else if (ctx.etapa === 'AVALIACAO_NOTA') {
                if (['1', '2', '3', '4', '5'].includes(texto)) {
                    respostaBot = MENSAGENS.AVALIACAO_MOTIVO;
                    ctx.etapa = 'AVALIACAO_MOTIVO';
                } else if (texto === '9') {
                    respostaBot = MENSAGENS.ENCERRAMENTO_FINAL;
                    ctx.mostrarNaFila = false; 
                    delete userContext[idRemoto];
                } else {
                    respostaBot = MENSAGENS.OPCAO_INVALIDA;
                }
            }
            else if (ctx.etapa === 'AVALIACAO_MOTIVO') {
                respostaBot = MENSAGENS.ENCERRAMENTO_FINAL;
                ctx.mostrarNaFila = false; 
                delete userContext[idRemoto]; 
            }

            // FALLBACK IA
            else if (!respostaBot && !ctx.botPausado && ctx.etapa === 'INICIO') {
                respostaBot = await processarComGroq(idRemoto, texto, nomeAutor);
            }

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
  } catch (error) {
    console.error('Erro:', error);
    res.status(500).json({ success: false });
  }
};

// ==================================================
// 5. CONTROLES DO PAINEL (ATENDIMENTO HUMANO)
// ==================================================

export const atenderAtendimento = async (req, res) => {
    const { numero, nomeAgente } = req.body;
    try {
        if (!userContext[numero]) userContext[numero] = { historico: [] };
        
        userContext[numero].nomeAgente = nomeAgente;
        userContext[numero].botPausado = true; 
        userContext[numero].etapa = 'ATENDIMENTO_HUMANO';
        userContext[numero].mostrarNaFila = true; 

        const msg = `👨‍💻 *${nomeAgente}* atendeu seu pedido e falará com você agora.`;
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
        userContext[numero].mostrarNaFila = false; 

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
      
      if(contexto) contexto.mostrarNaFila = true;
      else if (!contexto) {
          userContext[numero] = { etapa: 'ATENDIMENTO_HUMANO', botPausado: true, mostrarNaFila: true };
      }

      if (contexto && contexto.nomeAgente) {
          mensagemFinal = `*${contexto.nomeAgente}*\n\n${mensagem}`;
      } 
      else if (nomeAgenteTemporario) {
          mensagemFinal = `*${nomeAgenteTemporario}*\n\n${mensagem}`;
      }

      const r = await evolutionService.enviarTexto(numero, mensagemFinal);
      res.status(200).json({ success: true, data: r });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

export const listarConversas = async (req, res) => { 
    try { 
        const c = await evolutionService.buscarConversas(); 
        const m = c.map(x => {
            const ctx = userContext[x.id] || {};
            const deveAparecer = ctx.mostrarNaFila === true || ctx.etapa === 'ATENDIMENTO_HUMANO';
            return { 
                numero: x.id, 
                nome: x.pushName || x.id.split('@')[0], 
                ultimaMensagem: x.conversation || "...", 
                unread: x.unreadCount > 0,
                visivel: deveAparecer, 
                etapa: ctx.etapa || 'INICIO', 
                nomeAgente: ctx.nomeAgente || null 
            };
        }); 
        res.status(200).json({ success: true, data: m }); 
    } catch (e) { res.status(200).json({ success: true, data: [] }); } 
};

export const listarMensagensChat = async (req, res) => {
    const { numero } = req.body;
    if (!numero) return res.status(400).json({ success: false, message: 'Número obrigatório' });

    try {
        const rawMessages = await evolutionService.buscarMensagensHistorico(numero);
        const formattedMessages = rawMessages.map(msg => {
            const content = msg.message?.conversation || 
                            msg.message?.extendedTextMessage?.text || 
                            msg.message?.imageMessage?.caption ||
                            (msg.message?.imageMessage ? "📷 [Imagem]" : null) ||
                            (msg.message?.audioMessage ? "🎤 [Áudio]" : null) ||
                            "Conteúdo não suportado";

            const timestamp = msg.messageTimestamp 
                ? (typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp * 1000 : msg.messageTimestamp)
                : Date.now();

            return {
                fromMe: msg.key.fromMe,
                text: content,
                time: timestamp, 
                name: msg.pushName || (msg.key.fromMe ? "Eu" : "Cliente")
            };
        });
        formattedMessages.sort((a, b) => new Date(a.time) - new Date(b.time));
        res.status(200).json({ success: true, data: formattedMessages });
    } catch (e) {
        console.error("Erro ao listar mensagens:", e);
        res.status(500).json({ success: false, data: [] });
    }
};

export const handleDisconnect = async (req, res) => {
    try {
        await evolutionService.desconectarInstancia(); 
        res.status(200).json({ success: true, message: 'Instância desconectada.' });
    } catch (e) { 
        res.status(500).json({ success: false, message: e.message }); 
    }
};
export const connectInstance = async (req, res) => { try { const r = await evolutionService.criarInstancia(); res.status(200).json({ success: true, data: r }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
export const checarStatus = async (req, res) => { try { const r = await evolutionService.consultarStatus(); res.status(200).json({ success: true, data: r }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
export const configurarUrlWebhook = async (req, res) => { try { const h = req.get('host'); const p = h.includes('localhost') ? 'http' : 'https'; await evolutionService.configurarWebhook(`${p}://${h}/api/evolution/webhook`); res.status(200).json({ success: true }); } catch (e) { res.status(500).json({ success: false }); } };

// Rota para TRANSFERIR o atendimento para outro agente
export const transferirAtendimento = async (req, res) => {
    const { numero, novoAgente, nomeAgenteAtual } = req.body;
    try {
        if (!userContext[numero]) {
             return res.status(404).json({ success: false, message: "Chat não ativo ou não encontrado na memória." });
        }
        const oldAgent = nomeAgenteAtual || userContext[numero].nomeAgente || "Atendente";
        userContext[numero].nomeAgente = novoAgente;
        userContext[numero].etapa = 'ATENDIMENTO_HUMANO'; 
        userContext[numero].botPausado = true;
        userContext[numero].mostrarNaFila = true; 
        const msgTransferencia = `🔄 *Atendimento Transferido*\n\nO atendente *${oldAgent}* transferiu seu chamado para *${novoAgente}*. Por favor, aguarde um momento.`;
        await evolutionService.enviarTexto(numero, msgTransferencia);
        if(req.io) {
             req.io.emit('transferenciaChamado', { 
                chatId: numero, novoAgente: novoAgente, antigoAgente: oldAgent
             });
        }
        res.status(200).json({ success: true });
    } catch (e) {
        console.error("Erro ao transferir:", e);
        res.status(500).json({ success: false, message: e.message });
    }
};

// ==================================================
// [NOVO] FUNÇÕES PARA ASSOCIAR E CRIAR TICKET
// ==================================================

// 1. Verificar se um Ticket existe (Botão Associar)
export const verificarTicket = async (req, res) => {
    const { id } = req.body;
    if(!id) return res.status(400).json({success:false, message: "ID obrigatório"});

    try {
        const ticket = await chamadoModel.findById(id);
        if(ticket) {
            // Se encontrado, retornamos os dados principais
            res.json({ success: true, data: ticket });
        } else {
            res.json({ success: false, message: "Ticket não encontrado" });
        }
    } catch(e) { 
        res.status(500).json({ success: false, message: e.message }); 
    }
};

// 2. Criar Chamado a partir do Chat (Botão Criar)
export const criarChamadoDoChat = async (req, res) => {
    const { chamado, numero } = req.body; 
    // 'chamado' contém { assunto, descricao, categoria_unificada_id, prioridade, requisitante_id, nome_requisitante_manual ... }
    // 'numero' é o telefone do WhatsApp (idRemoto)

    try {
        // A. Cria o chamado usando o model existente
        const novoId = await chamadoModel.create(chamado);
        
        // B. Busca o chamado recém criado para ter detalhes (como nome do requisitante salvo)
        const ticketCriado = await chamadoModel.findById(novoId);

        // C. Envia mensagem no WhatsApp avisando o cliente
        const msgZap = `🎫 *Chamado Criado com Sucesso*\n\nSeu atendimento gerou o ticket *#${novoId}*.\n*Assunto:* ${ticketCriado.assunto}\n\nAguarde, nossa equipe técnica já está atuando.`;
        await evolutionService.enviarTexto(numero, msgZap);

        // D. Atualiza o contexto do bot (Opcional: vincula ticket ao chat em memória)
        if(userContext[numero]) {
            userContext[numero].ultimoTicketId = novoId;
        }

        // E. Envia e-mail (se houver e-mail do requisitante)
        if (ticketCriado.emailRequisitante) {
            EmailService.enviarNotificacaoCriacao(ticketCriado.emailRequisitante, ticketCriado)
                .catch(err => console.error("Erro silencioso ao enviar email:", err));
        }

        // F. Notifica Socket (para aparecer no painel de "Gerenciar Chamados")
        if (req.io) {
            req.io.emit('novoChamadoInterno', {
                id: novoId,
                assunto: ticketCriado.assunto,
                requisitante: ticketCriado.nomeRequisitante || "WhatsApp",
                prioridade: ticketCriado.prioridade
            });
        }

        res.status(201).json({ success: true, id: novoId });

    } catch (e) {
        console.error("Erro ao criar chamado do chat:", e);
        res.status(500).json({ success: false, message: e.message });
    }
};