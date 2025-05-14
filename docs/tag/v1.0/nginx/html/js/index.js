const chatArea = document.getElementById('chatArea');
const messageInput = document.getElementById('messageInput');
const submitBtn = document.getElementById('submitBtn');
const newChatBtn = document.getElementById('newChatBtn');
const chatList = document.getElementById('chatList');
const welcomeMessage = document.getElementById('welcomeMessage');
const toggleSidebarBtn = document.getElementById('toggleSidebar');
const sidebar = document.getElementById('sidebar');
const ragSelect = document.getElementById('ragSelect');
const aiModelSelect = document.getElementById('aiModel');
const uploadMenuButton = document.getElementById('uploadMenuButton');
const uploadMenu = document.getElementById('uploadMenu');


let currentEventSource = null;
let currentChatId = null;
let isStreaming = false; // Flag to track if AI is currently responding

// --- Marked.js Configuration ---
marked.setOptions({
    highlight: function (code, lang) {
        const language = hljs.getLanguage(lang) ? lang : 'plaintext';
        try {
            return hljs.highlight(code, {language, ignoreIllegals: true}).value;
        } catch (e) {
            console.error("Highlighting error:", e);
            return hljs.highlightAuto(code).value; // Fallback to auto-detection
        }
    },
    langPrefix: 'hljs language-', // Prefix for CSS classes
    pedantic: false,
    gfm: true,
    breaks: true, // Convert single line breaks to <br>
    sanitize: false, // Disable internal sanitization, use DOMPurify
    smartypants: false,
    xhtml: false
});

// --- Utility Functions ---
function getTimestamp() {
    return new Date().toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function sanitizeHTML(htmlString) {
    return DOMPurify.sanitize(htmlString, {
        USE_PROFILES: {html: true}, // Allow necessary tags for formatting and code blocks
        ADD_ATTR: ['target'], // Allow target="_blank" for links if needed later
    });
}

function handleCopyCode(button, codeContent) {
    navigator.clipboard.writeText(codeContent).then(() => {
        button.textContent = '已复制!';
        button.classList.add('bg-green-200');
        setTimeout(() => {
            button.textContent = '复制';
            button.classList.remove('bg-green-200');
        }, 2000);
    }, (err) => {
        button.textContent = '失败';
        button.classList.add('bg-red-200');
        console.error('复制失败: ', err);
        setTimeout(() => {
            button.textContent = '复制';
            button.classList.remove('bg-red-200');
        }, 2000);
    });
}

function addCopyButton(preElement) {
    if (preElement.querySelector('.copy-code-button')) return; // Don't add if exists

    const codeBlock = preElement.querySelector('code');
    if (!codeBlock) return;

    const copyBtn = document.createElement('button');
    copyBtn.textContent = '复制';
    copyBtn.className = 'copy-code-button'; // Use class defined in CSS
    copyBtn.onclick = (e) => {
        e.stopPropagation(); // Prevent triggering other clicks
        handleCopyCode(copyBtn, codeBlock.textContent);
    };
    preElement.appendChild(copyBtn);
}

function applyHighlightingAndCopyButtons(element) {
    element.querySelectorAll('pre').forEach((pre) => {
        const codeBlock = pre.querySelector('code');
        if (codeBlock && !codeBlock.classList.contains('hljs')) {
            // Check if already highlighted
            try {
                hljs.highlightElement(codeBlock);
            } catch (e) {
                console.error("Error applying highlightElement:", e, codeBlock.textContent);
            }
        }
        addCopyButton(pre); // Ensure copy button is added/updated
    });
}

function setStreamingState(streaming) {
    isStreaming = streaming;
    submitBtn.disabled = streaming;
    // Optionally change button text/style
    if (streaming) {
        submitBtn.innerHTML = `
            <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>处理中...</span>`;
    } else {
        submitBtn.innerHTML = `
            <span class="font-medium text-sm">发送</span>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>`;
    }
}

// --- RAG Functions ---
function loadRagOptions() {
    fetch('http://192.168.1.218:7080/api/v1/rag/query_rag_tag_list')
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.json();
        })
        .then(data => {
            if (data.code === '1000' && data.data) {
                // Clear existing options (keep the default)
                while (ragSelect.options.length > 1) {
                    ragSelect.remove(1);
                }
                // Add new options
                data.data.forEach(tag => {
                    const option = new Option(`知识库: ${tag}`, tag); // Show descriptive name
                    ragSelect.add(option);
                });
            } else {
                console.warn('Failed to load RAG tags or empty list:', data.msg || 'No data');
                // Maybe disable the RAG select or show a message
            }
        })
        .catch(error => {
            console.error('获取知识库列表失败:', error);
            // Handle error in UI, e.g., disable select, show error message
            ragSelect.disabled = true;
            const errorOption = new Option('加载知识库失败', '');
            errorOption.disabled = true;
            if (ragSelect.options.length <= 1) ragSelect.add(errorOption);
        });
}

