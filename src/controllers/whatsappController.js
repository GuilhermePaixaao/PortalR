import * as evolutionService from '../services/evolutionService.js';
import * as chamadoModel from '../models/chamadoModel.js'; 
import * as EmailService from '../services/emailService.js'; 
import * as contatoModel from '../models/contatoModel.js'; 
import * as whatsappModel from '../models/whatsappModel.js'; 
import { OpenAI } from 'openai';

// ==================================================
// 1. CONFIGURAÇÕES DA GROQ
// ==================================================
const groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY, 
    baseURL: "https://api.groq.com/openai/v1"
});

const MODELO_IA = "llama-3.1-8b-instant"; 

// --- CACHE ANTI-DUPLICAÇÃO (Apenas memória RAM, seguro reiniciar) ---
const processedMessageIds = new Set();

// ==================================================
// 2. TEXTOS E PROMPTS
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
📞 *Em caso de urgência:* (12) 98142-2925`,

    OPCAO_INVALIDA: `⚠️ *Opção inválida.* Digite apenas o número correspondente.`,

    AVALIACAO_INICIO: `⏹️ *Atendimento Finalizado.*
Por favor, avalie nosso suporte técnico:
1️⃣ 😡 Insatisfeito
2️⃣ 🙁 Ruim
3️⃣ 😐 Regular
4️⃣ 🙂 Bom
5️⃣ 🤩 Excelente
9️⃣ ❌ Pular`,

    AVALIACAO_MOTIVO: `Obrigado. Se houver alguma observação, digite abaixo (ou 9 para sair).`,

    ENCERRAMENTO_FINAL: `✅ *Chamado Encerrado.* O Supermercado Rosalina agradece.`
};

// ==================================================
// 3. PROCESSAMENTO DA IA
// ==================================================
async function processarComGroq(session, textoUsuario, nomeUsuario) {
    if (session.botPausado) return null;

    try {
        let historico = session.historico_ia || [];
        
        if (historico.length === 0) {
            historico = [{ role: "system", content: gerarPromptSistema(nomeUsuario) }];
        }
        
        historico.push({ role: "user", content: textoUsuario });
        
        // Mantém contexto de ~6 mensagens anteriores (system + 5)
        if (historico.length > 7) {
            historico = [historico[0], ...historico.slice(-6)];
        }

        const completion = await groq.chat.completions.create({
            messages: historico,
            model: MODELO_IA,
            temperature: 0.1,
            max_tokens: 150,  
        });

        const respostaIA = completion.choices[0]?.message?.content || "";
        
        if (respostaIA) {
            historico.push({ role: "assistant", content: respostaIA });
            // Atualiza histórico no Banco
            await whatsappModel.updateSession(session.numero, { historico_ia: historico });
        }
        return respostaIA;

    } catch (erro) {
        console.error("[GROQ] Erro:", erro);
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

      // [ATENÇÃO] Mantendo bloqueio de grupos conforme solicitado
      if (idRemoto.includes('@g.us')) return res.status(200).json({ success: true });

      if (processedMessageIds.has(idMensagem)) return res.status(200).json({ success: true });
      processedMessageIds.add(idMensagem);
      setTimeout(() => processedMessageIds.delete(idMensagem), 15000);

      const nomeAutor = msg.pushName || msg.pushname || idRemoto.split('@')[0];
      const texto = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || "").trim();
      const isImage = !!msg.message?.imageMessage;
      const isStatus = idRemoto === 'status@broadcast'; 

      if (!isStatus && (texto || isImage)) {
        
        // Salva histórico de contato (Model existente)
        contatoModel.salvarContato(idRemoto, nomeAutor).catch(e => console.error("Erro contato:", e.message));

        // =================================================================
        // RECUPERA SESSÃO DO BANCO DE DADOS
        // =================================================================
        const session = await whatsappModel.findOrCreateSession(idRemoto, nomeAutor);
        
        // [NOVO] SALVA MENSAGEM DO CLIENTE NO BANCO DE DADOS
        await whatsappModel.salvarMensagem(
            idRemoto, 
            texto || (isImage ? "[Imagem]" : ""), 
            isFromMe, 
            idMensagem, 
            isImage ? 'image' : 'text', 
            nomeAutor
        );

        io.emit('novaMensagemWhatsapp', { 
            id: idMensagem, 
            chatId: idRemoto, 
            nome: nomeAutor, 
            texto: texto || (isImage ? "📷 [Imagem]" : ""), 
            fromMe: isFromMe,
            mostrarNaFila: session.mostrar_na_fila,
            nomeAgente: session.nome_agente 
        });

        if (!isFromMe) {
            let respostaBot = null;
            
            if (texto) {
                const textoMin = texto.toLowerCase();
                const gatilhosInicio = ['oi', 'ola', 'menu', 'inicio', 'start', 'bom dia', 'boa tarde', 'ajuda', 'suporte'];
                const textoLimpo = textoMin.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"").trim(); 
                const ehSaudacao = gatilhosInicio.some(s => textoLimpo === s || (textoLimpo.startsWith(s) && textoLimpo.length < 50));

                // --- RESET / SAIR ---
                if (texto === '#' || textoMin === 'encerrar' || textoMin === 'sair') {
                    respostaBot = MENSAGENS.AVALIACAO_INICIO;
                    await whatsappModel.updateSession(idRemoto, { 
                        etapa: 'AVALIACAO_NOTA', 
                        bot_pausado: true,
                        nome_agente: null 
                    });
                }
                // --- INICIO / SAUDACAO ---
                else if (ehSaudacao) {
                    if (session.etapa === 'MENU' && textoMin !== 'menu') {
                        respostaBot = MENSAGENS.OPCAO_INVALIDA;
                    } else {
                        respostaBot = MENSAGENS.SAUDACAO(nomeAutor);
                        await whatsappModel.updateSession(idRemoto, { 
                            etapa: 'MENU', 
                            bot_pausado: false, 
                            nome_agente: null,
                            mostrar_na_fila: false,
                            historico_ia: [{ role: "system", content: gerarPromptSistema(nomeAutor) }]
                        });
                    }
                }
                // --- MENU PRINCIPAL ---
                else if (session.etapa === 'MENU') {
                    if (texto === '1' || textoMin.includes('problema') || textoMin.includes('suporte')) {
                        respostaBot = MENSAGENS.MENU_TI_COM_FILA;
                        await whatsappModel.updateSession(idRemoto, { 
                            etapa: 'AGUARDANDO_DESCRICAO', 
                            bot_pausado: false 
                        });
                    } 
                    else if (texto.startsWith('*') || textoMin.includes('ticket')) {
                        let ticketNumeroStr = texto.startsWith('*') ? texto.substring(1).trim() : texto.replace(/\D/g,'');
                        if (!ticketNumeroStr) {
                            respostaBot = "ℹ️ Digite o número do ticket com asterisco. Ex: ***123**";
                        } else {
                            const ticket = await chamadoModel.findById(parseInt(ticketNumeroStr)); 
                            if (ticket) {
                                respostaBot = `🎫 *Ticket #${ticket.id}*\nStatus: ${ticket.status}\n\n_Digite menu para retornar._`;
                                await whatsappModel.updateSession(idRemoto, { bot_pausado: true });
                                setTimeout(() => whatsappModel.updateSession(idRemoto, { bot_pausado: false }), 30000); 
                            } else {
                                respostaBot = `🚫 *Ticket não localizado.*`;
                            }
                        }
                    } else {
                        respostaBot = MENSAGENS.OPCAO_INVALIDA;
                    }
                }
                // --- FILA ---
                else if (session.etapa === 'AGUARDANDO_DESCRICAO') {
                    // 1. IA processa o texto para entender o problema
                    await processarComGroq(session, texto, nomeAutor);

                    // ==================================================================
                    // [MODIFICAÇÃO] ATRIBUIÇÃO AUTOMÁTICA DE ATENDENTE
                    // ==================================================================
                    const FUNCIONARIO_PADRAO = "Daniel"; // <--- NOME EXATO DO LOGIN
                    
                    // 2. Coloca na fila JÁ ATRIBUÍDO e como ATENDIMENTO HUMANO
                    await whatsappModel.updateSession(idRemoto, { 
                        etapa: 'ATENDIMENTO_HUMANO', 
                        bot_pausado: true,
                        mostrar_na_fila: true,
                        nome_agente: FUNCIONARIO_PADRAO 
                    });

                    // ⭐ [CORREÇÃO CRÍTICA] Atualiza a memória para o io.emit pegar o dado certo
                    session.nome_agente = FUNCIONARIO_PADRAO;
                    session.etapa = 'ATENDIMENTO_HUMANO';
                    session.mostrar_na_fila = true;

                    io.emit('notificacaoChamado', { 
                        chatId: idRemoto, 
                        nome: nomeAutor, 
                        status: 'ATRIBUIDO_AUTO',
                        atendente: FUNCIONARIO_PADRAO
                    });
                    
                    const posicaoFila = (await whatsappModel.contarFila()) + 1; 
                    respostaBot = MENSAGENS.CONFIRMACAO_FINAL(posicaoFila) + 
                                  `\n\n👨‍💻 O atendente *${FUNCIONARIO_PADRAO}* já foi notificado.`;
                }
                // --- AVALIAÇÃO ---
                else if (session.etapa === 'AVALIACAO_NOTA') {
                    if (['1', '2', '3', '4', '5'].includes(texto)) {
                        respostaBot = MENSAGENS.AVALIACAO_MOTIVO;
                        await whatsappModel.updateSession(idRemoto, { etapa: 'AVALIACAO_MOTIVO' });
                    } else if (texto === '9') {
                        respostaBot = MENSAGENS.ENCERRAMENTO_FINAL;
                        await whatsappModel.resetSession(idRemoto);
                    } else {
                        respostaBot = "Digite uma nota de **1 a 5** ou **9** para sair.";
                    }
                }
                else if (session.etapa === 'AVALIACAO_MOTIVO') {
                    respostaBot = MENSAGENS.ENCERRAMENTO_FINAL;
                    await whatsappModel.resetSession(idRemoto);
                }
                // --- RESPOSTA PADRÃO / LOOP ---
                else if (!respostaBot && !session.bot_pausado && session.etapa === 'INICIO') {
                    respostaBot = MENSAGENS.SAUDACAO(nomeAutor);
                    await whatsappModel.updateSession(idRemoto, { 
                        etapa: 'MENU', 
                        historico_ia: [{ role: "system", content: gerarPromptSistema(nomeAutor) }]
                    });
                }

                if (respostaBot) {
                    const sentMsg = await evolutionService.enviarTexto(idRemoto, respostaBot);
                    const botMsgId = sentMsg?.key?.id || 'bot-'+Date.now();

                    // [NOVO] SALVA A RESPOSTA DO BOT NO BANCO
                    await whatsappModel.salvarMensagem(
                        idRemoto, 
                        respostaBot, 
                        true, // fromMe
                        botMsgId, 
                        'text', 
                        'Bot'
                    );

                    io.emit('novaMensagemWhatsapp', { 
                        id: botMsgId, 
                        chatId: idRemoto, 
                        nome: "Bot", 
                        texto: respostaBot, 
                        fromMe: true,
                        mostrarNaFila: session.etapa === 'FILA_ESPERA' || session.etapa === 'ATENDIMENTO_HUMANO',
                        nomeAgente: session.nome_agente 
                    });
                }
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
// 5. FUNÇÕES ADMINISTRATIVAS (AGORA COM DB)
// ==================================================

