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

const SISTEMA_PROMPT = `
Você é o assistente de triagem do Supermercado Rosalina.
Responda de forma breve e direta sobre dúvidas de T.I.
Se não souber, peça para digitar #.
`;

const userContext = {};

// ==================================================
// 2. TEXTOS FIXOS
// ==================================================
const MENSAGENS = {
    FILA_TI: `Certo! Você entrou na fila de atendimento do Suporte T.I. Aguarde um momento.`,
    OPCAO_INVALIDA: `Opção inválida. Clique em um dos botões ou digite "Oi" para reiniciar.`,
    ENCERRAMENTO: `Atendimento encerrado. Se precisar, mande um "Oi".`
};

// ==================================================
// 3. IA (GROQ)
// ==================================================
async function processarComGroq(numero, texto) {
    const ctx = userContext[numero];
    if (!ctx || ctx.botPausado) return null;

    try {
        if (!ctx.historico) ctx.historico = [{ role: "system", content: SISTEMA_PROMPT }];
        ctx.historico.push({ role: "user", content: texto });

        const completion = await groq.chat.completions.create({
            messages: ctx.historico,
            model: MODELO_IA,
            temperature: 0.3, max_tokens: 150,
        });

        const resposta = completion.choices[0]?.message?.content || "";
        if (resposta) ctx.historico.push({ role: "assistant", content: resposta });
        return resposta;
    } catch (e) {
        console.error("Erro Groq:", e);
        return null;
    }
}

// ==================================================
// 4. WEBHOOK (CORRIGIDO)
// ==================================================
export const handleWebhook = async (req, res) => {
  const payload = req.body;
  const io = req.io;

  try {
    // Eventos de Conexão e QR Code
    if (payload.event === 'qrcode.updated') io.emit('qrCodeRecebido', { qr: payload.data?.qrcode?.base64 });
    if (payload.event === 'connection.update') io.emit('statusConexao', { status: payload.data.state });

    // Evento de Mensagem (Recebida ou Enviada)
    if (payload.event === 'messages.upsert' && payload.data?.message) {
      const msg = payload.data;
      const idRemoto = msg.key.remoteJid;
      const isFromMe = msg.key.fromMe;
      const nomeAutor = msg.pushName || idRemoto.split('@')[0];

      // --- DETECÇÃO DE CONTEÚDO ---
      // Tenta pegar texto simples, resposta de botão ou resposta de lista
      const texto = (
          msg.message?.conversation || 
          msg.message?.extendedTextMessage?.text || 
          msg.message?.buttonsResponseMessage?.selectedButtonId || 
          msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
          ""
      ).trim();

      // Verifica se a mensagem é do tipo "botão enviado pelo bot" para renderizar no front
      const buttonsSent = msg.message?.buttonsMessage?.buttons || [];
      
      const isGroup = idRemoto.includes('@g.us'); 
      const isStatus = idRemoto === 'status@broadcast'; 

      if (!isStatus && !isGroup) {
        
        // --- ENVIA PARA O FRONT-END (CHAT EM TEMPO REAL) ---
        io.emit('novaMensagemWhatsapp', { 
            chatId: idRemoto, 
            nome: nomeAutor, 
            texto: texto, 
            fromMe: isFromMe,
            // Envia os botões para o front desenhar, se houver
            buttons: buttonsSent.length > 0 ? buttonsSent : null 
        });

        // Lógica do Robô (Só responde se a mensagem NÃO for dele mesmo)
        if (!isFromMe && texto) {
            
            if (!userContext[idRemoto]) userContext[idRemoto] = { etapa: 'INICIO', botPausado: false };
            const ctx = userContext[idRemoto];
            let respostaBot = null;
            const textoMin = texto.toLowerCase();

            // SAUDAÇÕES
            const saudacoes = ['oi', 'ola', 'olá', 'menu', 'bom dia', 'boa tarde', 'ajuda'];
            const ehSaudacao = saudacoes.some(s => textoMin.startsWith(s));

            // --- MENU PRINCIPAL (ENVIA BOTÕES) ---
            if (ehSaudacao) {
                await evolutionService.enviarBotoes(
                    idRemoto, 
                    `Olá ${nomeAutor}!`, 
                    "Como posso te ajudar hoje?",
                    [
                        { id: '1', texto: 'Suporte T.I.' },
                        { id: '2', texto: 'Consultar Ticket' },
                        { id: '3', texto: 'Falar com Humano' }
                    ]
                );
                ctx.etapa = 'MENU';
                ctx.botPausado = false;
                // REMOVIDO O io.emit MANUAL DAQUI PARA EVITAR DUPLICIDADE
            }
            
            // --- TRATAMENTO DE RESPOSTAS ---
            else if (ctx.etapa === 'MENU') {
                if (texto === '1') {
                    respostaBot = MENSAGENS.FILA_TI;
                    ctx.etapa = 'FILA';
                    ctx.botPausado = true;
                } else if (texto === '2') {
                    respostaBot = "Digite o número do ticket (Ex: *123):";
                } else if (texto === '3') {
                    respostaBot = "Transferindo para um atendente...";
                    ctx.botPausado = true;
                } else {
                    // Tenta IA se não for opção válida
                    respostaBot = await processarComGroq(idRemoto, texto);
                    if (!respostaBot) respostaBot = MENSAGENS.OPCAO_INVALIDA;
                }
            }
            
            // --- IA PADRÃO ---
            else if (!ctx.botPausado && ctx.etapa === 'INICIO') {
                respostaBot = await processarComGroq(idRemoto, texto);
            }

            // Envia resposta de texto se houver
            if (respostaBot) {
                await evolutionService.enviarTexto(idRemoto, respostaBot);
            }
        }
      }
    }
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Erro Webhook:', error);
    res.status(500).json({ success: false });
  }
};