// --- Chat Management Functions ---
function createNewChat() {
    if (isStreaming) return; // Don't create new chat while streaming

    const chatId = Date.now().toString();
    const defaultName = `聊天 ${getTimestamp()}`;
    const newChatData = {
        name: defaultName,
        messages: [],
        createdAt: new Date().toISOString() // Add creation timestamp
    };
    localStorage.setItem(`chat_${chatId}`, JSON.stringify(newChatData));
    currentChatId = chatId;
    localStorage.setItem('currentChatId', chatId);

    clearChatArea(); // Clear display first
    chatArea.style.display = 'none';// 隐藏聊天区域
    welcomeMessage.style.display = 'flex'; // Show welcome message for new chat
    updateChatList(); // Update list and highlight new chat
    messageInput.focus(); // Focus input for immediate typing
}

function deleteChat(chatId) {
    if (isStreaming) {
        alert("请等待当前回复完成后再删除聊天。");
        return;
    }
    if (confirm(`确定要删除聊天 "${getChatName(chatId)}"? 这个操作无法撤销。`)) {
        localStorage.removeItem(`chat_${chatId}`);
        if (currentChatId === chatId) {
            // Find the next available chat or create a new one
            const chatKeys = Object.keys(localStorage).filter(key => key.startsWith('chat_')).sort((a, b) => parseInt(b.split('_')[1]) - parseInt(a.split('_')[1])); // Sort newest first
            if (chatKeys.length > 0) {
                loadChat(chatKeys[0].split('_')[1]);
            } else {
                createNewChat(); // Create a new one if none left
            }
        } else {
            updateChatList(); // Just update the list if deleting a non-active chat
        }
    }
}

function getChatData(chatId) {
    try {
        const storedData = localStorage.getItem(`chat_${chatId}`);
        if (!storedData) return null; // Chat not found

        const chatData = JSON.parse(storedData);

        // --- Data Migration & Validation ---
        if (typeof chatData !== 'object' || chatData === null) {
            throw new Error("Invalid chat data structure (not an object)");
        }
        // Ensure essential fields exist and have correct types
        if (typeof chatData.name !== 'string') {
            chatData.name = `聊天 ${getTimestamp()}`; // Provide default name
            console.warn(`Chat ${chatId}: Missing or invalid name. Assigned default.`);
        }
        if (!Array.isArray(chatData.messages)) {
            chatData.messages = [];
            console.warn(`Chat ${chatId}: Missing or invalid 'messages' array. Resetting.`);
        } else {
            // Validate individual messages (optional, can be performance intensive)
            chatData.messages = chatData.messages.filter(msg => msg && typeof msg.content === 'string' && typeof msg.isAssistant === 'boolean');
        }
        if (typeof chatData.createdAt !== 'string') {
            chatData.createdAt = new Date(parseInt(chatId)).toISOString(); // Estimate from ID or set current
        }
        // If migrations occurred, save the updated data back
        if (JSON.stringify(chatData) !== storedData) {
            localStorage.setItem(`chat_${chatId}`, JSON.stringify(chatData));
        }
        // --- End Migration & Validation ---

        return chatData;

    } catch (error) {
        console.error(`Error parsing or validating chat data for ${chatId}:`, error);
        // Handle broken JSON - maybe offer to reset? For now, return null or default.
        localStorage.removeItem(`chat_${chatId}`); // Remove corrupted data
        // alert(`聊天记录 ${chatId} 损坏，已移除。`); // Inform user
        return null; // Indicate failure
    }
}


function getChatName(chatId) {
    const chatData = getChatData(chatId);
    return chatData ? chatData.name : `无效聊天 ${chatId}`;
}