export const atenderAtendimento = async (req, res) => {
    const { numero, nomeAgente } = req.body;
    try {
        const session = await whatsappModel.findOrCreateSession(numero, 'Cliente');

        if (session.nome_agente && session.nome_agente !== nomeAgente) {
             return res.status(409).json({ success: false, message: `Atendimento já assumido por ${session.nome_agente}.` });
        }

        await whatsappModel.updateSession(numero, {
            nome_agente: nomeAgente,
            bot_pausado: true,
            etapa: 'ATENDIMENTO_HUMANO',
            mostrar_na_fila: true
        });

        const msg = `👨‍💻 *Atendimento Humano Iniciado*\n\nO técnico *${nomeAgente}* assumiu o chamado.`;
        await evolutionService.enviarTexto(numero, msg);
        
        if (req.io) {
            req.io.emit('atendimentoAssumido', { chatId: numero, nomeAgente: nomeAgente });
        }

        res.status(200).json({ success: true });
    } catch (error) { res.status(500).json({ success: false }); }
};

export const finalizarAtendimento = async (req, res) => {
    const { numero } = req.body;
    try {
        await whatsappModel.updateSession(numero, {
            etapa: 'AVALIACAO_NOTA',
            bot_pausado: true,
            nome_agente: null,
            mostrar_na_fila: false
        });

        await evolutionService.enviarTexto(numero, MENSAGENS.AVALIACAO_INICIO);
        res.status(200).json({ success: true });
    } catch (error) { res.status(500).json({ success: false }); }
};

