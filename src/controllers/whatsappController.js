import * as evolutionService from '../services/evolutionService.js';

// ==================================================
// 1. CONTROLE DE ESTADO (MEMÓRIA)
// ==================================================
// Guarda em qual etapa da conversa o cliente está.
// Ex: { "551299999999@s.whatsapp.net": { etapa: "MENU" } }
const userContext = {};

// ==================================================
// 2. TEXTOS PADRÃO (EDITÁVEIS)
// ==================================================
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

// ==================================================
// 3. LÓGICA DO ROBÔ (REGRAS)
// ==================================================
async function processarMensagemFixa(textoUsuario, idRemoto, nomeUsuario) {
    const texto = textoUsuario.trim();
    
    // Recupera o estado atual do cliente (ou cria vazio)
    let contexto = userContext[idRemoto] || { etapa: 'INICIO' };
    
    let resposta = null;

    // --- LÓGICA DE NAVEGAÇÃO ---

    // 1. COMANDO "OI" (Reinicia ou Inicia)
    if (texto.toLowerCase() === 'oi' || texto.toLowerCase() === 'ola' || texto.toLowerCase() === 'olá') {
        resposta = MENSAGENS.SAUDACAO(nomeUsuario);
        contexto.etapa = 'MENU';
    }
    
    // 2. ESTÁ NO MENU?
    else if (contexto.etapa === 'MENU') {
        if (texto === '1') {
            resposta = MENSAGENS.FILA_TI;
            contexto.etapa = 'FILA'; // Cliente aguardando atendimento
            
            // Opcional: Aqui você poderia chamar uma função para notificar o painel que entrou na fila
        } 
        else if (texto === '#') {
            resposta = MENSAGENS.AVALIACAO_INICIO;
            contexto.etapa = 'AVALIACAO_NOTA';
        }
        else if (texto.startsWith('*')) {
            // Lógica de Ticket (Exemplo)
            const ticketId = texto.substring(1);
            resposta = `🔍 Buscando status do ticket #${ticketId}... (Funcionalidade em desenvolvimento)`;
            // Mantém no menu
        }
        else {
            resposta = MENSAGENS.OPCAO_INVALIDA;
        }
    }

    // 3. ESTÁ NA FILA OU SENDO ATENDIDO?
    else if (contexto.etapa === 'FILA' || contexto.etapa === 'ATENDIMENTO') {
        // Se o cliente digitar #, ele quer encerrar
        if (texto === '#') {
            resposta = MENSAGENS.AVALIACAO_INICIO;
            contexto.etapa = 'AVALIACAO_NOTA';
        } 
        // Se não, ele está apenas conversando, o bot não responde nada (silêncio)
        else {
            return null; 
        }
    }

    // 4. ESTÁ DANDO NOTA?
    else if (contexto.etapa === 'AVALIACAO_NOTA') {
        if (['1', '2', '3', '4', '5'].includes(texto)) {
            resposta = MENSAGENS.AVALIACAO_MOTIVO;
            contexto.etapa = 'AVALIACAO_MOTIVO';
            contexto.nota = texto; // Salva a nota temporariamente
        } 
        else if (texto === '9') {
            resposta = MENSAGENS.ENCERRAMENTO_FINAL;
            delete userContext[idRemoto]; // Limpa a memória
            return resposta;
        } 
        else {
            resposta = "Por favor, digite um número de 1 a 5, ou 9 para sair.";
        }
    }

    // 5. ESTÁ DESCREVENDO O MOTIVO?
    else if (contexto.etapa === 'AVALIACAO_MOTIVO') {
        // Aceita qualquer texto como motivo
        resposta = MENSAGENS.ENCERRAMENTO_FINAL;
        
        // Aqui você salvaria a Nota e o Motivo no Banco de Dados
        console.log(`[AVALIAÇÃO] Cliente: ${nomeUsuario} | Nota: ${contexto.nota} | Motivo: ${texto}`);
        
        delete userContext[idRemoto]; // Fim do ciclo
    }

    // CASO PADRÃO (INICIO)
    else {
        // Se não digitou "oi" e não tem estado, não faz nada ou manda o menu?
        // Vamos mandar o menu para garantir
        if (!resposta) {
             // Opcional: responder apenas se for "oi", ou sempre responder o menu
             // resposta = MENSAGENS.SAUDACAO(nomeUsuario);
             // contexto.etapa = 'MENU';
             return null; // Fica mudo se não começar com "Oi"
        }
    }

    // Atualiza a memória
    if (resposta) {
        userContext[idRemoto] = contexto;
    }

    return resposta;
}

