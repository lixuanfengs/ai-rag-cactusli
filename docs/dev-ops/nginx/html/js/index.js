const chatArea = document.getElementById('chatArea');
const messageInput = document.getElementById('messageInput');
const submitBtn = document.getElementById('submitBtn');
const newChatBtn = document.getElementById('newChatBtn');
const chatList = document.getElementById('chatList');
const welcomeMessage = document.getElementById('welcomeMessage');
const toggleSidebarBtn = document.getElementById('toggleSidebar');
const sidebar = document.getElementById('sidebar');
let currentEventSource = null;
let currentChatId = null;

// 获取知识库列表
document.addEventListener('DOMContentLoaded', function() {
    // 获取知识库列表
    const loadRagOptions = () => {
        const ragSelect = document.getElementById('ragSelect');

        fetch('http://localhost:8090/api/v1/rag/query_rag_tag_list')
            .then(response => response.json())
            .then(data => {
                if (data.code === '0000' && data.data) {
                    // 清空现有选项（保留第一个默认选项）
                    while (ragSelect.options.length > 1) {
                        ragSelect.remove(1);
                    }

                    // 添加新选项
                    data.data.forEach(tag => {
                        const option = new Option(`Rag：${tag}`, tag);
                        ragSelect.add(option);
                    });
                }
            })
            .catch(error => {
                console.error('获取知识库列表失败:', error);
            });
    };

    // 初始化加载
    loadRagOptions();
});

function createNewChat() {
    const chatId = Date.now().toString();
    currentChatId = chatId;
    localStorage.setItem('currentChatId', chatId);
    // 修改数据结构为包含name和messages的对象
    localStorage.setItem(`chat_${chatId}`, JSON.stringify({
        name: '新聊天',
        messages: []
    }));
    updateChatList();
    clearChatArea();
}

function deleteChat(chatId) {
    if (confirm('确定要删除这个聊天记录吗？')) {
        localStorage.removeItem(`chat_${chatId}`); // Remove the chat from localStorage
        if (currentChatId === chatId) { // If the current chat is being deleted
            createNewChat(); // Create a new chat
        }
        updateChatList(); // Update the chat list to reflect changes
    }
}

function updateChatList() {
    chatList.innerHTML = '';
    const chats = Object.keys(localStorage)
      .filter(key => key.startsWith('chat_'));

    const currentChatIndex = chats.findIndex(key => key.split('_')[1] === currentChatId);
    if (currentChatIndex!== -1) {
        const currentChat = chats[currentChatIndex];
        chats.splice(currentChatIndex, 1);
        chats.unshift(currentChat);
    }

    chats.forEach(chatKey => {
        let chatData = JSON.parse(localStorage.getItem(chatKey));
        const chatId = chatKey.split('_')[1];

        // 数据迁移：将旧数组格式转换为新对象格式
        if (Array.isArray(chatData)) {
            chatData = {
                name: `聊天 ${new Date(parseInt(chatId)).toLocaleDateString()}`,
                messages: chatData
            };
            localStorage.setItem(chatKey, JSON.stringify(chatData));
        }

        const li = document.createElement('li');
        li.className = `chat-item flex items-center justify-between p-2 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors ${chatId === currentChatId? 'bg-blue-50' : ''}`;
        li.innerHTML = `
            <div class="flex-1">
                <div class="text-sm font-medium">${chatData.name}</div>
                <div class="text-xs text-gray-400">${new Date(parseInt(chatId)).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })}</div>
            </div>
            <div class="chat-actions flex items-center gap-1 opacity-0 transition-opacity duration-200">
                <button class="p-1 hover:bg-gray-200 rounded text-gray-500" onclick="renameChat('${chatId}')">重命名</button>
                <button class="p-1 hover:bg-red-200 rounded text-red-500" onclick="deleteChat('${chatId}')">删除</button>
            </div>
        `;
        li.addEventListener('click', (e) => {
            if (!e.target.closest('.chat-actions')) {
                loadChat(chatId);
            }
        });
        li.addEventListener('mouseenter', () => {
            li.querySelector('.chat-actions').classList.remove('opacity-0');
        });
        li.addEventListener('mouseleave', () => {
            li.querySelector('.chat-actions').classList.add('opacity-0');
        });
        chatList.appendChild(li);
    });
}

