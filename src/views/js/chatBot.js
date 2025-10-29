document.addEventListener('DOMContentLoaded', () => {
    // 1. Pegar todos os elementos do SEU HTML
    const chatHistory = document.getElementById('chatHistory');
    const chatInput = document.getElementById('chatInput');
    const sendButton = document.getElementById('sendButton');
    const typingIndicator = document.getElementById('typingIndicator');
    const suggestionArea = document.getElementById('suggestionArea');

    // Validação para garantir que tudo foi encontrado
    if (!chatHistory || !chatInput || !sendButton || !typingIndicator || !suggestionArea) {
        console.error("ERRO: Não foi possível encontrar um ou mais elementos do chat no HTML. Verifique os IDs.");
        return;
    }

    // 2. Histórico da conversa (para enviar à OpenAI)
    let conversationHistory = [
        { role: 'system', content: 'Você é um assistente prestativo do Portal Supermercado. Responda de forma breve e direta sobre chamados, impressão de etiquetas e status de funcionários.' }
    ];

    // 3. Adicionar a mensagem inicial (que já está no HTML) ao histórico
    const initialBotMessage = chatHistory.querySelector('.message-bot p');
    if (initialBotMessage) {
        conversationHistory.push({ role: 'assistant', content: initialBotMessage.textContent });
    }

    // 4. Funções de ajuda
    function showTyping() {
        typingIndicator.style.display = 'flex'; // 'flex' pois é assim no seu HTML
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }
    function hideTyping() {
        typingIndicator.style.display = 'none';
    }

    // 5. Função para ADICIONAR uma nova mensagem na tela (replicando sua estrutura HTML)
    function addMessage(message, sender) {
        const messageWrapper = document.createElement('div');
        messageWrapper.classList.add('chat-message');
        
        const timestamp = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        
        if (sender === 'bot') {
            messageWrapper.classList.add('message-bot');
            messageWrapper.innerHTML = `
                <span class="avatar">🤖</span>
                <div class="message-bubble">
                    <p>${message}</p>
                    <span class="timestamp">${timestamp}</span>
                </div>
            `;
        } else { // 'user'
            messageWrapper.classList.add('message-user'); // Adiciona classe para alinhar à direita (ver CSS)
            messageWrapper.innerHTML = `
                <span class="avatar">👤</span>
                <div class="message-bubble">
                    <p>${message}</p>
                    <span class="timestamp">${timestamp}</span>
                </div>
            `;
        }

        chatHistory.appendChild(messageWrapper);
        chatHistory.scrollTop = chatHistory.scrollHeight; // Rola para o fim
    }

    // 6. Função principal para ENVIAR a mensagem
    async function handleSendMessage(message) {
        const userMessage = message.trim();
        if (userMessage === '') return;

        // Esconde sugestões e mostra a mensagem do usuário
        suggestionArea.style.display = 'none';
        addMessage(userMessage, 'user');
        conversationHistory.push({ role: 'user', content: userMessage });
        
        if (chatInput) chatInput.value = ''; // Limpa o input se a mensagem veio de lá

        // Mostra "digitando..."
        showTyping();

        try {
            // Envia o histórico para o SEU backend (a rota que criamos)
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ history: conversationHistory })
            });

            if (!response.ok) {
                throw new Error(`Erro na API: ${response.statusText}`);
            }

            const data = await response.json();
            const botReply = data.reply;

            // Esconde "digitando..." e mostra a resposta do bot
            hideTyping();
            addMessage(botReply, 'bot');
            conversationHistory.push({ role: 'assistant', content: botReply });

        } catch (error) {
            console.error('Erro ao contatar o bot:', error);
            hideTyping();
            addMessage('Desculpe, não foi possível conectar ao assistente. Tente novamente mais tarde.', 'bot');
        }
    }

    // 7. Ligar os botões (Event Listeners)
    
    // Botão de Enviar
    sendButton.addEventListener('click', () => {
        handleSendMessage(chatInput.value);
    });

    // Tecla Enter no input
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSendMessage(chatInput.value);
        }
    });

    // Botões de Sugestão
    suggestionArea.addEventListener('click', (e) => {
        if (e.target.classList.contains('suggestion-btn')) {
            const message = e.target.dataset.message;
            handleSendMessage(message);
        }
    });

    // Esconder o "digitando..." no início
    hideTyping();
});
