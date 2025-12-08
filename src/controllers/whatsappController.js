import { OpenAI } from 'openai';
import pool from '../config/database.js'; // Importa conexão MySQL
import * as evolutionService from '../services/evolutionService.js';
import * as chamadoModel from '../models/chamadoModel.js'; 
import * as EmailService from '../services/emailService.js'; 

// ==================================================
// CONFIGURAÇÕES
// ==================================================
const groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY, 
    baseURL: "https://api.groq.com/openai/v1"
});

const MODELO_IA = "llama-3.1-8b-instant"; 
const processedMessageIds = new Set();

// ==================================================
// GERENCIAMENTO DE SESSÃO (VIA MYSQL)
// ==================================================
async function getSession(numero) {
    try {
        const [rows] = await pool.query('SELECT * FROM whatsapp_sessions WHERE numero = ?', [numero]);
        if (rows.length > 0) {
            const s = rows[0];
            return {
                numero: s.numero,
                nome: s.nome,
                etapa: s.etapa,
                nomeAgente: s.nome_agente,
                mostrarNaFila: !!s.mostrar_na_fila,
                botPausado: !!s.bot_pausado,
                ultimaMensagem: s.ultima_mensagem,
                unreadCount: s.unread_count,
                historico: s.historico_json ? JSON.parse(s.historico_json) : []
            };
        }
        return null; 
    } catch (e) {
        console.error("Erro ao buscar sessão no DB:", e);
        return null;
    }
}

async function saveSession(data) {
    try {
        const historicoStr = JSON.stringify(data.historico || []);
        const mostrar = data.mostrarNaFila ? 1 : 0;
        const pausado = data.botPausado ? 1 : 0;

        await pool.query(`
            INSERT INTO whatsapp_sessions 
            (numero, nome, etapa, nome_agente, mostrar_na_fila, bot_pausado, ultima_mensagem, unread_count, historico_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            nome=?, etapa=?, nome_agente=?, mostrar_na_fila=?, bot_pausado=?, ultima_mensagem=?, unread_count=?, historico_json=?
        `, [
            data.numero, data.nome, data.etapa, data.nomeAgente, mostrar, pausado, data.ultimaMensagem, data.unreadCount, historicoStr,
            data.nome, data.etapa, data.nomeAgente, mostrar, pausado, data.ultimaMensagem, data.unreadCount, historicoStr
        ]);
    } catch (e) {
        console.error("Erro ao salvar sessão no DB:", e);
    }
}

// ==================================================
// LÓGICA E TEXTOS DO BOT
// ==================================================
const gerarPromptSistema = (nome) => `Seja o Assistente do Suporte Rosalina para ${nome || 'Cliente'}. Colete dados do problema.`;
const calcularPosicaoFila = async () => {
    try {
        const [rows] = await pool.query("SELECT COUNT(*) as total FROM whatsapp_sessions WHERE etapa = 'FILA_ESPERA'");
        return rows[0].total;
    } catch (e) { return 0; }
};

const MENSAGENS = {
    SAUDACAO: (n) => `👋 Olá *${n}*. Bem-vindo ao Suporte Técnico do *Supermercado Rosalina*.\n\n1️⃣ **Reportar Problema** (Falar com T.I.)\n*️⃣ **Consultar Ticket**\n\n_Para encerrar a qualquer momento, digite #._`,
    MENU_TI: `✅ *Solicitação Iniciada*\n\nVocê entrou na fila. Por favor, descreva seu problema abaixo.`,
    FILA: (p) => `✅ *Fila de Suporte T.I.*\n\n📌 Sua posição: ${p}º.\nAguarde, um técnico irá te atender.`,
    INVALIDO: `⚠️ Opção inválida.`,
    AVALIACAO: `⏹️ *Atendimento Finalizado.*\n\nAvalie (1-5) ou digite 9 para sair.`,
    FIM: `✅ *Chamado Encerrado.*\nObrigado.`
};