export const handleSendMessage = async (req, res) => {
  const { numero, mensagem, nomeAgenteTemporario } = req.body;
  try {
      const session = await whatsappModel.findOrCreateSession(numero, 'Cliente');
      
      if (session.nome_agente && session.nome_agente !== nomeAgenteTemporario) {
          return res.status(403).json({ success: false, message: `⛔ ACESSO NEGADO: Este chat pertence a ${session.nome_agente}.` });
      }

      let mensagemFinal = mensagem;
      if (nomeAgenteTemporario) {
          mensagemFinal = `*${nomeAgenteTemporario}*\n${mensagem}`;
      }

      // Garante que apareça na fila e pause o bot
      if(session.etapa !== 'ATENDIMENTO_HUMANO') {
          await whatsappModel.updateSession(numero, { etapa: 'ATENDIMENTO_HUMANO', bot_pausado: true, mostrar_na_fila: true });
      }

      const r = await evolutionService.enviarTexto(numero, mensagemFinal);
      const msgId = r?.key?.id || 'agent-'+Date.now();

      // [NOVO] SALVA MENSAGEM DO ATENDENTE NO BANCO
      await whatsappModel.salvarMensagem(
          numero, 
          mensagemFinal, 
          true, // fromMe
          msgId, 
          'text', 
          nomeAgenteTemporario || 'Agente'
      );

      res.status(200).json({ success: true, data: r });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

export const enviarMidiaController = async (req, res) => {
    // Certifique-se de que 'tipo' está sendo desestruturado do req.body
    const { numero, midia, nomeArquivo, legenda, nomeAgenteTemporario, tipo } = req.body;
    
    try {
        const session = await whatsappModel.findOrCreateSession(numero, 'Cliente');
        
        if (session.nome_agente && session.nome_agente !== nomeAgenteTemporario && nomeAgenteTemporario) {
             return res.status(403).json({ success: false, message: `⛔ ACESSO NEGADO: Este chat pertence a ${session.nome_agente}.` });
        }

        if(!session.mostrar_na_fila) await whatsappModel.updateSession(numero, { mostrar_na_fila: true });

        let legendaFinal = legenda || "";
        if (nomeAgenteTemporario) legendaFinal = `*${nomeAgenteTemporario}*\n${legendaFinal}`;

        // Chama o serviço passando o tipo explicitamente
        const r = await evolutionService.enviarMidia(numero, midia, nomeArquivo, legendaFinal, tipo);
        
        // [NOVO] SALVA REGISTRO DE MÍDIA NO BANCO
        await whatsappModel.salvarMensagem(
            numero, 
            `[Arquivo: ${tipo}] ${legendaFinal}`, 
            true, 
            r?.key?.id, 
            tipo, 
            nomeAgenteTemporario || 'Agente'
        );
        
        res.status(200).json({ success: true, data: r });
    } catch (e) { 
        console.error("Erro controller midia:", e);
        res.status(500).json({ success: false, message: e.message }); 
    }
};

// Localize a função listarConversas e substitua tudo por isto:

// Localize a função listarConversas e substitua tudo por isto:

export const listarConversas = async (req, res) => { 
    try { 
        const agenteSolicitante = req.query.agente;
        const mode = req.query.mode; 
        
        // =====================================================================
        // MODO HISTÓRICO: BUSCA DO BANCO (FILTRO LIMPO)
        // =====================================================================
        if (mode === 'history') {
             // Busca direto do MySQL (Só traz quem tem mensagem salva)
             const chatsDoBanco = await whatsappModel.listarChatsComHistorico();

             const m = chatsDoBanco.map(c => {
                return { 
                    numero: c.numero, 
                    nome: c.nome_contato || c.numero, 
                    ultimaMensagem: c.ultima_mensagem || "...", 
                    unread: false,
                    visivel: true, 
                    etapa: c.etapa, 
                    nomeAgente: c.nome_agente,
                    data: c.data_ultima_msg // Extra pra ordenação se precisar
                };
            });
            return res.status(200).json({ success: true, data: m }); 
        }

        // =====================================================================
        // MODO PADRÃO (FILA): CONTINUA USANDO A API PARA TEMPO REAL
        // =====================================================================
        
        // Busca conversas na API da Evolution
        const todosChats = await evolutionService.buscarConversas(200, 0) || []; 

        if (!Array.isArray(todosChats)) {
             return res.status(200).json({ success: true, data: [] });
        }  

        const sessions = await whatsappModel.getAllSessions();
        const sessionMap = {};
        sessions.forEach(s => sessionMap[s.numero] = s);

        const getNumeroReal = (chat) => {
            if (chat.remoteJid && chat.remoteJid.includes('@')) return chat.remoteJid;
            return chat.id; 
        };

        const chatsFiltrados = todosChats
            .filter(x => x && (x.id || x.remoteJid)) 
            .filter(chat => {
                 const numeroReal = getNumeroReal(chat);
                 const sessao = sessionMap[numeroReal] || {};
                 const temDono = !!sessao.nome_agente;
                 
                 // Lógica de visibilidade na fila
                 if (!temDono) return true; 
                 if (temDono && sessao.nome_agente === agenteSolicitante) return true; 
                 return false; 
            });

        const m = chatsFiltrados.map(x => {
            const numeroReal = getNumeroReal(x);
            const sessao = sessionMap[numeroReal] || {};
            
            const deveAparecer = sessao.mostrar_na_fila === 1 || sessao.etapa === 'ATENDIMENTO_HUMANO';
            const nomeContato = x.pushName || x.pushname || x.name || (numeroReal.split('@')[0]);
            
            return { 
                numero: numeroReal, 
                nome: nomeContato,
                ultimaMensagem: x.conversation || "...", 
                unread: x.unreadCount > 0,
                visivel: deveAparecer, 
                etapa: sessao.etapa || 'INICIO', 
                nomeAgente: sessao.nome_agente || null 
            };
        }); 
        
        res.status(200).json({ success: true, data: m }); 

    } catch (e) { 
        console.error("Erro ao listar conversas:", e);
        res.status(200).json({ success: true, data: [] }); 
    } 
};

export const listarMensagensChat = async (req, res) => {
    const { numero, nomeSolicitante, limit } = req.body; 
    
    if (!numero) return res.status(400).json({ success: false, message: 'Número obrigatório' });
    
    try {
        const session = await whatsappModel.findOrCreateSession(numero, 'Cliente');
        
        // Verificação de segurança: Se o chat tiver dono, só ele pode ver (exceto Admin se tiver lógica pra isso)
        if (session.nome_agente && session.nome_agente !== nomeSolicitante) {
             return res.status(403).json({ success: false, message: "⛔ Permissão negada.", data: [] });
        }

        const qtdMensagens = limit || 50;

        // ==========================================================
        // [MUDANÇA] BUSCA DO BANCO DE DADOS AO INVÉS DA API EXTERNA
        // ==========================================================
        const mensagensDoBanco = await whatsappModel.buscarMensagens(numero, qtdMensagens);
        
        // Formatamos para o padrão que o seu Frontend já espera
        const formattedMessages = mensagensDoBanco.map(msg => {
            return {
                fromMe: !!msg.from_me, // Converte 0/1 para false/true
                text: msg.conteudo,
                time: new Date(msg.created_at).getTime(), // Timestamp em milissegundos
                name: msg.nome_autor || (msg.from_me ? "Eu" : "Cliente"),
                type: msg.tipo // Extra: caso queira usar ícones diferentes no front
            };
        });

        res.status(200).json({ success: true, data: formattedMessages });

    } catch (e) {
        console.error("Erro ao listar histórico do banco:", e);
        res.status(500).json({ success: false, data: [] });
    }
};

export const transferirAtendimento = async (req, res) => {
    const { numero, novoAgente, nomeAgenteAtual, nomeCliente } = req.body; 
    try {
        const oldAgent = nomeAgenteAtual || "Atendente";
        await whatsappModel.updateSession(numero, {
            nome_agente: novoAgente,
            etapa: 'ATENDIMENTO_HUMANO',
            bot_pausado: true,
            mostrar_na_fila: true
        });

        const msgTransferencia = `🔄 *Transferência*\n\nChamado repassado de *${oldAgent}* para *${novoAgente}*.`;
        await evolutionService.enviarTexto(numero, msgTransferencia);
        
        if(req.io) {
             req.io.emit('transferenciaChamado', { 
                chatId: numero, novoAgente, antigoAgente: oldAgent, nomeCliente, timestamp: new Date()
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
    const { chamado, numero } = req.body; 
    try {
        const reqId = parseInt(chamado.requisitante_id);
        if (isNaN(reqId) || reqId <= 0) return res.status(400).json({ success: false, message: 'ID Requisitante inválido.' });

        const limpaNumero = (n) => n ? n.replace('@s.whatsapp.net', '') : '';
        const telefoneFinal = chamado.telefone_requisitante_manual ? limpaNumero(chamado.telefone_requisitante_manual) : limpaNumero(numero);

        const dadosParaModel = {
            assunto: chamado.assunto,
            descricao: chamado.descricao,
            prioridade: chamado.prioridade || 'Média',
            status: 'Aberto',
            requisitanteIdNum: reqId, 
            categoriaUnificadaIdNum: chamado.categoria_id ? parseInt(chamado.categoria_id) : null,
            loja_id: chamado.loja ? parseInt(chamado.loja) : null,
            departamento_id: chamado.departamento ? parseInt(chamado.departamento) : null,
            nomeRequisitanteManual: chamado.nome_requisitante_manual || 'Cliente WhatsApp',
            telefoneRequisitanteManual: telefoneFinal, 
            emailRequisitanteManual: null
        };

        const novoId = await chamadoModel.create(dadosParaModel);
        const ticketCriado = await chamadoModel.findById(novoId);
        
        await evolutionService.enviarTexto(numero, `🎫 *Ticket Aberto: #${novoId}*\nAssunto: ${ticketCriado.assunto}\n\nAguarde nosso retorno.`);
        
        // Atualiza o ultimo ticket na sessão do DB
        await whatsappModel.updateSession(numero, { ultimo_ticket_id: novoId });

        if (ticketCriado.emailRequisitante) EmailService.enviarNotificacaoCriacao(ticketCriado.emailRequisitante, ticketCriado).catch(console.error);

        if (req.io) {
            req.io.emit('novoChamadoInterno', {
                id: novoId, assunto: ticketCriado.assunto, requisitante: ticketCriado.nomeRequisitante || "WhatsApp", prioridade: ticketCriado.prioridade
            });
        }
        res.status(201).json({ success: true, id: novoId });
    } catch (e) { 
        console.error("Erro criarChamadoDoChat:", e);
        res.status(500).json({ success: false, message: e.message }); 
    }
};
// ... (mantenha todo o código anterior)

// [NOVO] Lista todos os contatos salvos no banco (Nome e Telefone)
// Localize a função listarContatos no final do arquivo e substitua por esta:

export const listarContatos = async (req, res) => {
    try {
        // AGORA: Busca apenas quem realmente interagiu (tem mensagem recebida)
        const contatos = await whatsappModel.listarContatosReais();
        
        // Formata os dados para o frontend
        const dadosFormatados = contatos.map(c => ({
            numero: c.numero,
            nome: c.nome_contato || "Cliente",
            ultima_interacao: c.ultima_interacao
        }));

        res.status(200).json({ success: true, data: dadosFormatados });
    } catch (e) {
        console.error("Erro ao listar contatos reais:", e);
        res.status(500).json({ success: false, message: e.message });
    }
};

// [NOVO] Envia a mensagem pronta (Disparo Ativo)
export const enviarMensagemPronta = async (req, res) => {
    const { numero, nomeCliente, nomeAgente } = req.body;

    // 👇 EDITE AQUI A SUA MENSAGEM PRONTA
    const MENSAGEM_PADRAO = `Olá *${nomeCliente}*! 👋\n\nSou o *${nomeAgente}* do *Supermercado Rosalina*.\n Estou entrando em contato devido a uma demanda pendente.`;

    try {
        // 1. Envia via Evolution
        const r = await evolutionService.enviarTexto(numero, MENSAGEM_PADRAO);
        const msgId = r?.key?.id || 'ativo-'+Date.now();

        // 2. Salva no Banco de Dados (Para aparecer no histórico)
        await whatsappModel.salvarMensagem(
            numero, 
            MENSAGEM_PADRAO, 
            true, // fromMe (nós enviamos)
            msgId, 
            'text', 
            nomeAgente || 'Ativo'
        );

        // 3. Garante que a sessão existe e atualiza a data
        await whatsappModel.findOrCreateSession(numero, nomeCliente);
        
        // 4. Notifica o socket para a mensagem aparecer na tela na hora
        if(req.io) {
             req.io.emit('novaMensagemWhatsapp', { 
                id: msgId, 
                chatId: numero, 
                nome: "Eu", 
                texto: MENSAGEM_PADRAO, 
                fromMe: true,
                mostrarNaFila: true, 
                nomeAgente: nomeAgente
            });
        }
        res.status(200).json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: "Erro ao enviar." });
    }
};
export const handleDisconnect = async (req, res) => { try { await evolutionService.desconectarInstancia(); res.status(200).json({ success: true }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
export const connectInstance = async (req, res) => { try { const r = await evolutionService.criarInstancia(); res.status(200).json({ success: true, data: r }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
export const checarStatus = async (req, res) => { try { const r = await evolutionService.consultarStatus(); res.status(200).json({ success: true, data: r }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
export const configurarUrlWebhook = async (req, res) => { try { const h = req.get('host'); const p = h.includes('localhost') ? 'http' : 'https'; await evolutionService.configurarWebhook(`${p}://${h}/api/evolution/webhook`); res.status(200).json({ success: true }); } catch (e) { res.status(500).json({ success: false }); } };