function updateChatList() {
    chatList.innerHTML = ''; // Clear existing list
    const chatKeys = Object.keys(localStorage)
        .filter(key => key.startsWith('chat_'));

    // Sort chats, newest first based on ID (or createdAt if available)
    chatKeys.sort((a, b) => {
        const idA = parseInt(a.split('_')[1]);
        const idB = parseInt(b.split('_')[1]);
        // Potential: Use createdAt from chatData if available for more accurate sorting
        // const dataA = getChatData(idA.toString());
        // const dataB = getChatData(idB.toString());
        // const timeA = dataA?.createdAt ? new Date(dataA.createdAt).getTime() : idA;
        // const timeB = dataB?.createdAt ? new Date(dataB.createdAt).getTime() : idB;
        // return timeB - timeA; // Newest first
        return idB - idA; // Simple sort by ID (timestamp)
    });


    if (chatKeys.length === 0) {
        // Display a message if no chats exist?
        // chatList.innerHTML = '<li class="text-center text-gray-500 text-sm p-4">没有聊天记录</li>';
        return; // Nothing else to do
    }


    chatKeys.forEach(chatKey => {
        const chatId = chatKey.split('_')[1];
        const chatData = getChatData(chatId); // Use validated data

        if (!chatData) return; // Skip if data is invalid/corrupted

        const li = document.createElement('li');
        li.className = `chat-item flex items-center justify-between p-2 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors duration-150 ${chatId === currentChatId ? 'bg-blue-50 border border-blue-200' : ''}`;
        li.setAttribute('data-chat-id', chatId); // Add data attribute

        // Truncate long names or show preview
        const displayName = chatData.name.length > 25 ? chatData.name.substring(0, 22) + '...' : chatData.name;
        const lastMessage = chatData.messages.length > 0 ? chatData.messages[chatData.messages.length - 1].content : "尚无消息";
        const previewText = lastMessage.length > 30 ? lastMessage.substring(0, 27) + '...' : lastMessage;
        const displayDate = new Date(chatData.createdAt || parseInt(chatId)).toLocaleDateString('zh-CN', {
            month: '2-digit',
            day: '2-digit'
        });


        li.innerHTML = `
            <div class="flex-1 overflow-hidden pr-2" onclick="loadChat('${chatId}')">
                <div class="text-sm font-medium text-gray-800 truncate" title="${chatData.name}">${displayName}</div>
                <div class="text-xs text-gray-500 truncate" title="${lastMessage}">${displayDate} - ${previewText}</div>
            </div>
            <div class="chat-actions flex items-center gap-1 flex-shrink-0">
                <button class="p-1 hover:bg-gray-200 rounded text-gray-500" title="重命名" onclick="event.stopPropagation(); renameChat('${chatId}')">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                </button>
                <button class="p-1 hover:bg-red-100 rounded text-red-500 hover:text-red-600" title="删除" onclick="event.stopPropagation(); deleteChat('${chatId}')">
                     <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
            </div>
        `;
        // No need for mouseenter/leave if using group-hover (Tailwind) or the CSS :hover approach
        chatList.appendChild(li);
    });
}


function renameChat(chatId) {
    const chatData = getChatData(chatId);
    if (!chatData) {
        alert("无法重命名无效的聊天。");
        return;
    }

    const currentName = chatData.name;
    const newName = prompt('输入新的聊天名称:', currentName);

    if (newName && newName.trim() !== '' && newName !== currentName) {
        chatData.name = newName.trim();
        localStorage.setItem(`chat_${chatId}`, JSON.stringify(chatData));
        updateChatList(); // Update the list to show the new name
    }
}


function loadChat(chatId) {
    if (isStreaming) {
        alert("请等待当前回复完成后再切换聊天。");
        return;
    }
    if (chatId === currentChatId) return; // Do nothing if already loaded

    const chatData = getChatData(chatId);

    if (!chatData) {
        alert(`无法加载聊天 ${chatId}，数据可能已损坏或被删除。`);
        // Optionally remove the broken chat ID from currentChatId if it was set
        if (localStorage.getItem('currentChatId') === chatId) {
            localStorage.removeItem('currentChatId');
        }
        updateChatList(); // Refresh list to remove potentially broken item display
        // Maybe load the most recent valid chat?
        const chatKeys = Object.keys(localStorage).filter(key => key.startsWith('chat_')).sort((a, b) => parseInt(b.split('_')[1]) - parseInt(a.split('_')[1]));
        if (chatKeys.length > 0) {
            loadChat(chatKeys[0].split('_')[1]);
        } else {
            createNewChat();
        }
        return;
    }


    currentChatId = chatId;
    localStorage.setItem('currentChatId', chatId);
    clearChatArea(); // Clear display

    if (chatData.messages.length === 0) {
        welcomeMessage.style.display = 'flex'; // Show welcome if chat is empty
        chatArea.style.display = 'none';    // 隐藏聊天区域
    } else {
        welcomeMessage.style.display = 'none'; // Hide welcome if chat has messages
        chatArea.style.display = 'block'; // 或者 'flex'，取决于 chatArea 的内部布局需求，'block' 通常足够
        chatData.messages.forEach(msg => {
            // appendMessage handles validation internally now, but basic check is good
            if (msg && typeof msg.content === 'string' && typeof msg.isAssistant === 'boolean') {
                appendMessage(msg.content, msg.isAssistant, false); // Don't re-save during load
            } else {
                console.warn("Skipping invalid message structure during load:", msg);
            }
        });
        // Scroll to bottom after loading all messages
        // Use requestAnimationFrame for smoother scroll after elements render
        requestAnimationFrame(() => {
            chatArea.scrollTop = chatArea.scrollHeight;
        });
    }
    updateChatList(); // Highlight the selected chat in the list
    messageInput.focus();
}