// ==================================================
// WEBHOOK
// ==================================================
export const handleWebhook = async (req, res) => {
  const { event, data } = req.body;
  const io = req.io;

  try {
    if (event === 'qrcode.updated') io.emit('qrCodeRecebido', { qr: data?.qrcode?.base64 });
    if (event === 'connection.update') io.emit('statusConexao', { status: data.state });

    if (event === 'messages.upsert' && data?.message) {
      const msg = data;
      const id = msg.key.id; 
      const remoteJid = msg.key.remoteJid;
      const fromMe = msg.key.fromMe;
      
      if (processedMessageIds.has(id)) return res.json({ success: true });
      processedMessageIds.add(id);
      setTimeout(() => processedMessageIds.delete(id), 10000);

      const nome = msg.pushName || remoteJid.split('@')[0];
      const texto = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || "").trim();
      
      // Ignora grupos e status broadcast
      if (!remoteJid.includes('@g.us') && remoteJid !== 'status@broadcast' && texto) {
        
        // 1. Recupera ou cria sessão do banco
        let session = await getSession(remoteJid);
        
        if (!session) {
            session = { 
                numero: remoteJid, nome, etapa: 'INICIO', nomeAgente: null, 
                mostrarNaFila: false, botPausado: false, historico: [], 
                ultimaMensagem: texto, unreadCount: 0 
            };
        } else {
            session.ultimaMensagem = texto;
            session.nome = nome; // Atualiza nome caso tenha mudado
            if (!fromMe) session.unreadCount += 1;
        }

        // Emite para o frontend em tempo real
        io.emit('novaMensagemWhatsapp', { 
            id, chatId: remoteJid, nome, texto, fromMe,
            mostrarNaFila: session.mostrarNaFila,
            nomeAgente: session.nomeAgente 
        });

        if (!fromMe) {
            let resp = null;
            const txt = texto.toLowerCase();

            // Comandos Globais
            if (['#','sair','encerrar'].includes(txt)) {
                resp = MENSAGENS.AVALIACAO;
                session.etapa = 'AVALIACAO_NOTA';
                session.botPausado = true;
                session.nomeAgente = null;
            }
            // Início / Saudação
            else if (['oi','ola','menu','inicio','ajuda'].some(x => txt.startsWith(x))) {
                session.etapa = 'MENU';
                session.botPausado = false;
                session.nomeAgente = null;
                session.mostrarNaFila = false;
                session.historico = [{role:"system", content:gerarPromptSistema(nome)}];
                resp = MENSAGENS.SAUDACAO(nome);
            }
            // Menu Principal
            else if (session.etapa === 'MENU') {
                if (txt.includes('1') || txt.includes('problema') || txt.includes('suporte')) {
                    resp = MENSAGENS.MENU_TI;
                    session.etapa = 'AGUARDANDO_DESCRICAO';
                } 
                else if (txt.includes('*') || txt.includes('ticket')) {
                    resp = "ℹ️ Digite o número do ticket com asterisco (ex: *123).";
                } else {
                    resp = MENSAGENS.INVALIDO;
                }
            }
            // Entrando na Fila
            else if (session.etapa === 'AGUARDANDO_DESCRICAO') {
                session.mostrarNaFila = true; // SINALIZA PARA APARECER NO FRONT
                io.emit('notificacaoChamado', { chatId: remoteJid, nome, status: 'PENDENTE' });
                
                const posicao = await calcularPosicaoFila() + 1;
                resp = MENSAGENS.FILA(posicao);
                
                session.etapa = 'FILA_ESPERA';
                session.botPausado = true;
            }
            // Avaliação
            else if (session.etapa === 'AVALIACAO_NOTA' || session.etapa === 'AVALIACAO_MOTIVO') {
                resp = MENSAGENS.FIM;
                session.etapa = 'FINALIZADO';
                session.mostrarNaFila = false;
                session.botPausado = false;
            }
            // Fallback
            else if (!resp && !session.botPausado && session.etapa === 'INICIO') {
                session.etapa = 'MENU';
                resp = MENSAGENS.SAUDACAO(nome);
            }

            // Salva sessão atualizada no banco
            await saveSession(session);

            if (resp) {
                await evolutionService.enviarTexto(remoteJid, resp);
                io.emit('novaMensagemWhatsapp', { 
                    id: 'bot-'+Date.now(), chatId: remoteJid, nome: "Bot", texto: resp, fromMe: true 
                });
            }
        } else {
            // Se foi mensagem enviada pelo agente (via celular), só salva
            await saveSession(session);
        }
      }
    }
    res.json({ success: true });
  } catch (e) { console.error("Erro Webhook:", e); res.status(500).json({ success: false }); }
};