let currentContextMenu = null;
// 优化后的上下文菜单
function showChatContextMenu(event, chatId) {
    event.stopPropagation();
    closeContextMenu();

    const buttonRect = event.target.closest('button').getBoundingClientRect();
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.position = 'fixed';
    menu.style.left = `${buttonRect.left}px`;
    menu.style.top = `${buttonRect.bottom + 4}px`;

    menu.innerHTML = `
        <div class="context-menu-item" onclick="renameChat('${chatId}')">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
            重命名
        </div>
        <div class="context-menu-item text-red-500" onclick="deleteChat('${chatId}')">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
            删除
        </div>
    `;

    document.body.appendChild(menu);
    currentContextMenu = menu;

    // 点击外部关闭菜单
    setTimeout(() => {
        document.addEventListener('click', closeContextMenu, { once: true });
    });
}

function closeContextMenu() {
    if (currentContextMenu) {
        currentContextMenu.remove();
        currentContextMenu = null;
    }
}

function renameChat(chatId) {
    const chatKey = `chat_${chatId}`;
    const chatData = JSON.parse(localStorage.getItem(chatKey));
    const currentName = chatData.name || `聊天 ${new Date(parseInt(chatId)).toLocaleString()}`;
    const newName = prompt('请输入新的聊天名称', currentName);

    if (newName) {
        chatData.name = newName;
        localStorage.setItem(chatKey, JSON.stringify(chatData));
        updateChatList();
    }
}

function loadChat(chatId) {
    currentChatId = chatId;
    localStorage.setItem('currentChatId', chatId);
    clearChatArea();
    const chatData = JSON.parse(localStorage.getItem(`chat_${chatId}`) || { messages: [] });
    chatData.messages.forEach(msg => {
        appendMessage(msg.content, msg.isAssistant, false);
    });
    updateChatList()
}

function clearChatArea() {
    chatArea.innerHTML = '';
    welcomeMessage.style.display = 'flex';
}

function appendMessage(content, isAssistant = false, saveToStorage = true) {
    welcomeMessage.style.display = 'none';
    const messageDiv = document.createElement('div');
    messageDiv.className = `max-w-4xl mx-auto mb-4 p-4 rounded-lg ${isAssistant ? 'bg-gray-100' : 'bg-white border'} markdown-body relative`;

    const renderedContent = DOMPurify.sanitize(marked.parse(content));
    messageDiv.innerHTML = renderedContent;

    // 添加复制按钮
    const copyBtn = document.createElement('button');
    copyBtn.className = 'absolute top-2 right-2 p-1 bg-gray-200 rounded-md text-xs';
    copyBtn.textContent = '复制';
    copyBtn.onclick = () => {
        navigator.clipboard.writeText(content).then(() => {
            copyBtn.textContent = '已复制';
            setTimeout(() => copyBtn.textContent = '复制', 2000);
        });
    };
    messageDiv.appendChild(copyBtn);

    chatArea.appendChild(messageDiv);
    chatArea.scrollTop = chatArea.scrollHeight;

    // 仅在需要时保存到本地存储
    if (saveToStorage && currentChatId) {
        // 确保读取和保存完整的数据结构
        const chatData = JSON.parse(localStorage.getItem(`chat_${currentChatId}`) || '{"name": "新聊天", "messages": []}');
        chatData.messages.push({ content, isAssistant });
        localStorage.setItem(`chat_${currentChatId}`, JSON.stringify(chatData));
    }
}

 function startEventStream(message) {
    if (currentEventSource) {
        currentEventSource.close();
    }

    // 选项值，
    // 组装01；http://localhost:8090/api/v1/ollama/generate_stream?message=Hello&model=deepseek-r1:1.5b
    // 组装02；http://localhost:8090/api/v1/openai/generate_stream?message=Hello&model=gpt-4o
    const ragTag = document.getElementById('ragSelect').value;
    const aiModelSelect = document.getElementById('aiModel');
    const aiModelValue = aiModelSelect.value; // 获取选中的 aiModel 的 value
    const aiModelModel = aiModelSelect.options[aiModelSelect.selectedIndex].getAttribute('model'); // 获取选中的 aiModel 的 model 属性

    let url;

    if (ragTag) {
        url = `http://localhost:8090/api/v1/${aiModelValue}/generate_stream_rag?message=${encodeURIComponent(message)}&ragTag=${encodeURIComponent(ragTag)}&model=${encodeURIComponent(aiModelModel)}`;
    } else {
        url = `http://localhost:8090/api/v1/${aiModelValue}/generate_stream?message=${encodeURIComponent(message)}&model=${encodeURIComponent(aiModelModel)}`;
    }

    currentEventSource = new EventSource(url);
    let accumulatedContent = '';
    let tempMessageDiv = null;

    currentEventSource.onmessage = function(event) {
        try {
            const data = JSON.parse(event.data);

            if (data.result?.output?.content) {
                const newContent = data.result.output.content;
                accumulatedContent += newContent;

                // 首次创建临时消息容器
                if (!tempMessageDiv) {
                    tempMessageDiv = document.createElement('div');
                    tempMessageDiv.className = 'max-w-4xl mx-auto mb-4 p-4 rounded-lg bg-gray-100 markdown-body relative';
                    chatArea.appendChild(tempMessageDiv);
                    welcomeMessage.style.display = 'none';
                }

                // 直接更新文本内容（先不解析Markdown）
                tempMessageDiv.textContent = accumulatedContent;
                chatArea.scrollTop = chatArea.scrollHeight;
            }

            if (data.result?.output?.properties?.finishReason === 'STOP') {
                currentEventSource.close();

                // 流式传输完成后进行最终渲染
                const finalContent = accumulatedContent;
                tempMessageDiv.innerHTML = DOMPurify.sanitize(marked.parse(finalContent));

                // 添加复制按钮
                const copyBtn = document.createElement('button');
                copyBtn.className = 'absolute top-2 right-2 p-1 bg-gray-200 rounded-md text-xs';
                copyBtn.textContent = '复制';
                copyBtn.onclick = () => {
                    navigator.clipboard.writeText(finalContent).then(() => {
                        copyBtn.textContent = '已复制';
                        setTimeout(() => copyBtn.textContent = '复制', 2000);
                    });
                };
                tempMessageDiv.appendChild(copyBtn);

                // 保存到本地存储
                if (currentChatId) {
                    // 正确的数据结构应该是对象包含messages数组
                    const chatData = JSON.parse(localStorage.getItem(`chat_${currentChatId}`) || '{"name": "新聊天", "messages": []}');
                    chatData.messages.push({ content: finalContent, isAssistant: true });
                    localStorage.setItem(`chat_${currentChatId}`, JSON.stringify(chatData));
                }
            }
        } catch (e) {
            console.error('Error parsing event data:', e);
        }
    };

    currentEventSource.onerror = function(error) {
        console.error('EventSource error:', error);
        currentEventSource.close();
    };
}

