import * as evolutionService from '../services/evolutionService.js';

// ==================================================
// 1. MEMÓRIA (ESTADO DO CLIENTE)
// ==================================================
const userContext = {};

// ==================================================
// 2. TEXTOS DO MENU
// ==================================================
const MENSAGENS = {
    SAUDACAO: (nome) => `Olá ${nome || 'Cliente'}, bem-vindo ao suporte interno do Supermercado Rosalina. Em breve, um de nossos atendentes vai te ajudar.

Escolha uma fila de atendimento:
1️⃣ - Suporte T.I
*️⃣ - Consultar um ticket
#️⃣ - Finalizar`,

    OPCAO_INVALIDA: "⚠️ Opção inválida! Digite 1, * ou #.",

    FILA_TI: `✅ Opção selecionada: Suporte T.I
Você entrou na fila e logo será atendido.
Em caso de urgência, ligue: (12) 99999-9999.`,

    AVALIACAO_INICIO: `Obrigado! Avalie nosso atendimento:
1.😔 Péssimo
2.🙁 Ruim
3.😐 Regular
4.😀 Bom
5.🤩 Excelente
9.❌ Sair`,

    AVALIACAO_MOTIVO: `Obrigado! Se quiser, descreva o motivo ou digite 9 para encerrar.`,
    ENCERRAMENTO: `Atendimento encerrado. Obrigado!`
};

// ==================================================
// 3. LÓGICA DO ROBÔ
// ==================================================
async function processarMensagemFixa(textoUsuario, idRemoto, nomeUsuario) {
    const texto = textoUsuario ? textoUsuario.trim() : "";
    let contexto = userContext[idRemoto] || { etapa: 'INICIO' };
    let resposta = null;

    console.log(`[BOT] ${idRemoto} | Etapa: ${contexto.etapa} | Msg: "${texto}"`);

    if (['oi', 'ola', 'olá', 'menu', 'inicio'].includes(texto.toLowerCase())) {
        resposta = MENSAGENS.SAUDACAO(nomeUsuario);
        contexto.etapa = 'MENU';
    }
    else if (contexto.etapa === 'MENU' || contexto.etapa === 'INICIO') {
        if (texto === '1') {
            resposta = MENSAGENS.FILA_TI;
            contexto.etapa = 'FILA'; 
        } else if (texto === '#') {
            resposta = MENSAGENS.AVALIACAO_INICIO;
            contexto.etapa = 'AVALIACAO_NOTA';
        } else if (texto.startsWith('*')) {
            resposta = `🔍 Buscando ticket ${texto}...`;
        } else {
            resposta = MENSAGENS.OPCAO_INVALIDA + "\n\n" + MENSAGENS.SAUDACAO(nomeUsuario);
        }
    }
    else if (contexto.etapa === 'FILA') {
        if (texto === '#') {
            resposta = MENSAGENS.AVALIACAO_INICIO;
            contexto.etapa = 'AVALIACAO_NOTA';
        } else {
            return null; 
        }
    }
    else if (contexto.etapa === 'AVALIACAO_NOTA') {
        if (['1', '2', '3', '4', '5'].includes(texto)) {
            resposta = MENSAGENS.AVALIACAO_MOTIVO;
            contexto.etapa = 'AVALIACAO_MOTIVO';
            contexto.nota = texto;
        } else if (texto === '9') {
            resposta = MENSAGENS.ENCERRAMENTO;
            delete userContext[idRemoto];
            return resposta;
        } else {
            resposta = "⚠️ Digite de 1 a 5.";
        }
    }
    else if (contexto.etapa === 'AVALIACAO_MOTIVO') {
        resposta = MENSAGENS.ENCERRAMENTO;
        delete userContext[idRemoto];
    }

    if (resposta) userContext[idRemoto] = contexto;
    return resposta;
}

// ==================================================
// 4. WEBHOOK (MENSAGENS INSTANTÂNEAS)
// ==================================================
export const handleWebhook = async (req, res) => {
  const payload = req.body;
  const io = req.io;

  try {
    if (payload.event === 'qrcode.updated') io.emit('qrCodeRecebido', { qr: payload.data?.qrcode?.base64 });
    if (payload.event === 'connection.update') io.emit('statusConexao', { status: payload.data?.status });

    if (payload.event === 'messages.upsert' && payload.data?.message) {
      const msg = payload.data;
      const idRemoto = msg.key.remoteJid;
      const isFromMe = msg.key.fromMe;
      const nomeAutor = msg.pushName || idRemoto;
      const texto = msg.message?.conversation || msg.message?.extendedTextMessage?.text;

      if (idRemoto !== 'status@broadcast' && !isFromMe && texto) {
        
        // 1. Envia para a tela IMEDIATAMENTE
        io.emit('novaMensagemWhatsapp', {
            chatId: idRemoto,
            nome: nomeAutor,
            texto: texto,
            fromMe: false
        });

        // 2. Robô responde
        const respostaBot = await processarMensagemFixa(texto, idRemoto, nomeAutor);
        if (respostaBot) {
            await evolutionService.enviarTexto(idRemoto, respostaBot);
            io.emit('novaMensagemWhatsapp', {
                chatId: idRemoto,
                nome: "Auto-Atendimento",
                texto: respostaBot,
                fromMe: true 
            });
        }
      }
    }
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Erro no webhook:', error);
    res.status(500).json({ success: false });
  }
};

// ==================================================
// 5. LISTAR MENSAGENS (HISTÓRICO) - FALTAVA ISSO!
// ==================================================
export const listarMensagens = async (req, res) => {
  const { numero } = req.params;
  try {
    const mensagensBrutas = await evolutionService.buscarMensagens(numero);
    const formatadas = mensagensBrutas.map(m => ({
        fromMe: m.key.fromMe,
        text: m.message?.conversation || m.message?.extendedTextMessage?.text || "Mídia/Outros",
        time: m.messageTimestamp ? new Date(m.messageTimestamp * 1000) : new Date(),
        name: m.pushName
    })).reverse(); // Inverte para mostrar na ordem certa
    
    res.status(200).json({ success: true, data: formatadas });
  } catch (error) {
    console.error("Erro ao buscar histórico:", error);
    res.status(500).json({ success: false, data: [] });
  }
};

// --- OUTRAS FUNÇÕES ---
export const connectInstance = async (req, res) => { try { const r = await evolutionService.criarInstancia(); res.status(200).json({ success: true, data: r }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
export const handleSendMessage = async (req, res) => { try { const r = await evolutionService.enviarTexto(req.body.numero, req.body.mensagem); res.status(200).json({ success: true, data: r }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
export const checarStatus = async (req, res) => { try { const r = await evolutionService.consultarStatus(); res.status(200).json({ success: true, data: r }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
export const listarConversas = async (req, res) => { try { const c = await evolutionService.buscarConversas(); const f = c.map(x => ({ numero: x.id, nome: x.pushName || x.name || x.id.split('@')[0], ultimaMensagem: x.conversation || "...", unread: x.unreadCount > 0 })); res.status(200).json({ success: true, data: f }); } catch (e) { res.status(200).json({ success: true, data: [] }); } };
export const configurarUrlWebhook = async (req, res) => { try { const host = req.get('host'); const url = `https://${host}/api/evolution/webhook`; await evolutionService.configurarWebhook(url); res.status(200).json({ success: true, message: `Webhook: ${url}` }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };