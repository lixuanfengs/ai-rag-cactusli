document.addEventListener('DOMContentLoaded', () => {
    const newChatBtn = document.getElementById('new-chat-btn');
    const chatList = document.getElementById('chat-list');
    const chatMessages = document.getElementById('chat-messages');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const modelSelector = document.getElementById('model-selector');
    const currentChatTitle = document.getElementById('current-chat-title');
    const welcomePlaceholder = document.getElementById('welcome-placeholder');

    let chats = []; // Array to hold all chat sessions: { id: string, name: string, messages: [] }
    let currentChatId = null; // ID of the currently active chat
    let eventSource = null; // To hold the EventSource connection

    // --- Initialization ---

    loadChatsFromLocalStorage();
    renderChatList();
    if (chats.length > 0) {
        // Select the last active chat or the first one
        const lastChatId = localStorage.getItem('currentChatId');
        selectChat(lastChatId && chats.some(c => c.id === lastChatId) ? lastChatId : chats[0].id);
    } else {
        // No chats exist, show placeholder
        showWelcomePlaceholder();
    }

    // --- Event Listeners ---

    newChatBtn.addEventListener('click', createNewChat);

    sendButton.addEventListener('click', sendMessage);

    messageInput.addEventListener('keydown', (e) => {
        // Send on Enter, allow Shift+Enter for newline
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); // Prevent default newline insertion
            sendMessage();
        }
        autoResizeTextarea();
    });

    messageInput.addEventListener('input', autoResizeTextarea); // Resize while typing

    // Use event delegation for chat list clicks (select, delete, rename)
    chatList.addEventListener('click', (e) => {
        const listItem = e.target.closest('.chat-list-item');
        if (!listItem) return; // Clicked outside a list item

        const chatId = listItem.dataset.chatId;

        if (e.target.closest('.delete-chat-btn')) {
            e.stopPropagation(); // Prevent chat selection
            deleteChat(chatId);
        } else if (e.target.closest('.rename-chat-btn')) {
            e.stopPropagation(); // Prevent chat selection
            renameChat(chatId);
        } else {
            // Clicked on the list item itself (or its text)
            selectChat(chatId);
        }
    });


    // --- Core Functions ---

    function createNewChat() {
        const newChatId = `chat_${Date.now()}`;
        const newChat = {
            id: newChatId,
            name: `新聊天 ${chats.length + 1}`,
            messages: [] // { role: 'user' | 'assistant', content: string }
        };
        chats.unshift(newChat); // Add to the beginning of the array
        saveChatsToLocalStorage();
        renderChatList();
        selectChat(newChatId);
        messageInput.focus(); // Focus input for new chat
    }

    function selectChat(chatId) {
        if (!chatId || !chats.some(c => c.id === chatId)) {
            if (chats.length > 0) {
                chatId = chats[0].id; // Default to first if invalid ID given
            } else {
                showWelcomePlaceholder();
                currentChatId = null;
                localStorage.removeItem('currentChatId');
                renderChatList(); // Update selection highlight
                return;
            }
        }

        currentChatId = chatId;
        localStorage.setItem('currentChatId', currentChatId); // Remember last active chat
        const selectedChat = chats.find(chat => chat.id === chatId);
        currentChatTitle.textContent = selectedChat ? selectedChat.name : 'Chat';
        hideWelcomePlaceholder();
        renderChatMessages();
        renderChatList(); // Update selection highlight
        messageInput.focus();
    }

    function deleteChat(chatId) {
        if (!confirm(`确定要删除 "${chats.find(c => c.id === chatId)?.name}" 吗?`)) {
            return;
        }

        chats = chats.filter(chat => chat.id !== chatId);
        saveChatsToLocalStorage();

        if (currentChatId === chatId) {
            // If the deleted chat was the active one, select another or show placeholder
            currentChatId = null;
            localStorage.removeItem('currentChatId');
            if (chats.length > 0) {
                selectChat(chats[0].id); // Select the first remaining chat
            } else {
                showWelcomePlaceholder();
                currentChatTitle.textContent = 'Chat';
            }
        }
        renderChatList(); // Re-render the list without the deleted chat
        // If another chat was selected, its messages are already rendered by selectChat
    }


    function renameChat(chatId) {
        const chat = chats.find(c => c.id === chatId);
        if (!chat) return;

        const newName = prompt(`输入新的聊天名称:`, chat.name);
        if (newName && newName.trim() !== '') {
            chat.name = newName.trim();
            saveChatsToLocalStorage();
            renderChatList(); // Update the name in the list
            if (currentChatId === chatId) {
                currentChatTitle.textContent = chat.name; // Update title if it's the current chat
            }
        }
    }

    function sendMessage() {
        const messageText = messageInput.value.trim();
        const selectedModel = modelSelector.value;

        if (!messageText || !currentChatId || !selectedModel) {
            if (!currentChatId) alert("请先选择或创建一个聊天。");
            if (!selectedModel) alert("请选择一个模型。");
            return; // Need text, an active chat, and a model
        }

        const currentChat = chats.find(chat => chat.id === currentChatId);
        if (!currentChat) return; // Should not happen if currentChatId is valid

        // 1. Add user message to state and UI
        const userMessage = { role: 'user', content: messageText };
        currentChat.messages.push(userMessage);
        saveChatsToLocalStorage(); // Save user message
        appendMessageBubble(userMessage.role, userMessage.content);
        messageInput.value = ''; // Clear input
        autoResizeTextarea(); // Reset textarea height
        scrollToBottom();

        // 2. Prepare for AI response
        const aiMessagePlaceholder = appendMessageBubble('assistant', '', true); // Add placeholder with loading
        scrollToBottom();

        // Disable input/send while waiting
        messageInput.disabled = true;
        sendButton.disabled = true;
        sendButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> 等待...';


        // 3. Call API using EventSource
        const apiUrl = `/api/v1/ollama/generate_stream?model=${encodeURIComponent(selectedModel)}&message=${encodeURIComponent(messageText)}`;
        let accumulatedResponse = '';
        let responseStarted = false; // Flag to remove loading indicator

        // Close previous connection if any
        if (eventSource) {
            eventSource.close();
        }

        eventSource = new EventSource(apiUrl);

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                // DEBUG: console.log("SSE Data:", data);

                // Check if response content exists
                const chunk = data.result?.output?.text;

                if (chunk) { // Handle potentially empty chunks/objects without text
                    if (!responseStarted) {
                        // Remove loading dots on first actual content received
                        const loadingIndicator = aiMessagePlaceholder.querySelector('.loading-dots');
                        if (loadingIndicator) loadingIndicator.remove();
                        responseStarted = true;
                    }
                    accumulatedResponse += chunk;
                    // Update the content using textContent for security (prevents HTML injection)
                    // If markdown rendering is needed, use a library AFTER the stream ends.
                    aiMessagePlaceholder.querySelector('.message-content').textContent = accumulatedResponse;
                    scrollToBottom();
                }

                // Check for finish reason (corrected based on your example)
                if (data.result?.metadata?.finishReason === 'stop' || data.metadata?.finishReason === 'stop') { // Check both possible locations
                    closeEventSource();
                }

            } catch (error) {
                console.error('Error parsing SSE data:', error, 'Data:', event.data);
                // Optionally display error in the chat bubble
                aiMessagePlaceholder.querySelector('.message-content').textContent += "\n\n[错误：无法解析响应块]";
                closeEventSource(); // Close on parsing error too
            }
        };

        eventSource.onerror = (error) => {
            console.error('EventSource failed:', error);
            eventSource.close();
            const errorText = "\n\n[错误：无法连接到服务器或流中断]";
            const contentElement = aiMessagePlaceholder.querySelector('.message-content');
            // Make sure loading is removed if error happens before first message
            if (!responseStarted) {
                const loadingIndicator = aiMessagePlaceholder.querySelector('.loading-dots');
                if (loadingIndicator) loadingIndicator.remove();
                contentElement.textContent = errorText.trim(); // Show error if nothing was received
            } else {
                contentElement.textContent += errorText; // Append error if stream was partial
            }
            // Save the partial/error response
            finalizeAssistantMessage(accumulatedResponse + errorText);
            // Re-enable input
            resetInput();
        };
    }

    function closeEventSource() {
        if (eventSource) {
            eventSource.close();
            eventSource = null;
            // Finalize the message in the state *after* the stream is fully closed
            // Find the final text content from the placeholder
            const aiPlaceholder = chatMessages.querySelector('.message-bubble[data-role="assistant"]:last-child');
            if (aiPlaceholder) {
                const finalContent = aiPlaceholder.querySelector('.message-content').textContent;
                finalizeAssistantMessage(finalContent);
            }
            resetInput(); // Re-enable input
        }
    }

    function resetInput() {
        messageInput.disabled = false;
        sendButton.disabled = false;
        sendButton.innerHTML = '<i class="fas fa-paper-plane mr-1"></i> 提交';
        messageInput.focus();
    }

    function finalizeAssistantMessage(finalContent) {
        const currentChat = chats.find(chat => chat.id === currentChatId);
        if (currentChat) {
            // Add the complete assistant message to the state
            currentChat.messages.push({ role: 'assistant', content: finalContent });
            saveChatsToLocalStorage(); // Save the final AI message
        }
    }


    // --- Rendering Functions ---

    function renderChatList() {
        chatList.innerHTML = ''; // Clear existing list
        chats.forEach(chat => {
            const listItem = document.createElement('li');
            listItem.classList.add(
                'chat-list-item',
                'p-2', 'rounded', 'cursor-pointer', 'hover:bg-gray-700', 'transition', 'duration-150', 'text-sm',
                'flex', 'justify-between', 'items-center'
            );
            listItem.dataset.chatId = chat.id;

            if (chat.id === currentChatId) {
                listItem.classList.add('bg-gray-600', 'font-semibold');
            }

            const chatNameSpan = document.createElement('span');
            chatNameSpan.textContent = chat.name;
            chatNameSpan.classList.add('truncate', 'flex-grow', 'mr-2'); // Allow truncation

            const actionsSpan = document.createElement('span');
            actionsSpan.classList.add('chat-item-actions', 'space-x-2', 'text-gray-400');

            const renameBtn = document.createElement('button');
            renameBtn.classList.add('rename-chat-btn', 'hover:text-white');
            renameBtn.innerHTML = '<i class="fas fa-pencil-alt fa-xs"></i>';
            renameBtn.title = "重命名";

            const deleteBtn = document.createElement('button');
            deleteBtn.classList.add('delete-chat-btn', 'hover:text-red-500');
            deleteBtn.innerHTML = '<i class="fas fa-trash-alt fa-xs"></i>';
            deleteBtn.title = "删除";

            actionsSpan.appendChild(renameBtn);
            actionsSpan.appendChild(deleteBtn);

            listItem.appendChild(chatNameSpan);
            listItem.appendChild(actionsSpan);

            chatList.appendChild(listItem);
        });
    }

    function renderChatMessages() {
        chatMessages.innerHTML = ''; // Clear previous messages
        const currentChat = chats.find(chat => chat.id === currentChatId);

        if (currentChat && currentChat.messages.length > 0) {
            hideWelcomePlaceholder();
            currentChat.messages.forEach(message => {
                appendMessageBubble(message.role, message.content);
            });
            scrollToBottom();
        } else if (currentChat) {
            // Chat exists but is empty
            hideWelcomePlaceholder(); // Still hide the main placeholder
            // Optionally add a message like "Start the conversation"
            const startMsg = document.createElement('div');
            startMsg.textContent = '向模型发送消息开始对话。';
            startMsg.classList.add('text-center', 'text-gray-500', 'mt-4');
            chatMessages.appendChild(startMsg);
        } else {
            // No chat selected or found (should be handled by selectChat)
            showWelcomePlaceholder();
        }
    }

    function appendMessageBubble(role, content, isLoading = false) {
        const messageWrapper = document.createElement('div');
        messageWrapper.classList.add('flex', 'message-bubble');
        messageWrapper.dataset.role = role; // Store role for potential later use/styling

        const bubble = document.createElement('div');
        bubble.classList.add(
            'max-w-xl', // Max width for user messages
            'lg:max-w-3xl', // Wider max width for AI on larger screens
            'rounded-lg',
            'px-4',
            'py-2',
            'message-content-wrapper' // Wrapper for content and potential icon
        );

        const contentSpan = document.createElement('span');
        contentSpan.classList.add('message-content');
        // Use textContent for safety, prevents rendering unintended HTML
        contentSpan.textContent = content;

        if (role === 'user') {
            messageWrapper.classList.add('justify-end');
            bubble.classList.add('bg-blue-500', 'text-white');
        } else { // assistant
            messageWrapper.classList.add('justify-start');
            bubble.classList.add('bg-gray-200', 'text-gray-800');
            // Add wider max width for assistant
            bubble.classList.remove('max-w-xl');
        }

        bubble.appendChild(contentSpan); // Add content span inside bubble


        if (isLoading) {
            bubble.classList.add('flex', 'items-center'); // Align items for loading dots
            const loadingDots = document.createElement('span');
            loadingDots.classList.add('loading-dots', 'ml-2');
            loadingDots.innerHTML = '<span></span><span></span><span></span>';
            // Append loading dots after the (initially empty) content span
            bubble.appendChild(loadingDots);
        }


        messageWrapper.appendChild(bubble);
        chatMessages.appendChild(messageWrapper);
        return bubble; // Return the bubble element itself (useful for placeholder update)
    }

    // --- Utility Functions ---

    function scrollToBottom() {
        // Use setTimeout to allow the DOM to update before scrolling
        setTimeout(() => {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }, 0);
    }

    function autoResizeTextarea() {
        messageInput.style.height = 'auto'; // Reset height
        // Set height based on scroll height, but limit max height
        const maxHeight = 160; // Example max height (px), adjust as needed
        messageInput.style.height = `${Math.min(messageInput.scrollHeight, maxHeight)}px`;
    }

    function saveChatsToLocalStorage() {
        try {
            localStorage.setItem('aiChats', JSON.stringify(chats));
        } catch (error) {
            console.error("Error saving chats to localStorage:", error);
            // Handle potential storage limit errors
        }
    }

    function loadChatsFromLocalStorage() {
        const savedChats = localStorage.getItem('aiChats');
        if (savedChats) {
            try {
                chats = JSON.parse(savedChats);
            } catch (error) {
                console.error("Error loading chats from localStorage:", error);
                chats = []; // Reset if data is corrupted
                localStorage.removeItem('aiChats'); // Clear corrupted data
            }
        } else {
            chats = [];
        }
    }

    function showWelcomePlaceholder() {
        chatMessages.innerHTML = ''; // Clear any messages
        welcomePlaceholder.classList.remove('hidden');
        welcomePlaceholder.classList.add('flex'); // Ensure it's flex displayed
    }

    function hideWelcomePlaceholder() {
        welcomePlaceholder.classList.add('hidden');
        welcomePlaceholder.classList.remove('flex');
    }

    // Initial resize check in case there's pre-filled text (unlikely here)
    autoResizeTextarea();
});