submitBtn.addEventListener('click', () => {
    const message = messageInput.value.trim();
    if (!message) return;

    if (!currentChatId) {
        createNewChat();
    }

    appendMessage(message, false);
    messageInput.value = '';
    startEventStream(message);
});

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitBtn.click();
    }
});

newChatBtn.addEventListener('click', createNewChat);

toggleSidebarBtn.addEventListener('click', () => {
    sidebar.classList.toggle('-translate-x-full');
    updateSidebarIcon();
});

function updateSidebarIcon() {
    const iconPath = document.getElementById('sidebarIconPath');
    if (sidebar.classList.contains('-translate-x-full')) {
        iconPath.setAttribute('d', 'M4 6h16M4 12h4m12 0h-4M4 18h16');
    } else {
        iconPath.setAttribute('d', 'M4 6h16M4 12h16M4 18h16');
    }
}

// Initialize
updateChatList();
const savedChatId = localStorage.getItem('currentChatId');
if (savedChatId) {
    loadChat(savedChatId);
}

// Handle window resize for responsive design
window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
        sidebar.classList.remove('-translate-x-full');
    } else {
        sidebar.classList.add('-translate-x-full');
    }
});

// Initial check for mobile devices
if (window.innerWidth <= 768) {
    sidebar.classList.add('-translate-x-full');
}

updateSidebarIcon();

// 上传知识下拉菜单控制
const uploadMenuButton = document.getElementById('uploadMenuButton');
const uploadMenu = document.getElementById('uploadMenu');

// 切换菜单显示
uploadMenuButton.addEventListener('click', (e) => {
    e.stopPropagation();
    uploadMenu.classList.toggle('hidden');
});

// 点击外部区域关闭菜单
document.addEventListener('click', (e) => {
    if (!uploadMenu.contains(e.target) && e.target !== uploadMenuButton) {
        uploadMenu.classList.add('hidden');
    }
});

// 菜单项点击后关闭菜单
document.querySelectorAll('#uploadMenu a').forEach(item => {
    item.addEventListener('click', () => {
        uploadMenu.classList.add('hidden');
    });
});