// ... (O restante das funções exportadas abaixo permanece igual ao arquivo original)
// (notificarAtribuicao, notificarFinalizacao, connectInstance, etc.)
// Certifique-se de manter essas funções no final do arquivo.
export const notificarAtribuicao = async (numero, nomeAgente) => {
    if(!userContext[numero]) userContext[numero] = { historico: [] };
    userContext[numero].botPausado = true; 
    const msg = `Atendimento assumido por ${nomeAgente}.`;
    await evolutionService.enviarTexto(numero, msg);
    return msg;
};
export const notificarFinalizacao = async (numero) => {
    if(!userContext[numero]) userContext[numero] = {};
    userContext[numero].etapa = 'INICIO';
    userContext[numero].botPausado = true;
    const msg = "Atendimento finalizado.";
    await evolutionService.enviarTexto(numero, msg);
    return msg;
};
export const connectInstance = async (req, res) => { try { const r = await evolutionService.criarInstancia(); res.status(200).json({ success: true, data: r }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
export const handleSendMessage = async (req, res) => { const { numero, mensagem } = req.body; try { const r = await evolutionService.enviarTexto(numero, mensagem); res.status(200).json({ success: true, data: r }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
export const checarStatus = async (req, res) => { try { const r = await evolutionService.consultarStatus(); res.status(200).json({ success: true, data: r }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
export const listarConversas = async (req, res) => { try { const c = await evolutionService.buscarConversas(); const m = c.map(x => ({ numero: x.id, nome: x.pushName || x.id.split('@')[0], ultimaMensagem: x.conversation || "...", unread: x.unreadCount > 0 })); res.status(200).json({ success: true, data: m }); } catch (e) { res.status(200).json({ success: true, data: [] }); } };
export const configurarUrlWebhook = async (req, res) => { try { const h = req.get('host'); const p = h.includes('localhost') ? 'http' : 'https'; await evolutionService.configurarWebhook(`${p}://${h}/api/evolution/webhook`); res.status(200).json({ success: true }); } catch (e) { res.status(500).json({ success: false }); } };