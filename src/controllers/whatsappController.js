import * as evolutionService from '../services/evolutionService.js';
import * as chamadoModel from '../models/chamadoModel.js'; 
import * as EmailService from '../services/emailService.js'; 
import { OpenAI } from 'openai';
import fs from 'fs';
import path from 'path';

// ==================================================
// 1. CONFIGURAÇÕES DA GROQ
// ==================================================
const groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY, 
    baseURL: "https://api.groq.com/openai/v1"
});

const MODELO_IA = "llama-3.1-8b-instant"; 

// --- CACHE ANTI-DUPLICAÇÃO ---
const processedMessageIds = new Set();

// ==================================================
// 2. PERSISTÊNCIA DE DADOS (CORREÇÃO DA AMNÉSIA)
// ==================================================
// Arquivo onde salvaremos quem é dono de qual chat
const STATE_FILE = path.resolve('whatsappState.json');

// Carrega memória local
let userContext = {};

function loadStateDisk() {
    try {
        if (fs.existsSync(STATE_FILE)) {
            const raw = fs.readFileSync(STATE_FILE, 'utf-8');
            userContext = JSON.parse(raw);
            console.log("💾 [SISTEMA] Memória de atendimentos carregada do disco.");
        }
    } catch (e) {
        console.error("Erro ao carregar estado:", e);
        userContext = {};
    }
}

function saveStateDisk() {
    try {
        fs.writeFileSync(STATE_FILE, JSON.stringify(userContext, null, 2));
    } catch (e) {
        console.error("Erro ao salvar estado:", e);
    }
}

// Carrega ao iniciar
loadStateDisk();

// ==================================================
// 3. O CÉREBRO DA IA (APENAS PARA O SUBMENU T.I.)
// ==================================================
const gerarPromptSistema = (nomeUsuario) => {
    const nome = nomeUsuario || 'Colaborador';
    return `
IDENTIDADE:
Você é o Assistente Virtual do Suporte Técnico do Supermercado Rosalina.
Atendendo: ${nome}.

OBJETIVO:
Coletar informações sobre o problema técnico relatado.
NÃO tente resolver o problema. NÃO invente menus de compras ou estoque.
Seja breve e profissional.
`;
};

const calcularPosicaoFila = () => {
    return Object.values(userContext).filter(ctx => ctx.etapa === 'FILA_ESPERA').length;
};

// ==================================================
// 4. TEXTOS FIXOS
// ==================================================
const MENSAGENS = {
    SAUDACAO: (nome) => `👋 Olá, *${nome}*. Bem-vindo ao Suporte Técnico do *Supermercado Rosalina*.

Selecione uma opção para prosseguir:

1️⃣ **Reportar Problema** (Falar com T.I.)
*️⃣ **Consultar Ticket** (Ex: digite *123)

_Para encerrar a qualquer momento, digite #._`,

    MENU_TI_COM_FILA: `✅ *Solicitação Iniciada*
    
Você está na fila de atendimento.
Por favor, **descreva detalhadamente o problema** abaixo (qual equipamento, mensagem de erro, setor).
_Nossa equipe analisará sua mensagem enquanto um técnico assume._`,

    CONFIRMACAO_FINAL: (posicao) => `✅ *Você acessou a Fila de Suporte T.I.*
    
Opção selecionada: Suporte T.I
📌 *Sua posição na fila:* ${posicao}º

Você entrou na fila, logo você será atendido.

📞 *Em caso de urgência pode nos acionar no número:* (12) 98142-2925`,

    OPCAO_INVALIDA: `⚠️ *Opção inválida.*
Por favor, digite apenas o número correspondente.`,

    AVALIACAO_INICIO: `⏹️ *Atendimento Finalizado.*

Por favor, avalie nosso suporte técnico:

1️⃣ 😡 Insatisfeito
2️⃣ 🙁 Ruim
3️⃣ 😐 Regular
4️⃣ 🙂 Bom
5️⃣ 🤩 Excelente

9️⃣ ❌ Pular`,

    AVALIACAO_MOTIVO: `Obrigado. Se houver alguma observação sobre o atendimento, digite abaixo (ou 9 para sair).`,

    ENCERRAMENTO_FINAL: `✅ *Chamado Encerrado.*
O Supermercado Rosalina agradece.
_Envie uma mensagem se precisar de novo suporte._`
};

