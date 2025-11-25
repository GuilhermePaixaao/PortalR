// src/views/js/globalNotification.js

// Conecta ao Socket.io (A biblioteca socket.io.min.js deve ser carregada antes deste script no HTML)
const socket = io();

/**
 * Função para exibir o TOAST (Notificação Flutuante)
 * @param {string} titulo - Título da notificação (ex: "Novo Chamado")
 * @param {string} mensagem - Corpo da mensagem
 * @param {string} tipo - 'info', 'warning', 'success' (para cores)
 */
function showToast(titulo, mensagem, tipo = 'info') {
    // 1. Cria o container de notificações se ele ainda não existir no DOM
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    // 2. Cria a estrutura HTML da notificação (Toast)
    const toast = document.createElement('div');
    toast.className = `global-toast toast-${tipo}`;
    
    // Define o ícone com base no tipo de alerta
    let icon = '🔔'; 
    if(tipo === 'warning') icon = '⚠️';
    if(tipo === 'success') icon = '✅';

    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-content">
            <div class="toast-title">${titulo}</div>
            <div class="toast-message">${mensagem}</div>
        </div>
        <button class="toast-close">&times;</button>
    `;

    // Adiciona o toast ao container
    container.appendChild(toast);

    // 3. Tocar Som (Opcional - curto bip)
    // Nota: Alguns navegadores bloqueiam áudio sem interação do usuário.
    try {
        const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
        audio.volume = 15;
        audio.play().catch(e => console.log("Áudio de notificação bloqueado pelo navegador (falta interação)."));
    } catch(e) {
        console.error("Erro ao tentar tocar som:", e);
    }

    // 4. Animação de Entrada (Deslizar)
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // 5. Auto-remover após 8 segundos
    const duration = 8000; 
    const timer = setTimeout(() => {
        removeToast(toast);
    }, duration);

    // Listener para o botão de fechar manual (X)
    toast.querySelector('.toast-close').addEventListener('click', () => {
        clearTimeout(timer);
        removeToast(toast);
    });
}

/**
 * Remove o toast com uma animação de saída suave
 */
function removeToast(toast) {
    toast.classList.remove('show');
    // Espera a animação CSS (0.3s) terminar antes de remover o elemento do HTML
    setTimeout(() => {
        if(toast.parentElement) toast.remove();
    }, 300);
}

// =============================================
// LISTENERS DO SOCKET (Os ouvidos do sistema)
// =============================================

// 1. Listener: Novo Chamado (Vindo do Formulário do Site)
socket.on('novoChamadoInterno', (data) => {
    // Formata a mensagem para mostrar ID, Assunto e Quem pediu
    const msg = `Ticket #${data.id}: ${data.assunto}\nPor: ${data.requisitante}`;
    showToast('Novo Chamado Aberto!', msg, 'info');
});

// 2. Listener: Novo Cliente no WhatsApp (Fila T.I.)
// Este evento 'notificacaoChamado' já é emitido pelo seu whatsappController.js
socket.on('notificacaoChamado', (data) => {
    const msg = `Cliente: ${data.nome}\nEstá aguardando na fila de T.I.`;
    showToast('📞 WhatsApp: Fila de Atendimento', msg, 'warning');
});

// 3. (Opcional) Listener: Status Atualizado
// Você pode expandir o sistema no futuro para ouvir este evento
socket.on('statusAtualizado', (data) => {
    // Exemplo: showToast('Status Mudou', `O chamado #${data.id} agora está ${data.status}`, 'success');
});

console.log("✅ Sistema de Notificações Globais Ativo (globalNotification.js carregado)");