// ==================================================
// API: LISTAR CONVERSAS (FILTRO CORRETO VIA DB)
// ==================================================
export const listarConversas = async (req, res) => { 
    try { 
        const agente = req.query.agente;
        const mode = req.query.mode;
        
        let query = "SELECT * FROM whatsapp_sessions";
        let params = [];

        // Filtra a lista
        if (mode === 'history') {
            // Histórico: Pega tudo que NÃO seja apenas um "Oi" (INICIO) ou "Menu"
            query += " WHERE etapa NOT IN ('INICIO', 'MENU')";
        } else {
            // Fila de Atendimento (Sidebar):
            // - Deve estar marcado como mostrar_na_fila
            // - OU estar em ATENDIMENTO_HUMANO (livre ou com o agente atual)
            query += " WHERE mostrar_na_fila = 1 OR (etapa = 'ATENDIMENTO_HUMANO' AND (nome_agente IS NULL OR nome_agente = ?))";
            params.push(agente);
        }

        query += " ORDER BY updated_at DESC";

        const [rows] = await pool.query(query, params);

        // Mapeia para o formato esperado pelo front
        const chats = rows.map(r => ({
            numero: r.numero,
            nome: r.nome || r.numero,
            ultimaMensagem: r.ultima_mensagem,
            unreadCount: r.unread_count,
            visivel: true,
            etapa: r.etapa,
            nomeAgente: r.nome_agente,
            pending: (r.mostrar_na_fila === 1 && !r.nome_agente) // Ícone amarelo se na fila e sem agente
        }));

        res.json({ success: true, data: chats });
    } catch (e) { 
        console.error("Erro listarConversas:", e); 
        res.json({ success: true, data: [] }); 
    } 
};

// ==================================================
// API: LISTAR MENSAGENS (COM RESET DE UNREAD)
// ==================================================
export const listarMensagensChat = async (req, res) => {
    const { numero, limit } = req.body;
    if (!numero) return res.status(400).json({ success: false });

    try {
        // Zera contador de não lidas no banco ao abrir
        await pool.query("UPDATE whatsapp_sessions SET unread_count = 0 WHERE numero = ?", [numero]);

        // Busca histórico na API Evolution
        const qtd = limit || 50;
        let raw = await evolutionService.buscarMensagensHistorico(numero, qtd);

        let msgsArray = [];
        if (Array.isArray(raw)) msgsArray = raw;
        else if (raw && Array.isArray(raw.messages)) msgsArray = raw.messages;
        else if (raw && Array.isArray(raw.data)) msgsArray = raw.data;

        const formatadas = msgsArray
            .filter(m => m.message) 
            .map(m => {
                const txt = m.message.conversation || m.message.extendedTextMessage?.text || 
                           (m.message.imageMessage ? "📷 Imagem" : null) || 
                           (m.message.audioMessage ? "🎤 Áudio" : null) || "Conteúdo";
                const ts = m.messageTimestamp ? (typeof m.messageTimestamp==='number'?m.messageTimestamp*1000:m.messageTimestamp) : Date.now();
                return {
                    fromMe: m.key.fromMe,
                    text: txt,
                    time: ts,
                    name: m.pushName || (m.key.fromMe ? "Eu" : "Cliente")
                };
            });
            
        formatadas.sort((a,b) => new Date(a.time) - new Date(b.time));
        res.json({ success: true, data: formatadas });
    } catch (e) {
        console.error("Erro listarMensagens:", e);
        res.status(500).json({ success: false, data: [] });
    }
};

// ==================================================
// AÇÕES DO AGENTE
// ==================================================

export const atenderAtendimento = async (req, res) => {
    const { numero, nomeAgente } = req.body;
    try {
        const session = await getSession(numero);
        if (session && session.nomeAgente && session.nomeAgente !== nomeAgente) {
            return res.status(409).json({success:false, message:"Já em atendimento."});
        }
        
        await pool.query(`
            UPDATE whatsapp_sessions SET nome_agente = ?, etapa = 'ATENDIMENTO_HUMANO', bot_pausado = 1, mostrar_na_fila = 1 
            WHERE numero = ?
        `, [nomeAgente, numero]);

        await evolutionService.enviarTexto(numero, `👨‍💻 *${nomeAgente}* assumiu o atendimento.`);
        req.io.emit('atendimentoAssumido', { chatId: numero, nomeAgente });
        res.json({ success: true });
    } catch (e) { res.status(500).json({success:false}); }
};