// ==================================================
// 5. PROCESSAMENTO DA IA
// ==================================================
async function processarComGroq(numeroUsuario, textoUsuario, nomeUsuario) {
    const contexto = userContext[numeroUsuario];
    if (!contexto || contexto.botPausado) return null;

    try {
        if (!contexto.historico || contexto.historico.length === 0) {
            contexto.historico = [{ role: "system", content: gerarPromptSistema(nomeUsuario) }];
        }
        
        contexto.historico.push({ role: "user", content: textoUsuario });
        
        if (contexto.historico.length > 6) {
            contexto.historico = [contexto.historico[0], ...contexto.historico.slice(-5)];
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
        console.error("[GROQ] Erro:", erro);
        return null; 
    }
}

// ==================================================
// 6. WEBHOOK
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
      
      if (processedMessageIds.has(idMensagem)) return res.status(200).json({ success: true });
      processedMessageIds.add(idMensagem);
      setTimeout(() => processedMessageIds.delete(idMensagem), 10000);

      const nomeAutor = msg.pushName || idRemoto.split('@')[0];
      const texto = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || "").trim();
      const isGroup = idRemoto.includes('@g.us'); 
      const isStatus = idRemoto === 'status@broadcast'; 

      if (!isStatus && !isGroup && texto) {
        const ctxAtual = userContext[idRemoto] || {};
        
        // [SEGURANÇA] Envia o dono do chat para o frontend filtrar
        io.emit('novaMensagemWhatsapp', { 
            id: idMensagem, 
            chatId: idRemoto, 
            nome: nomeAutor, 
            texto: texto, 
            fromMe: isFromMe,
            mostrarNaFila: ctxAtual.mostrarNaFila || false,
            nomeAgente: ctxAtual.nomeAgente 
        });

        if (!isFromMe) {
            if (!userContext[idRemoto]) {
                userContext[idRemoto] = { 
                    etapa: 'INICIO', 
                    botPausado: false, 
                    historico: [], 
                    mostrarNaFila: false 
                };
                saveStateDisk(); // Salva novo estado
            }
            const ctx = userContext[idRemoto];
            let respostaBot = null;
            const textoMin = texto.toLowerCase();

            const gatilhosInicio = ['oi', 'ola', 'menu', 'inicio', 'start', 'bom dia', 'boa tarde', 'ajuda', 'suporte'];
            const textoLimpo = textoMin.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"").trim(); 
            const ehSaudacao = gatilhosInicio.some(s => textoLimpo === s || (textoLimpo.startsWith(s) && textoLimpo.length < 50));

            // --- COMANDOS GERAIS ---
            if (texto === '#' || textoMin === 'encerrar' || textoMin === 'sair') {
                respostaBot = MENSAGENS.AVALIACAO_INICIO;
                ctx.etapa = 'AVALIACAO_NOTA';
                ctx.botPausado = true; 
                ctx.nomeAgente = null;
                saveStateDisk(); // Atualiza
            }
            else if (ehSaudacao) {
                if (ctx.etapa === 'MENU' && textoMin !== 'menu') {
                    respostaBot = MENSAGENS.OPCAO_INVALIDA;
                } else {
                    ctx.etapa = 'MENU';
                    ctx.botPausado = false;
                    ctx.nomeAgente = null;
                    ctx.mostrarNaFila = false;
                    ctx.historico = [{ role: "system", content: gerarPromptSistema(nomeAutor) }];
                    respostaBot = MENSAGENS.SAUDACAO(nomeAutor);
                    saveStateDisk(); // Atualiza
                }
            }
            // --- MENU PRINCIPAL ---
            else if (ctx.etapa === 'MENU') {
                if (texto === '1' || textoMin.includes('problema') || textoMin.includes('suporte')) {
                    respostaBot = MENSAGENS.MENU_TI_COM_FILA;
                    ctx.etapa = 'AGUARDANDO_DESCRICAO'; 
                    ctx.botPausado = false; 
                    saveStateDisk();
                } 
                else if (texto.startsWith('*') || textoMin.includes('ticket')) {
                    let ticketNumeroStr = texto.startsWith('*') ? texto.substring(1).trim() : texto.replace(/\D/g,'');
                    if (!ticketNumeroStr) {
                        respostaBot = "ℹ️ Digite o número do ticket com asterisco. Ex: ***123**";
                    } else {
                        const ticketId = parseInt(ticketNumeroStr);
                        const ticket = await chamadoModel.findById(ticketId); 
                        if (ticket) {
                            respostaBot = `🎫 *Ticket #${ticket.id}*\nStatus: ${ticket.status}\n\n_Digite menu para retornar._`;
                            ctx.botPausado = true;
                            setTimeout(() => { ctx.botPausado = false; }, 30000); 
                        } else {
                            respostaBot = `🚫 *Ticket #${ticketId} não localizado.*`;
                        }
                    }
                } else {
                    respostaBot = MENSAGENS.OPCAO_INVALIDA;
                }
            }
            // --- FILA ---
            else if (ctx.etapa === 'AGUARDANDO_DESCRICAO') {
                ctx.mostrarNaFila = true; 
                io.emit('notificacaoChamado', { chatId: idRemoto, nome: nomeAutor, status: 'PENDENTE_TI' });
                const posicaoAtual = calcularPosicaoFila() + 1;
                respostaBot = MENSAGENS.CONFIRMACAO_FINAL(posicaoAtual);
                ctx.etapa = 'FILA_ESPERA';
                ctx.botPausado = true; 
                saveStateDisk();
            }
            // --- AVALIAÇÃO ---
            else if (ctx.etapa === 'AVALIACAO_NOTA') {
                if (['1', '2', '3', '4', '5'].includes(texto)) {
                    respostaBot = MENSAGENS.AVALIACAO_MOTIVO;
                    ctx.etapa = 'AVALIACAO_MOTIVO';
                    saveStateDisk();
                } else if (texto === '9') {
                    respostaBot = MENSAGENS.ENCERRAMENTO_FINAL;
                    ctx.mostrarNaFila = false; 
                    delete userContext[idRemoto];
                    saveStateDisk();
                } else {
                    respostaBot = "Digite uma nota de **1 a 5** ou **9** para sair.";
                }
            }
            else if (ctx.etapa === 'AVALIACAO_MOTIVO') {
                respostaBot = MENSAGENS.ENCERRAMENTO_FINAL;
                ctx.mostrarNaFila = false; 
                delete userContext[idRemoto]; 
                saveStateDisk();
            }
            else if (!respostaBot && !ctx.botPausado && ctx.etapa === 'INICIO') {
                ctx.etapa = 'MENU';
                ctx.historico = [{ role: "system", content: gerarPromptSistema(nomeAutor) }];
                respostaBot = MENSAGENS.SAUDACAO(nomeAutor);
                saveStateDisk();
            }

            if (respostaBot) {
                await evolutionService.enviarTexto(idRemoto, respostaBot);
                io.emit('novaMensagemWhatsapp', { 
                    id: 'bot-'+Date.now(), 
                    chatId: idRemoto, 
                    nome: "Bot", 
                    texto: respostaBot, 
                    fromMe: true,
                    mostrarNaFila: ctx.mostrarNaFila,
                    nomeAgente: ctx.nomeAgente
                });
            }
        }
      }
    }
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('[WEBHOOK] Erro:', error);
    res.status(500).json({ success: false });
  }
};

