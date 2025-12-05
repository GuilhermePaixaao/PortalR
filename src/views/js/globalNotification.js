// src/views/js/globalNotification.js

// Conecta ao Socket.io
// (A biblioteca socket.io.min.js já deve ter sido carregada no HTML antes deste script)
const socket = io();

// =================================================================
// 1. FUNÇÕES AUXILIARES DE ESTADO (Para salvar no LocalStorage)
// =================================================================

/**
 * Lê o estado atual do WhatsApp salvo no navegador
 */
function getWhatsAppState() {
    try {
        const saved = localStorage.getItem('wa_app_state');
        return saved ? JSON.parse(saved) : {
            activeNumber: null,
            conversas: {},
            contactNames: {},
            chatList: []
        };
    } catch (e) {
        console.error("Erro ao ler estado:", e);
        return { activeNumber: null, conversas: {}, contactNames: {}, chatList: [] };
    }
}

/**
 * Salva o estado atualizado de volta no navegador
 */
function saveWhatsAppState(state) {
    try {
        localStorage.setItem('wa_app_state', JSON.stringify(state));
    } catch (e) {
        console.error("Erro ao salvar estado:", e);
    }
}

// =================================================================
// 2. SISTEMA DE NOTIFICAÇÃO (TOAST)
// =================================================================

function showToast(titulo, mensagem, tipo = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `global-toast toast-${tipo}`;
    
    let icon = '🔔'; 
    if(tipo === 'warning') icon = '⚠️';
    if(tipo === 'success') icon = '✅';
    if(tipo === 'whatsapp') icon = '💬'; // Ícone especial para Zap

    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-content">
            <div class="toast-title">${titulo}</div>
            <div class="toast-message">${mensagem}</div>
        </div>
        <button class="toast-close">&times;</button>
    `;

    container.appendChild(toast);

    // Tocar som suave
    try {
        const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
        audio.volume = 0.5;
        audio.play().catch(() => {}); // Ignora erro se navegador bloquear
    } catch(e) {}

    requestAnimationFrame(() => toast.classList.add('show'));

    const duration = 8000; 
    const timer = setTimeout(() => removeToast(toast), duration);

    toast.querySelector('.toast-close').addEventListener('click', () => {
        clearTimeout(timer);
        removeToast(toast);
    });
}

function removeToast(toast) {
    toast.classList.remove('show');
    setTimeout(() => { if(toast.parentElement) toast.remove(); }, 300);
}

// =================================================================
// 3. LISTENERS DO SOCKET (PROCESSAMENTO EM SEGUNDO PLANO)
// =================================================================

// A. Novo Chamado Interno (Ticket)
socket.on('novoChamadoInterno', (data) => {
    const msg = `Ticket #${data.id}: ${data.assunto}\nPor: ${data.requisitante}`;
    showToast('Novo Chamado Aberto!', msg, 'info');
});

// B. Cliente na Fila de T.I. (WhatsApp)
socket.on('notificacaoChamado', (data) => {
    // 1. Notifica na tela
    const msg = `Cliente: ${data.nome}\nEntrou na fila de suporte.`;
    showToast('📞 Fila de Atendimento', msg, 'warning');

    // 2. Salva no Storage (mesmo se não estiver na página do Zap)
    // Só salva se NÃO estivermos na página do WhatsApp (para evitar conflito de gravação dupla)
    if (!window.location.href.includes('AtendimentoWhatsApp') && !window.location.href.includes('whatsapp')) {
        const state = getWhatsAppState();
        
        // Remove se já existir na lista para mover pro topo
        const idx = state.chatList.findIndex(c => c.numero === data.chatId);
        if (idx > -1) state.chatList.splice(idx, 1);

        state.chatList.unshift({
            numero: data.chatId, 
            nome: data.nome, 
            ultimaMensagem: "🔔 Chamando...", 
            unreadCount: 1, 
            visivel: true, 
            pending: true, 
            etapa: 'SUBMENU_TI'
        });
        
        if (data.nome) state.contactNames[data.chatId] = data.nome;
        
        saveWhatsAppState(state);
    }
});