// ==================================================
// 4. WEBHOOK (CONEXÃO ATUALIZADA COM LOGS E FIX DE MENSAGENS)
// ==================================================
export const handleWebhook = async (req, res) => {
  const payload = req.body;
  const io = req.io;

  // [DEBUG] Confirmação de recebimento
  console.log("🔔 WEBHOOK CHEGOU! Evento:", payload.event);

  try {
    // Eventos de Sistema (QRCode e Status)
    if (payload.event === 'qrcode.updated' && payload.data?.qrcode?.base64) {
      console.log("📸 QR Code recebido");
      io.emit('qrCodeRecebido', { qr: payload.data.qrcode.base64 });
    }
    if (payload.event === 'connection.update') {
      console.log("🔌 Status da conexão:", payload.data.status);
      io.emit('statusConexao', { status: payload.data.status });
    }

    // Mensagens (Recebidas ou Enviadas pelo celular)
    if (payload.event === 'messages.upsert' && payload.data?.message) {
      const msg = payload.data;
      const idRemoto = msg.key.remoteJid;
      const isFromMe = msg.key.fromMe;
      
      // Tenta pegar o nome de várias formas
      const nomeAutor = msg.pushName || msg.key.participant || idRemoto.split('@')[0];
      
      // Extrai o texto de forma segura
      const texto = msg.message?.conversation || 
                    msg.message?.extendedTextMessage?.text || 
                    msg.message?.text || "";

      // Log para você ver no terminal
      console.log(`📩 Mensagem de ${idRemoto}: ${texto} (Eu: ${isFromMe})`);

      // [CORREÇÃO]
      // 1. Ignora apenas mensagens de status (broadcast)
      // 2. PERMITE mensagens enviadas por você (isFromMe = true) para sincronizar o chat
      if (idRemoto !== 'status@broadcast' && texto) {
        
        // 1. Envia para o Painel (Frontend) em tempo real
        io.emit('novaMensagemWhatsapp', {
            chatId: idRemoto,
            nome: nomeAutor,
            texto: texto,
            fromMe: isFromMe // O frontend vai usar isso para pintar o balão
        });

        // 2. Processa a Lógica do Robô (APENAS se for mensagem do cliente)
        if (!isFromMe) {
            const respostaBot = await processarMensagemFixa(texto, idRemoto, nomeAutor);

            // 3. Se o robô tiver uma resposta, envia
            if (respostaBot) {
                console.log("🤖 Robô respondendo:", respostaBot);
                await evolutionService.enviarTexto(idRemoto, respostaBot);

                // Emite a resposta do robô para o frontend também
                io.emit('novaMensagemWhatsapp', {
                    chatId: idRemoto,
                    nome: "Auto-Atendimento",
                    texto: respostaBot,
                    fromMe: true
                });
            }
        }
      }
    }

    res.status(200).json({ success: true });

  } catch (error) {
    console.error('❌ Erro no webhook:', error);
    res.status(500).json({ success: false });
  }
};

// ==================================================
// 5. FUNÇÕES EXTRAS (ATRIBUIÇÃO / FINALIZAÇÃO MANUAL)
// ==================================================
// Estas funções podem ser chamadas por outros controllers quando você clicar nos botões do painel

// Exemplo: Chamar quando o agente clicar em "Atender"
export const notificarAtribuicao = async (numero, nomeAgente) => {
    const msg = `Atendimento atribuído ao Agente ${nomeAgente}`;
    await evolutionService.enviarTexto(numero, msg);
    
    // Atualiza estado para 'ATENDIMENTO' para o bot parar de responder menu
    if(userContext[numero]) userContext[numero].etapa = 'ATENDIMENTO';
    else userContext[numero] = { etapa: 'ATENDIMENTO' };
    
    return msg;
};

// Exemplo: Chamar quando o agente clicar em "Finalizar"
export const notificarFinalizacao = async (numero) => {
    const msg = MENSAGENS.AVALIACAO_INICIO;
    await evolutionService.enviarTexto(numero, msg);
    
    // Força o estado para AVALIACAO
    userContext[numero] = { etapa: 'AVALIACAO_NOTA' };
    
    return msg;
};

// --- OUTRAS FUNÇÕES DE CONEXÃO (MANTIDAS) ---
export const connectInstance = async (req, res) => {
    try { const r = await evolutionService.criarInstancia(); res.status(200).json({ success: true, data: r }); } 
    catch (e) { res.status(500).json({ success: false, message: e.message }); }
};
export const handleSendMessage = async (req, res) => {
  const { numero, mensagem } = req.body;
  try { const r = await evolutionService.enviarTexto(numero, mensagem); res.status(200).json({ success: true, data: r }); } 
  catch (e) { res.status(500).json({ success: false, message: e.message }); }
};
export const checarStatus = async (req, res) => {
  try { const r = await evolutionService.consultarStatus(); res.status(200).json({ success: true, data: r }); } 
  catch (e) { res.status(500).json({ success: false, message: e.message }); }
};
export const listarConversas = async (req, res) => {
  try {
    const chats = await evolutionService.buscarConversas();
    const conversas = chats.map(c => ({ numero: c.id, nome: c.pushName || c.name || c.id.split('@')[0], ultimaMensagem: c.conversation || "...", unread: c.unreadCount > 0 }));
    res.status(200).json({ success: true, data: conversas });
  } catch (e) { res.status(200).json({ success: true, data: [] }); }
};
export const configurarUrlWebhook = async (req, res) => {
    try {
        const host = req.get('host');
        const protocol = req.protocol; // http ou https
        // Força HTTPS se estiver em produção/railway
        const finalProtocol = host.includes('localhost') ? 'http' : 'https';
        
        const fullUrl = `${finalProtocol}://${host}/api/evolution/webhook`;
        
        console.log(`Configurando Webhook para: ${fullUrl}`);
        
        await evolutionService.configurarWebhook(fullUrl);
        res.status(200).json({ success: true, message: `Webhook configurado para: ${fullUrl}` });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};