function clearChatArea() {
    chatArea.innerHTML = ''; // Clear all messages
    // Re-add welcome message structure? No, let loadChat or createNewChat handle visibility.
    // welcomeMessage.style.display = 'none'; // Hide initially
}

// --- Message Handling ---
function appendMessage(content, isAssistant = false, saveToStorage = true) {
    // 如果 chatArea 是隐藏的，说明现在显示的是 welcomeMessage，需要切换
    if (chatArea.style.display === 'none') {
        chatArea.style.display = 'block'; // 或者 'flex'
        welcomeMessage.style.display = 'none';
    }

    const messageWrapper = document.createElement('div');
    messageWrapper.className = `flex w-full mb-4 message-bubble ${isAssistant ? 'justify-start' : 'justify-end'}`;

    const bubbleContainer = document.createElement('div');
    bubbleContainer.className = `flex gap-3 ${isAssistant ? 'max-w-4xl w-full' : 'max-w-lg'}`; // Allow AI bubble to grow

    if (isAssistant) {
        // --- Assistant Message: Parse content for <think> tags ---
        const thinkRegex = /<think>(.*?)<\/think>/gs;
        let thinkingSteps = '';
        let match;
        const localThinkRegex = /<think>(.*?)<\/think>/gs; // Use new instance
        while ((match = localThinkRegex.exec(content)) !== null) {
            thinkingSteps += match[1] + '\n';
        }
        thinkingSteps = thinkingSteps.trim();
        // Remove think tags to get the final answer part
        const finalAnswer = content.replace(/<think>.*?<\/think>/gs, '').trim();

        // --- Create Bubble Structure ---
        bubbleContainer.innerHTML = `
            <div class="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
                <span class="text-green-600 text-sm font-semibold">AI</span>
            </div>
            <div class="message-content-wrapper bg-white border border-gray-200 px-4 py-3 rounded-lg shadow-sm min-w-[80px] flex-grow">
                {/* Content structure determined below */}
            </div>
        `;
        const bubble = bubbleContainer.querySelector('.message-content-wrapper');

        if (thinkingSteps) {
            // Render with <details> structure if thinking steps exist
            bubble.innerHTML = `
                <details class="thinking-process"> 
                    <summary class="cursor-pointer text-sm text-gray-600 hover:text-gray-800 mb-2 focus:outline-none select-none">
                        思考过程 <span class="text-xs opacity-70">(来自历史记录)</span>
                    </summary>
                    <div class="thinking-steps-content markdown-body border-t border-gray-100 pt-2 pl-2 text-xs opacity-80">
                        ${sanitizeHTML(marked.parse(thinkingSteps))}
                    </div>
                </details>
                <div class="final-answer markdown-body pt-3">
                    ${finalAnswer ? sanitizeHTML(marked.parse(finalAnswer)) : ''}
                </div>
            `;
        } else {
            // Render normally (only final answer) if no thinking steps
            bubble.classList.add('markdown-body'); // Apply markdown styles directly
            bubble.innerHTML = finalAnswer ? sanitizeHTML(marked.parse(finalAnswer)) : '';
        }
        // Apply highlighting & copy buttons *after* setting innerHTML
        applyHighlightingAndCopyButtons(bubble);

    } else {
        // --- User Message (No changes needed) ---
        bubbleContainer.innerHTML = `
            <div class="message-content-wrapper bg-blue-500 text-white px-4 py-3 rounded-lg shadow-sm">
                </div>
        `;
        const bubble = bubbleContainer.querySelector('.message-content-wrapper');
        bubble.textContent = content; // User messages as plain text
    }

    messageWrapper.appendChild(bubbleContainer);
    chatArea.appendChild(messageWrapper);

    // Scroll to bottom - Handled by loadChat which calls this repeatedly.
    // Keep this scroll for cases where appendMessage is called individually?
    // requestAnimationFrame(() => {
    //     chatArea.scrollTo({ top: chatArea.scrollHeight, behavior: 'smooth' });
    // });


    // Save to local storage (only if explicitly told to)
    if (saveToStorage && currentChatId) {
        const chatData = getChatData(currentChatId);
        if (chatData) {
            if (typeof content === 'string' && typeof isAssistant === 'boolean') {
                // Save the original content, including <think> tags if present
                chatData.messages.push({content, isAssistant});
                localStorage.setItem(`chat_${currentChatId}`, JSON.stringify(chatData));
                updateChatList(); // Update preview
            } else {
                console.error("Attempted to save invalid message data:", {content, isAssistant});
            }
        } else {
            console.error(`Failed to save message: Chat ${currentChatId} data not found or invalid.`);
        }
    }
}