// C. Nova Mensagem de Chat (A MÁGICA ACONTECE AQUI)
socket.on('novaMensagemWhatsapp', (data) => {
    // Se a mensagem for minha (enviada pelo bot ou por mim), ignora notificação
    if (!data.fromMe) {
        showToast(`💬 Mensagem de ${data.nome}`, data.texto, 'whatsapp');
    }

    // LÓGICA DE SALVAMENTO EM SEGUNDO PLANO
    // Verifica se NÃO estamos na página do WhatsApp.
    if (!window.location.href.includes('AtendimentoWhatsApp') && !window.location.href.includes('whatsapp')) {
        console.log("[Global] Salvando mensagem em background...");
        
        const state = getWhatsAppState();
        const { chatId, texto, fromMe, nome, mostrarNaFila } = data;

        // 1. Atualiza o histórico da conversa
        if (!state.conversas[chatId]) state.conversas[chatId] = [];
        state.conversas[chatId].push({
            fromMe,
            text: texto,
            time: new Date(),
            name: nome || "Eu"
        });

        // 2. Atualiza nome do contato se disponível
        if (nome && !fromMe) state.contactNames[chatId] = nome;

        // 3. Atualiza a Lista Lateral (ChatList)
        const idx = state.chatList.findIndex(c => c.numero === chatId);
        let currentChat = null;
        
        if (idx > -1) {
            currentChat = state.chatList[idx];
            state.chatList.splice(idx, 1); // Remove para readicionar no topo
        }

        // Determina visibilidade
        let isVisivel = false;
        if (mostrarNaFila !== undefined) isVisivel = mostrarNaFila;
        else if (currentChat) isVisivel = currentChat.visivel;
        if (fromMe && currentChat && currentChat.visivel) isVisivel = true;

        // Determina pendência
        let isPending = (mostrarNaFila === true);
        if (currentChat && !currentChat.pending && isVisivel) isPending = false;

        let newUnread = (currentChat ? currentChat.unreadCount : 0);
        if (!fromMe) newUnread++;

        state.chatList.unshift({
            numero: chatId,
            nome: state.contactNames[chatId] || nome,
            ultimaMensagem: fromMe ? `Você: ${texto}` : texto,
            unreadCount: newUnread,
            visivel: isVisivel,
            pending: isPending,
            etapa: currentChat ? currentChat.etapa : 'INICIO'
        });

        // 4. Salva no disco
        saveWhatsAppState(state);
    }
});

// D. Atendimento Transferido (WhatsApp)
socket.on('transferenciaChamado', (data) => {
    if (!window.location.href.includes('AtendimentoWhatsApp') && !window.location.href.includes('whatsapp')) {
        console.log("[Global] Processando transferência de chat em background...");
        
        const state = getWhatsAppState();
        const { chatId, novoAgente, antigoAgente, nomeCliente } = data;
        
        const chat = state.chatList.find(c => c.numero === chatId);

        // 1. Pega o nome do agente logado
        let meuNome = "";
        try { 
            const userData = JSON.parse(localStorage.getItem("userData"));
            meuNome = userData?.data?.nomeFuncionario;
        } catch(e) { console.error("Erro ao ler dados do usuário", e); }
        
        const souEu = (novoAgente === meuNome);

        if (chat) {
            chat.nomeAgente = novoAgente;
            chat.etapa = 'ATENDIMENTO_HUMANO'; 
            chat.pending = false; 
            
            chat.visivel = souEu; // Se é pra mim, aparece; se não, some.

            // Adicionar mensagem de transferência ao histórico
            if (!state.conversas[chatId]) state.conversas[chatId] = [];
            const msgTexto = `🔄 Atendimento Transferido para ${novoAgente}.`;
            state.conversas[chatId].push({ fromMe: true, text: msgTexto, time: new Date(), name: "Sistema" });
            chat.ultimaMensagem = msgTexto; 

            // Reordena
            const idx = state.chatList.findIndex(c => c.numero === chatId);
            if (idx > -1) { state.chatList.splice(idx, 1); }
            
            if(chat.visivel) state.chatList.unshift(chat);
            
        } else if (souEu) {
             // Entra na lista se foi transferido para mim e eu não tinha
             const clienteNome = nomeCliente || chatId;
             state.contactNames[chatId] = clienteNome;

             const newChat = {
                numero: chatId,
                nome: clienteNome,
                ultimaMensagem: `🔄 Transferido por ${antigoAgente}`,
                unreadCount: 1, 
                visivel: true, 
                pending: false, 
                etapa: 'ATENDIMENTO_HUMANO',
                nomeAgente: novoAgente
             };
             state.chatList.unshift(newChat);
             
             if (!state.conversas[chatId]) state.conversas[chatId] = [];
             state.conversas[chatId].push({ fromMe: true, text: `🔄 Atendimento Transferido para ${novoAgente}.`, time: new Date(), name: "Sistema" });
        }

        if (souEu) {
            const msg = `O chat de ${nomeCliente || chatId} foi transferido para você.`;
            showToast('🔄 Transferência Recebida', msg, 'info');
        }

        saveWhatsAppState(state);
    }
});

// [NOVO] E. Atendimento Assumido (Sincronização em background)
socket.on('atendimentoAssumido', (data) => {
    // Só roda se NÃO estiver na página do WhatsApp (lá o script local já cuida)
    if (!window.location.href.includes('AtendimentoWhatsApp') && !window.location.href.includes('whatsapp')) {
        console.log("[Global] Processando atendimento assumido em background...");
        
        const state = getWhatsAppState();
        const { chatId, nomeAgente } = data;
        
        const chat = state.chatList.find(c => c.numero === chatId);

        if (chat) {
            chat.nomeAgente = nomeAgente;
            chat.etapa = 'ATENDIMENTO_HUMANO';
            chat.pending = false;

            // Quem sou eu?
            let meuNome = "";
            try { 
                const userData = JSON.parse(localStorage.getItem("userData"));
                meuNome = userData?.data?.nomeFuncionario;
            } catch(e) {}

            // Se fui eu que assumi (em outra aba?), visível. Se foi outro, invisível.
            if (nomeAgente === meuNome) {
                chat.visivel = true;
            } else {
                chat.visivel = false; // Remove da minha lista de pendentes
            }

            saveWhatsAppState(state);
        }
    }
});

console.log("✅ Sistema Global de Notificações Ativo (Background Save)");