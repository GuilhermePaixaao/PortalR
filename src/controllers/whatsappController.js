import * as evolutionService from '../services/evolutionService.js';
import * as chamadoModel from '../models/chamadoModel.js'; // <-- Importa o modelo de chamado
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
// Estrutura: { '5512...': { etapa: '...', botPausado: false, mostrarNaFila: false, ... } }
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
                // CORREÇÃO DO BUG: Impede que a saudação se repita se já estiver no menu
                if (ctx.etapa === 'MENU' && textoMin !== 'menu' && textoMin !== 'inicio') {
                    // Se for repetição de saudação na etapa MENU, força a resposta de OPÇÃO INVÁLIDA e retorna (evita IA).
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

            // ------------------------------------------------
            // 3. ETAPA: MENU -> SUBMENU T.I (COM ALERTA NO PAINEL) OU CONSULTA TICKET
            // ------------------------------------------------
            else if (ctx.etapa === 'MENU') {
                if (texto === '1' || textoMin.includes('suporte')) {
                    // Manda o Submenu
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
                // === LÓGICA DE CONSULTA DE TICKET ===
                else if (texto.startsWith('*') || textoMin === 'ticket') {
                    
                    let ticketNumeroStr = '';
                    
                    if (texto.startsWith('*')) {
                        // Se começou com *, tenta pegar o número que vem depois
                        ticketNumeroStr = texto.substring(1).trim();
                    } else if (textoMin === 'ticket') {
                        // Se o usuário digitou APENAS a palavra 'ticket'
                        // Pedir o número, mantendo na etapa MENU e pausando o bot.
                        respostaBot = "Por favor, digite o *número do ticket* após o asterisco. Exemplo: *123";
                        
                        // Pausa o bot temporariamente para o usuário digitar o número
                        ctx.etapa = 'MENU'; 
                        ctx.botPausado = true;
                        setTimeout(() => { ctx.botPausado = false; }, 30000); 

                        // Envia a resposta e sai do processamento
                        await evolutionService.enviarTexto(idRemoto, respostaBot);
                        io.emit('novaMensagemWhatsapp', { 
                            id: 'bot-'+Date.now(), chatId: idRemoto, nome: "Bot", texto: respostaBot, fromMe: true, mostrarNaFila: ctx.mostrarNaFila
                        });
                        return res.status(200).json({ success: true });
                    }
                    
                    // Se houver número (após o * ou se a lógica acima não se aplicou)
                    const ticketId = parseInt(ticketNumeroStr);
                    
                    if (isNaN(ticketId) || ticketId <= 0) {
                        // Se a string era "* " ou "*abc"
                        respostaBot = "⚠️ Por favor, digite um número de ticket válido após o asterisco. Exemplo: *123";
                    } else {
                        // Faz a consulta no banco de dados
                        const ticket = await chamadoModel.findById(ticketId); 
                        
                        if (ticket) {
                            // Encontrado: Formata a resposta com detalhes
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
                            // Não encontrado
                            respostaBot = `❌ O Ticket #${ticketId} não foi encontrado. Verifique o número digitado.`;
                        }
                    }
                } 
                // === FIM DA CORREÇÃO DE CONSULTA DE TICKET ===
                else {
                    // === ALTERAÇÃO AQUI: Removemos a IA e retornamos Opção Inválida ===
                    respostaBot = MENSAGENS.OPCAO_INVALIDA;
                }
            }

            // ------------------------------------------------
            // 4. ETAPA: SUBMENU T.I (DENTRO DA FILA)
            // ------------------------------------------------
            else if (ctx.etapa === 'SUBMENU_TI') {
                if (texto === '1') {
                    respostaBot = "📝 Certo. Por favor, *descreva o problema* resumidamente em uma mensagem para eu registrar.";
                    ctx.etapa = 'REGISTRAR_CHAMADO';
                }
                else if (texto === '2') {
                    // Agora sim pausa e avisa que vai chamar humano
                    respostaBot = MENSAGENS.FILA_TI;
                    ctx.etapa = 'FILA';
                    ctx.botPausado = true; 
                    ctx.mostrarNaFila = true; // Garante que está na fila
                }
                else if (texto === '3') {
                    respostaBot = MENSAGENS.SAUDACAO(nomeAutor);
                    ctx.etapa = 'MENU';
                    ctx.mostrarNaFila = false; // Saiu da fila
                }
                else {
                    // === ALTERAÇÃO AQUI: Removemos a IA e retornamos Opção Inválida ===
                    respostaBot = MENSAGENS.OPCAO_INVALIDA;
                }
            }

            // 5. FILA (Mudo)
            else if (ctx.etapa === 'FILA') { /* Silêncio */ }

            // 6. AVALIAÇÃO
            else if (ctx.etapa === 'AVALIACAO_NOTA') {
                if (['1', '2', '3', '4', '5'].includes(texto)) {
                    respostaBot = MENSAGENS.AVALIACAO_MOTIVO;
                    ctx.etapa = 'AVALIACAO_MOTIVO';
                } else if (texto === '9') {
                    respostaBot = MENSAGENS.ENCERRAMENTO_FINAL;
                    ctx.mostrarNaFila = false; // Remove da fila
                    delete userContext[idRemoto];
                } else {
                    respostaBot = MENSAGENS.OPCAO_INVALIDA;
                }
            }
            else if (ctx.etapa === 'AVALIACAO_MOTIVO') {
                respostaBot = MENSAGENS.ENCERRAMENTO_FINAL;
                ctx.mostrarNaFila = false; // Remove da fila
                delete userContext[idRemoto]; 
            }

            // FALLBACK IA (Início - Mantemos IA apenas se o usuário nunca entrou no menu)
            else if (!respostaBot && !ctx.botPausado && ctx.etapa === 'INICIO') {
                respostaBot = await processarComGroq(idRemoto, texto, nomeAutor);
            }

            // ENVIO
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

// Rota chamada quando clica em "ASSUMIR ATENDIMENTO"
export const atenderAtendimento = async (req, res) => {
    const { numero, nomeAgente } = req.body;
    try {
        if (!userContext[numero]) userContext[numero] = { historico: [] };
        
        // Pausa o bot e salva o nome do agente
        userContext[numero].nomeAgente = nomeAgente;
        userContext[numero].botPausado = true; 
        userContext[numero].etapa = 'ATENDIMENTO_HUMANO';
        userContext[numero].mostrarNaFila = true; // Continua na fila pois é um atendimento ativo

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
        userContext[numero].mostrarNaFila = false; // <--- AGORA SAI DA LISTA DO AGENTE

        const msg = MENSAGENS.AVALIACAO_INICIO;
        await evolutionService.enviarTexto(numero, msg);
        res.status(200).json({ success: true });
    } catch (error) { res.status(500).json({ success: false }); }
};

// Rota chamada quando você envia mensagem pelo input do portal
export const handleSendMessage = async (req, res) => {
  const { numero, mensagem, nomeAgenteTemporario } = req.body;
  try {
      let mensagemFinal = mensagem;
      const contexto = userContext[numero];
      
      // Se o agente enviou mensagem, garante que aparece na fila
      if(contexto) contexto.mostrarNaFila = true;
      else if (!contexto) {
          // Cria contexto básico se agente iniciou conversa
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

// ==================================================
// 6. ROTA DE LISTAGEM COM FILTRO
// ==================================================
export const listarConversas = async (req, res) => { 
    try { 
        const c = await evolutionService.buscarConversas(); 
        
        // Mapeia e adiciona a flag 'visivel' baseada no estado do Bot
        const m = c.map(x => {
            const ctx = userContext[x.id] || {};
            
            // Lógica de Exibição:
            // Mostra se: 
            // 1. Está marcado explicitamente como 'mostrarNaFila' (Digitou 1)
            // 2. OU Está em atendimento humano
            const deveAparecer = ctx.mostrarNaFila === true || ctx.etapa === 'ATENDIMENTO_HUMANO';

            return { 
                numero: x.id, 
                nome: x.pushName || x.id.split('@')[0], 
                ultimaMensagem: x.conversation || "...", 
                unread: x.unreadCount > 0,
                visivel: deveAparecer, // <--- Frontend usa isso para filtrar
                // === CORREÇÃO: Enviando dados de estado para o front ===
                etapa: ctx.etapa || 'INICIO', // Envia a etapa atual
                nomeAgente: ctx.nomeAgente || null // Envia se tem agente
            };
        }); 
        
        res.status(200).json({ success: true, data: m }); 
    } catch (e) { res.status(200).json({ success: true, data: [] }); } 
};

// Dentro de src/controllers/whatsappController.js
export const handleDisconnect = async (req, res) => {
    try {
        // Supondo que o evolutionService tenha a função correta
        await evolutionService.desconectarInstancia(); 
        res.status(200).json({ success: true, message: 'Instância desconectada.' });
    } catch (e) { 
        // A Evolution API geralmente usa a rota /instance/disconnect/{instanceName}
        res.status(500).json({ success: false, message: e.message }); 
    }
};
export const connectInstance = async (req, res) => { try { const r = await evolutionService.criarInstancia(); res.status(200).json({ success: true, data: r }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
export const checarStatus = async (req, res) => { try { const r = await evolutionService.consultarStatus(); res.status(200).json({ success: true, data: r }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
export const configurarUrlWebhook = async (req, res) => { try { const h = req.get('host'); const p = h.includes('localhost') ? 'http' : 'https'; await evolutionService.configurarWebhook(`${p}://${h}/api/evolution/webhook`); res.status(200).json({ success: true }); } catch (e) { res.status(500).json({ success: false }); } };