// ==================================================
// 7. FUNÇÕES ADMINISTRATIVAS (BLINDADAS)
// ==================================================

export const atenderAtendimento = async (req, res) => {
    const { numero, nomeAgente } = req.body;
    try {
        if (!userContext[numero]) userContext[numero] = { historico: [] };

        // [SEGURANÇA] Bloqueio de Concorrência
        if (userContext[numero].nomeAgente && userContext[numero].nomeAgente !== nomeAgente) {
             return res.status(409).json({ 
                 success: false, 
                 message: `Atendimento já assumido por ${userContext[numero].nomeAgente}.` 
             });
        }

        userContext[numero].nomeAgente = nomeAgente;
        userContext[numero].botPausado = true; 
        userContext[numero].etapa = 'ATENDIMENTO_HUMANO';
        userContext[numero].mostrarNaFila = true; 
        
        saveStateDisk(); // Salva no disco

        const msg = `👨‍💻 *Atendimento Humano Iniciado*\n\nO técnico *${nomeAgente}* assumiu o chamado.`;
        await evolutionService.enviarTexto(numero, msg);
        
        if (req.io) {
            req.io.emit('atendimentoAssumido', {
                chatId: numero,
                nomeAgente: nomeAgente
            });
        }

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
        
        saveStateDisk(); // Salva

        await evolutionService.enviarTexto(numero, MENSAGENS.AVALIACAO_INICIO);
        res.status(200).json({ success: true });
    } catch (error) { res.status(500).json({ success: false }); }
};