export const finalizarAtendimento = async (req, res) => {
    const { numero } = req.body;
    try {
        await pool.query(`
            UPDATE whatsapp_sessions SET etapa = 'FINALIZADO', mostrar_na_fila = 0, nome_agente = NULL, bot_pausado = 0 
            WHERE numero = ?
        `, [numero]);

        await evolutionService.enviarTexto(numero, MENSAGENS.AVALIACAO);
        res.json({ success: true });
    } catch (e) { res.status(500).json({success:false}); }
};

export const handleSendMessage = async (req, res) => {
    const { numero, mensagem, nomeAgenteTemporario } = req.body;
    try {
        const session = await getSession(numero);
        if (session && session.nomeAgente && session.nomeAgente !== nomeAgenteTemporario) {
            return res.status(403).json({success:false, message:"Chat de outro agente"});
        }
        
        // Reabre sessão se necessário
        await pool.query(`
            INSERT INTO whatsapp_sessions (numero, etapa, nome_agente, mostrar_na_fila, bot_pausado, ultima_mensagem)
            VALUES (?, 'ATENDIMENTO_HUMANO', ?, 1, 1, ?)
            ON DUPLICATE KEY UPDATE etapa='ATENDIMENTO_HUMANO', mostrar_na_fila=1, bot_pausado=1, nome_agente=?, ultima_mensagem=?
        `, [numero, nomeAgenteTemporario, mensagem, nomeAgenteTemporario, mensagem]);

        const txtFinal = nomeAgenteTemporario ? `*${nomeAgenteTemporario}*\n${mensagem}` : mensagem;
        const r = await evolutionService.enviarTexto(numero, txtFinal);
        res.json({ success: true, data: r });
    } catch (e) { res.status(500).json({success:false}); }
};

export const transferirAtendimento = async (req, res) => {
    const { numero, novoAgente, nomeAgenteAtual } = req.body;
    try {
        await pool.query("UPDATE whatsapp_sessions SET nome_agente = ? WHERE numero = ?", [novoAgente, numero]);
        await evolutionService.enviarTexto(numero, `🔄 Transferido para *${novoAgente}*.`);
        req.io.emit('transferenciaChamado', { chatId: numero, novoAgente, antigoAgente: nomeAgenteAtual });
        res.json({ success: true });
    } catch(e) { res.status(500).json({success:false}); }
};

export const verificarTicket = async (req, res) => {
    const { id } = req.body;
    try {
        const ticket = await chamadoModel.findById(id);
        res.json(ticket ? {success:true, data:ticket} : {success:false});
    } catch(e){ res.status(500).json({success:false}); }
};

export const criarChamadoDoChat = async (req, res) => {
    const { chamado, numero } = req.body; 
    try {
        const reqId = parseInt(chamado.requisitante_id);
        const novoId = await chamadoModel.create({
            assunto: chamado.assunto, descricao: chamado.descricao, prioridade: chamado.prioridade,
            status: 'Aberto', requisitanteIdNum: reqId, categoriaUnificadaIdNum: parseInt(chamado.categoria_id)
        });
        await evolutionService.enviarTexto(numero, `🎫 Ticket #${novoId} criado.`);
        res.json({success:true, id:novoId});
    } catch(e){ res.status(500).json({success:false, message:e.message}); }
};

export const handleDisconnect = async (req,res) => { try{await evolutionService.desconectarInstancia();res.json({success:true});}catch(e){res.status(500).json({success:false});} };
export const connectInstance = async (req,res) => { try{const r=await evolutionService.criarInstancia();res.json({success:true,data:r});}catch(e){res.status(500).json({success:false});} };
export const checarStatus = async (req,res) => { try{const r=await evolutionService.consultarStatus();res.json({success:true,data:r});}catch(e){res.status(500).json({success:false});} };
export const configurarUrlWebhook = async (req,res) => { try{const h=req.get('host');const p=h.includes('localhost')?'http':'https';await evolutionService.configurarWebhook(`${p}://${h}/api/evolution/webhook`);res.json({success:true});}catch(e){res.status(500).json({success:false});} };