// --- REMOVE or COMMENT OUT these lines near the top ---
// const THINKING_MODELS = ['deepseek-r1:70b'];
// function isThinkingModel(modelName) {
//     return THINKING_MODELS.includes(modelName);
// }

function startEventStream(message) {
    if (isStreaming) return;
    if (!currentChatId) {
        console.error("Cannot start stream without a current chat ID.");
        return;
    }
    setStreamingState(true);

    if (currentEventSource) {
        currentEventSource.close();
    }

    const selectedRagTag = ragSelect.value; // Keep RAG selection logic
    const selectedAiModelValue = aiModelSelect.value;
    const selectedAiModelName = aiModelSelect.options[aiModelSelect.selectedIndex].getAttribute('model');

    if (!selectedAiModelName) {
        console.error("No AI model name selected!");
        setStreamingState(false);
        appendMessage("错误：未选择有效的 AI 模型。", true, false);
        return;
    }

    // --- WORKAROUND START ---
    // 1. Get chat history
    const chatData = getChatData(currentChatId);
    const history = chatData ? chatData.messages : [];

    // 2. Format history into a single string to prepend
    let historyString = "";
    // Limit history length to avoid excessively long URLs (adjust maxHistory as needed)
    const maxHistory = 10; // Example: Keep last 10 messages
    const startIndex = Math.max(0, history.length - maxHistory);

    for (let i = startIndex; i < history.length; i++) {
        const msg = history[i];
        if (typeof msg.content === 'string' && typeof msg.isAssistant === 'boolean') {
            // Important: Exclude <think> tags from the history string sent to the model
            // unless your model is specifically trained to handle them as part of the prompt.
            // Usually, you only want the actual conversation turns.
            const contentWithoutThink = msg.content.replace(/<think>.*?<\/think>/gs, '').trim();
            if (contentWithoutThink) { // Only add if there's actual content after removing think tags
                historyString += (msg.isAssistant ? "Assistant: " : "User: ") + contentWithoutThink + "\n";
            }
        }
    }

    // 3. Prepend history to the current message
    const combinedMessage = historyString + "User: " + message; // Clearly mark the new message
    // --- WORKAROUND END ---


    let url;
    const base = `http://192.168.1.218:7080/api/v1/${selectedAiModelValue}`;

    // --- Send the COMBINED message in the 'message' parameter ---
    const params = new URLSearchParams({
        // Send the combined history+current message string
        message: combinedMessage,
        model: selectedAiModelName
        // NO 'history' parameter here
    });

    if (selectedRagTag) {
        params.append('ragTag', selectedRagTag);
        // Decide how RAG interacts with history prepending.
        // Does the backend RAG process need the raw message or the combined one?
        // Assuming backend handles RAG based on the full 'message' param for now.
        url = `${base}/generate_stream_rag?${params.toString()}`;
    } else {
        url = `${base}/generate_stream?${params.toString()}`;
    }
    // --- END MODIFICATION ---

    console.log("Streaming URL (Workaround):", url); // URL will have a long 'message' param
    console.log("Combined Message sent:", combinedMessage); // Log the combined string

    currentEventSource = new EventSource(url);
    let accumulatedContent = '';
    let tempMessageWrapper = null;
    let streamEnded = false;
    const messageId = `ai-message-${Date.now()}`;

    // --- Create Unified Placeholder ---
    if (chatArea.style.display === 'none') {
        chatArea.style.display = 'block';
        welcomeMessage.style.display = 'none';
    }
    tempMessageWrapper = document.createElement('div');
    tempMessageWrapper.className = 'flex w-full mb-4 message-bubble justify-start';
    tempMessageWrapper.id = messageId;
    tempMessageWrapper.innerHTML = `
        <div class="flex gap-3 max-w-4xl w-full">
             <div class="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
                <span class="text-green-600 text-sm font-semibold">AI</span>
            </div>
            <div class="message-content-wrapper bg-white border border-gray-200 px-4 py-3 rounded-lg shadow-sm min-w-[80px] flex-grow markdown-body">
                 <span class="streaming-cursor animate-pulse">▋</span>
            </div>
        </div>
    `;
    chatArea.appendChild(tempMessageWrapper);
    let messageContentWrapper = tempMessageWrapper.querySelector('.message-content-wrapper');
    let hasInjectedDetails = false;
    requestAnimationFrame(() => {
        chatArea.scrollTop = chatArea.scrollHeight;
    });


    // The rest of the onmessage, onerror, DOM handling logic remains the same
    // as in the previous snippet. The AI's response (accumulatedContent)
    // is still processed and displayed identically.
    currentEventSource.onmessage = function (event) {
        // ... (SAME onmessage logic as before - handling stream data, <think> tags, DOM updates) ...
        if (streamEnded) return;

        try {
            const data = JSON.parse(event.data);

            if (data.result?.output?.text !== undefined) {
                const newContent = data.result.output.text ?? '';
                accumulatedContent += newContent;

                // --- Process Accumulated Content ---
                const thinkRegex = /<think>(.*?)<\/think>/gs;
                let thinkingSteps = '';
                let match;
                const localThinkRegex = /<think>(.*?)<\/think>/gs;
                while ((match = localThinkRegex.exec(accumulatedContent)) !== null) {
                    thinkingSteps += match[1] + '\n';
                }
                thinkingSteps = thinkingSteps.trim();
                const finalAnswer = accumulatedContent.replace(/<think>.*?<\/think>/gs, '').trim();

                // --- Update DOM Dynamically ---
                messageContentWrapper = document.getElementById(messageId)?.querySelector('.message-content-wrapper');
                if (!messageContentWrapper) {
                    console.error("Message wrapper not found!");
                    return;
                }

                if (thinkingSteps && !hasInjectedDetails) {
                    messageContentWrapper.innerHTML = `
                        <details class="thinking-process" open>
                            <summary class="cursor-pointer text-sm text-gray-600 hover:text-gray-800 mb-2 focus:outline-none select-none">
                                思考过程... <span class="text-xs opacity-70">(点击展开/折叠)</span>
                            </summary>
                            <div class="thinking-steps-content markdown-body border-t border-gray-100 pt-2 pl-2 text-xs opacity-80 min-h-[20px]">

                            </div>
                        </details>
                        <div class="final-answer markdown-body pt-3">

                        </div>
                    `;
                    hasInjectedDetails = true;
                }

                // --- Populate Content ---
                if (hasInjectedDetails) {
                    const thinkingStepsDiv = messageContentWrapper.querySelector('.thinking-steps-content');
                    const finalAnswerDiv = messageContentWrapper.querySelector('.final-answer');

                    if (thinkingStepsDiv) {
                        thinkingStepsDiv.innerHTML = sanitizeHTML(marked.parse(thinkingSteps + '<span class="streaming-cursor animate-pulse">▋</span>'));
                        applyHighlightingAndCopyButtons(thinkingStepsDiv);
                    }
                    if (finalAnswerDiv) {
                        finalAnswerDiv.innerHTML = finalAnswer
                            ? sanitizeHTML(marked.parse(finalAnswer))
                            : '<span class="text-gray-400 text-sm">正在处理...</span>';
                        applyHighlightingAndCopyButtons(finalAnswerDiv);
                    }
                } else {
                    messageContentWrapper.innerHTML = sanitizeHTML(marked.parse(finalAnswer + '<span class="streaming-cursor animate-pulse">▋</span>'));
                    applyHighlightingAndCopyButtons(messageContentWrapper);
                }

                requestAnimationFrame(() => {
                    chatArea.scrollTop = chatArea.scrollHeight;
                });
            }

            // --- Handle Stream End ---
            if (data.result?.metadata?.finishReason === 'stop' || data.result?.metadata?.finishReason === 'STOP') {
                streamEnded = true;
                currentEventSource.close();

                // --- Final Processing of accumulatedContent ---
                const thinkRegex = /<think>(.*?)<\/think>/gs;
                let finalThinkingSteps = '';
                let match;
                const localThinkRegex = /<think>(.*?)<\/think>/gs; // Use new instance
                while ((match = localThinkRegex.exec(accumulatedContent)) !== null) {
                    finalThinkingSteps += match[1] + '\n';
                }
                finalThinkingSteps = finalThinkingSteps.trim();
                const finalFinalAnswer = accumulatedContent.replace(/<think>.*?<\/think>/gs, '').trim();

                // --- Final DOM Update ---
                messageContentWrapper = document.getElementById(messageId)?.querySelector('.message-content-wrapper');
                if (!messageContentWrapper) {
                    console.error("Message wrapper not found for final update!");
                    return;
                }

                messageContentWrapper.querySelectorAll('.streaming-cursor').forEach(c => c.remove());

                if (finalThinkingSteps) {
                    if (!hasInjectedDetails) {
                        messageContentWrapper.innerHTML = `
                            <details class="thinking-process" open>
                                <summary>思考过程 <span class="text-xs opacity-70">(来自历史记录)</span></summary>
                                <div class="thinking-steps-content markdown-body border-t border-gray-100 pt-2 pl-2 text-xs opacity-80"></div>
                            </details>
                            <div class="final-answer markdown-body pt-3"></div>
                         `;
                        hasInjectedDetails = true;
                    }
                    const thinkingStepsDiv = messageContentWrapper.querySelector('.thinking-steps-content');
                    const finalAnswerDiv = messageContentWrapper.querySelector('.final-answer');

                    if (thinkingStepsDiv) {
                        thinkingStepsDiv.innerHTML = sanitizeHTML(marked.parse(finalThinkingSteps));
                        applyHighlightingAndCopyButtons(thinkingStepsDiv);
                    } else {
                        console.error("Thinking steps div not found in final update!");
                    }

                    if (finalAnswerDiv) {
                        finalAnswerDiv.innerHTML = finalFinalAnswer ? sanitizeHTML(marked.parse(finalFinalAnswer)) : '';
                        applyHighlightingAndCopyButtons(finalAnswerDiv);
                    } else {
                        console.error("Final answer div not found in final update!");
                    }
                    // Update summary text after completion
                    const summaryElement = messageContentWrapper.querySelector('.thinking-process summary');
                    if (summaryElement) summaryElement.innerHTML = `思考过程 <span class="text-xs opacity-70">(点击展开/折叠)</span>`;


                } else {
                    messageContentWrapper.innerHTML = finalFinalAnswer ? sanitizeHTML(marked.parse(finalFinalAnswer)) : '';
                    if (!hasInjectedDetails) {
                        messageContentWrapper.classList.add('markdown-body');
                    }
                    applyHighlightingAndCopyButtons(messageContentWrapper);
                }

                // --- Save the complete message (including <think> tags) ---
                // IMPORTANT: Even with the workaround, save the ORIGINAL AI response
                // (accumulatedContent) to localStorage, *including* any <think> tags,
                // so the history display remains accurate. Don't save the combinedMessage.
                if (currentChatId && accumulatedContent.trim()) {
                    const chatData = getChatData(currentChatId);
                    if (chatData) {
                        chatData.messages.push({content: accumulatedContent, isAssistant: true});
                        localStorage.setItem(`chat_${currentChatId}`, JSON.stringify(chatData));
                        updateChatList();
                    }
                }

                currentEventSource = null;
                setStreamingState(false);
                messageInput.focus();
            }
        } catch (e) {
            console.error('Error processing stream event:', e, event.data);
        }

    };

    currentEventSource.onerror = function (error) {
        // ... (SAME onerror logic as before) ...
        console.error('EventSource encountered an error:', error);
        streamEnded = true;
        if (currentEventSource) {
            currentEventSource.close();
        }

        const errorText = '--- 抱歉，连接中断或发生错误 ---';
        messageContentWrapper = document.getElementById(messageId)?.querySelector('.message-content-wrapper');
        if (messageContentWrapper) {
            messageContentWrapper.querySelectorAll('.streaming-cursor').forEach(c => c.remove());
            const errorP = document.createElement('p');
            errorP.className = 'text-red-500 text-sm font-semibold mt-2 border-t pt-2';
            errorP.textContent = errorText;

            const finalAnswerDiv = messageContentWrapper.querySelector('.final-answer');
            if (finalAnswerDiv) {
                if (finalAnswerDiv.textContent.includes("正在处理")) finalAnswerDiv.innerHTML = '';
                finalAnswerDiv.appendChild(errorP);
            } else {
                if (messageContentWrapper.textContent === '▋') messageContentWrapper.innerHTML = '';
                messageContentWrapper.appendChild(errorP);
            }
            // Update summary text in case of error during thinking display
            const summaryElement = messageContentWrapper.querySelector('.thinking-process summary');
            if (summaryElement && summaryElement.textContent.includes("思考过程...")) {
                summaryElement.innerHTML = `思考过程 <span class="text-xs opacity-70">(已中断)</span>`;
            }

        } else {
            appendMessage(errorText, true, false);
        }

        currentEventSource = null;
        setStreamingState(false);
        messageInput.focus();
    };
}