// [SEGURANÇA TOTAL] Envio de mensagem com validação rígida de dono
export const handleSendMessage = async (req, res) => {
  const { numero, mensagem, nomeAgenteTemporario } = req.body;
  try {
      // 1. Verifica se o chat tem dono
      const contexto = userContext[numero];
      
      if (contexto && contexto.nomeAgente) {
          // 2. Se tem dono, OBRIGA que seja quem está enviando
          if (contexto.nomeAgente !== nomeAgenteTemporario) {
              return res.status(403).json({ 
                  success: false, 
                  message: `⛔ ACESSO NEGADO: Este chat pertence a ${contexto.nomeAgente}.` 
              });
          }
      }

      let mensagemFinal = mensagem;
      if (nomeAgenteTemporario) {
          mensagemFinal = `*${nomeAgenteTemporario}*\n${mensagem}`;
      }

      if(contexto) contexto.mostrarNaFila = true;
      else if (!contexto) userContext[numero] = { etapa: 'ATENDIMENTO_HUMANO', botPausado: true, mostrarNaFila: true };
      
      saveStateDisk(); // Salva se mudar algo

      const r = await evolutionService.enviarTexto(numero, mensagemFinal);
      res.status(200).json({ success: true, data: r });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// [SEGURANÇA TOTAL] Listagem filtrada no servidor
export const listarConversas = async (req, res) => { 
    try { 
        const agenteSolicitante = req.query.agente;
        const todosChats = await evolutionService.buscarConversas(); 
        
        const chatsFiltrados = todosChats.filter(chat => {
             const ctx = userContext[chat.id] || {};
             const temDono = !!ctx.nomeAgente;
             
             // 1. Sem dono = TODOS vêem (Fila)
             if (!temDono) return true; 
             
             // 2. Com dono = SÓ O DONO vê
             if (temDono && ctx.nomeAgente === agenteSolicitante) return true; 
             
             // 3. Caso contrário = INVISÍVEL
             return false; 
        });

        const m = chatsFiltrados.map(x => {
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
    // 1. Aceita o parâmetro LIMIT
    const { numero, nomeSolicitante, limit } = req.body; 
    
    if (!numero) return res.status(400).json({ success: false, message: 'Número obrigatório' });
    
    try {
        const contexto = userContext[numero];
        if (contexto && contexto.nomeAgente) {
             if (contexto.nomeAgente !== nomeSolicitante) {
                 return res.status(403).json({ 
                     success: false, 
                     message: "⛔ Você não tem permissão para ver este chat.",
                     data: [] 
                 });
             }
        }

        // 2. Usa o limite informado ou 50 por padrão
        const qtdMensagens = limit || 50;

        const rawMessages = await evolutionService.buscarMensagensHistorico(numero, qtdMensagens);
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

export const transferirAtendimento = async (req, res) => {
    const { numero, novoAgente, nomeAgenteAtual, nomeCliente } = req.body; 
    try {
        if (!userContext[numero]) return res.status(404).json({ success: false, message: "Chat não encontrado." });
        const oldAgent = nomeAgenteAtual || userContext[numero].nomeAgente || "Atendente";
        userContext[numero].nomeAgente = novoAgente;
        userContext[numero].etapa = 'ATENDIMENTO_HUMANO'; 
        userContext[numero].botPausado = true;
        userContext[numero].mostrarNaFila = true; 
        
        saveStateDisk(); // Salva

        const msgTransferencia = `🔄 *Transferência*\n\nChamado repassado de *${oldAgent}* para *${novoAgente}*.`;
        await evolutionService.enviarTexto(numero, msgTransferencia);
        if(req.io) {
             req.io.emit('transferenciaChamado', { 
                chatId: numero, 
                novoAgente: novoAgente, 
                antigoAgente: oldAgent, 
                nomeCliente: nomeCliente, 
                timestamp: new Date()
             });
        }
        res.status(200).json({ success: true });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

export const verificarTicket = async (req, res) => {
    const { id } = req.body;
    if(!id) return res.status(400).json({success:false, message: "ID obrigatório"});
    try {
        const ticket = await chamadoModel.findById(id);
        if(ticket) res.json({ success: true, data: ticket });
        else res.json({ success: false, message: "Ticket não encontrado" });
    } catch(e) { res.status(500).json({ success: false, message: e.message }); }
};

export const criarChamadoDoChat = async (req, res) => {
    // req.body.chamado traz { requisitante_id, categoria_id, assunto ... }
    const { chamado, numero } = req.body; 
    
    try {
        // Validação
        const reqId = parseInt(chamado.requisitante_id);
        if (isNaN(reqId) || reqId <= 0) {
            return res.status(400).json({ success: false, message: 'ID do Requisitante inválido ou não fornecido.' });
        }

        // Mapeamento para o formato do Model (camelCase e sufixos Num)
        const dadosParaModel = {
            assunto: chamado.assunto,
            descricao: chamado.descricao,
            prioridade: chamado.prioridade || 'Média',
            status: 'Aberto',
            
            requisitanteIdNum: reqId, // Mapeia requisitante_id -> requisitanteIdNum
            categoriaUnificadaIdNum: chamado.categoria_id ? parseInt(chamado.categoria_id) : null,
            
            // Campos opcionais que não vêm do chat, mas o model pode esperar
            loja_id: null,
            departamento_id: null,
            nomeRequisitanteManual: null,
            emailRequisitanteManual: null,
            telefoneRequisitanteManual: null
        };

        const novoId = await chamadoModel.create(dadosParaModel);
        
        // Pós-criação
        const ticketCriado = await chamadoModel.findById(novoId);
        const msgZap = `🎫 *Ticket Aberto: #${novoId}*\nAssunto: ${ticketCriado.assunto}\n\nAguarde nosso retorno.`;
        
        await evolutionService.enviarTexto(numero, msgZap);
        
        if(userContext[numero]) {
            userContext[numero].ultimoTicketId = novoId;
            saveStateDisk();
        }

        if (ticketCriado.emailRequisitante) {
            EmailService.enviarNotificacaoCriacao(ticketCriado.emailRequisitante, ticketCriado).catch(console.error);
        }

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
        console.error("Erro criarChamadoDoChat:", e);
        res.status(500).json({ success: false, message: e.message }); 
    }
};
export const handleDisconnect = async (req, res) => { try { await evolutionService.desconectarInstancia(); res.status(200).json({ success: true }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
export const connectInstance = async (req, res) => { try { const r = await evolutionService.criarInstancia(); res.status(200).json({ success: true, data: r }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
export const checarStatus = async (req, res) => { try { const r = await evolutionService.consultarStatus(); res.status(200).json({ success: true, data: r }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
export const configurarUrlWebhook = async (req, res) => { try { const h = req.get('host'); const p = h.includes('localhost') ? 'http' : 'https'; await evolutionService.configurarWebhook(`${p}://${h}/api/evolution/webhook`); res.status(200).json({ success: true }); } catch (e) { res.status(500).json({ success: false }); } };