function sendMessage() {
    if (isStreaming) return; // Extra check

    const message = messageInput.value.trim();
    if (!message) return;

    if (!currentChatId) {
        createNewChat(); // Create a chat if none exists
        // Wait a tiny moment for the chat ID to be set before proceeding
        setTimeout(() => {
            appendMessage(message, false, true); // Save user message
            startEventStream(message);
        }, 50);
    } else {
        appendMessage(message, false, true); // Save user message
        startEventStream(message);
    }

    messageInput.value = ''; // Clear input field
    messageInput.style.height = 'auto'; // Reset height after sending
}


// --- UI Event Listeners ---
submitBtn.addEventListener('click', sendMessage);

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault(); // Prevent default newline insertion
        sendMessage();
    }
});

// Auto-resize textarea
messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto'; // Reset height
    messageInput.style.height = `${Math.min(messageInput.scrollHeight, 250)}px`; // Set new height, capped at 250px
});


newChatBtn.addEventListener('click', createNewChat);

toggleSidebarBtn.addEventListener('click', () => {
    sidebar.classList.toggle('-translate-x-full');
    // No need for updateSidebarIcon function if using translate
});

// Dropdown Menu Logic
uploadMenuButton.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent document click listener from closing immediately
    uploadMenu.classList.toggle('hidden');
    uploadMenu.classList.toggle('active');
});

document.addEventListener('click', (e) => {
    // Close dropdown if clicked outside
    if (!uploadMenu.classList.contains('hidden') && !uploadMenu.contains(e.target) && e.target !== uploadMenuButton && !uploadMenuButton.contains(e.target)) {
        uploadMenu.classList.add('hidden');
        uploadMenu.classList.remove('active');
    }
    // Close sidebar on mobile if clicked outside
    if (!sidebar.classList.contains('-translate-x-full') && window.innerWidth < 768 && !sidebar.contains(e.target) && e.target !== toggleSidebarBtn && !toggleSidebarBtn.contains(e.target)) {
        sidebar.classList.add('-translate-x-full');
    }
});

// Close dropdown when an item is clicked (optional)
uploadMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
        uploadMenu.classList.add('hidden');
        uploadMenu.classList.remove('active');
    });
});


// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    loadRagOptions(); // Load RAG options on page load

    // Determine initial chat to load
    const savedChatId = localStorage.getItem('currentChatId');
    const chatKeys = Object.keys(localStorage).filter(key => key.startsWith('chat_'));

    if (savedChatId && chatKeys.includes(`chat_${savedChatId}`)) {
        loadChat(savedChatId);
    } else if (chatKeys.length > 0) {
        // Sort by ID (timestamp) and load the newest one if currentChatId is invalid
        chatKeys.sort((a, b) => parseInt(b.split('_')[1]) - parseInt(a.split('_')[1]));
        loadChat(chatKeys[0].split('_')[1]);
    } else {
        createNewChat(); // Create a new chat if none exist at all
    }

    // Initial sidebar state for mobile
    if (window.innerWidth < 768) {
        sidebar.classList.add('-translate-x-full');
    } else {
        sidebar.classList.remove('-translate-x-full');
    }

    messageInput.focus();
});

// Responsive Sidebar Handling (Optional: better handled by Tailwind md: prefixes)
/*
window.addEventListener('resize', () => {
    if (window.innerWidth >= 768) {
        sidebar.classList.remove('-translate-x-full'); // Ensure visible on desktop
    } else {
       // Don't automatically hide on resize down, user might have opened it
    }
});
*/