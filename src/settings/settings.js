// --- 提供商配置 ---
const PROVIDER_CONFIG = {
    openai: {
        name: 'OpenAI',
        needApiKey: true,
        needServerUrl: false,
        apiKeyLabel: 'OpenAI API Key',
        apiKeyPlaceholder: 'sk-...',
        apiKeyHelp: 'https://platform.openai.com/api-keys',
        modelsEndpoint: 'https://api.openai.com/v1/models',
        modelsFilter: (models) => models.data.filter(m => 
            m.id.includes('gpt') && !m.id.includes('realtime')
        ),
        apiFormat: 'openai'
    },
    anthropic: {
        name: 'Anthropic Claude',
        needApiKey: true,
        needServerUrl: false,
        apiKeyLabel: 'Anthropic API Key',
        apiKeyPlaceholder: 'sk-ant-...',
        apiKeyHelp: 'https://console.anthropic.com/',
        modelsEndpoint: 'https://api.anthropic.com/v1/messages',
        modelsFilter: null, // Claude有固定的模型列表
        fixedModels: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
        apiFormat: 'anthropic'
    },
    google: {
        name: 'Google AI',
        needApiKey: true,
        needServerUrl: false,
        apiKeyLabel: 'Google AI API Key',
        apiKeyPlaceholder: 'AIza...',
        apiKeyHelp: 'https://aistudio.google.com/app/apikey',
        modelsEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
        modelsFilter: (models) => models.filter(m => 
            m.supportedGenerationMethods.includes('generateContent')
        ),
        apiFormat: 'google'
    },
    microsoft: {
        name: 'Microsoft Azure',
        needApiKey: true,
        needServerUrl: true,
        apiKeyLabel: 'Azure API Key',
        apiKeyPlaceholder: 'Your Azure API Key',
        apiKeyHelp: 'https://portal.azure.com/',
        serverUrlLabel: 'Azure Endpoint',
        serverUrlPlaceholder: 'https://your-resource.openai.azure.com/',
        serverUrlHelp: 'https://learn.microsoft.com/en-us/azure/ai-services/openai/',
        modelsEndpoint: null, // 需要从 Azure 获取
        apiFormat: 'azure'
    },
    openrouter: {
        name: 'OpenRouter',
        needApiKey: true,
        needServerUrl: false,
        apiKeyLabel: 'OpenRouter API Key',
        apiKeyPlaceholder: 'sk-or-...',
        apiKeyHelp: 'https://openrouter.ai/keys',
        modelsEndpoint: 'https://openrouter.ai/api/v1/models',
        modelsFilter: (models) => models.data.filter(m => 
            !m.id.includes('embedding') && 
            !m.id.includes('rerank')
        ),
        apiFormat: 'openai'
    },
    siliconflow: {
        name: '硅基流动',
        needApiKey: true,
        needServerUrl: false,
        apiKeyLabel: 'SiliconFlow API Key',
        apiKeyPlaceholder: 'sk-...',
        apiKeyHelp: 'https://cloud.siliconflow.cn/me/account/ak',
        modelsEndpoint: 'https://api.siliconflow.cn/v1/models',
        modelsFilter: (models) => models.data.filter(m => 
            m.id && (m.type === 'chat' || m.id.includes('chat'))
        ),
        apiFormat: 'openai'
    },
    together: {
        name: 'Together AI',
        needApiKey: true,
        needServerUrl: false,
        apiKeyLabel: 'Together API Key',
        apiKeyPlaceholder: 'Your Together API Key',
        apiKeyHelp: 'https://api.together.xyz/settings/api-keys',
        modelsEndpoint: 'https://api.together.xyz/v1/models',
        modelsFilter: (models) => models.data.filter(m => 
            !m.id.includes('embedding')
        ),
        apiFormat: 'openai'
    },
    groq: {
        name: 'Groq',
        needApiKey: true,
        needServerUrl: false,
        apiKeyLabel: 'Groq API Key',
        apiKeyPlaceholder: 'gsk_...',
        apiKeyHelp: 'https://console.groq.com/keys',
        modelsEndpoint: 'https://api.groq.com/openai/v1/models',
        modelsFilter: (models) => models.data.filter(m => 
            !m.id.includes('whisper')
        ),
        apiFormat: 'openai'
    },
    zhipuai: {
        name: '智谱AI',
        needApiKey: true,
        needServerUrl: false,
        apiKeyLabel: '智谱API Key',
        apiKeyPlaceholder: 'Your Zhipu API Key',
        apiKeyHelp: 'https://open.bigmodel.cn/',
        modelsEndpoint: 'https://open.bigmodel.cn/api/paas/v4/models',
        modelsFilter: null,
        fixedModels: ['glm-4', 'glm-4-plus', 'glm-4-flash', 'glm-4-air', 'glm-4-airx'],
        apiFormat: 'zhipu'
    },
    moonshot: {
        name: '月之暗面 Kimi',
        needApiKey: true,
        needServerUrl: false,
        apiKeyLabel: 'Kimi API Key',
        apiKeyPlaceholder: 'sk-...',
        apiKeyHelp: 'https://platform.moonshot.cn/console/api-keys',
        modelsEndpoint: 'https://api.moonshot.cn/v1/models',
        modelsFilter: (models) => models.data.filter(m => 
            !m.id.includes('embedding')
        ),
        apiFormat: 'openai'
    },
    deepseek: {
        name: '深度求索 DeepSeek',
        needApiKey: true,
        needServerUrl: false,
        apiKeyLabel: 'DeepSeek API Key',
        apiKeyPlaceholder: 'sk-...',
        apiKeyHelp: 'https://platform.deepseek.com/api_keys',
        modelsEndpoint: 'https://api.deepseek.com/v1/models',
        modelsFilter: (models) => models.data,
        apiFormat: 'openai'
    },
    qwen: {
        name: '通义千问',
        needApiKey: true,
        needServerUrl: false,
        apiKeyLabel: '阿里云API Key',
        apiKeyPlaceholder: 'sk-...',
        apiKeyHelp: 'https://bailian.console.aliyun.com/',
        modelsEndpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/models',
        modelsFilter: (models) => models.data.filter(m => 
            !m.id.includes('embedding')
        ),
        apiFormat: 'openai'
    },
    doubao: {
        name: '字节跳动豆包',
        needApiKey: true,
        needServerUrl: false,
        apiKeyLabel: '豆包 API Key',
        apiKeyPlaceholder: 'Your Doubao API Key',
        apiKeyHelp: 'https://console.volcengine.com/ark/',
        modelsEndpoint: 'https://ark.cn-beijing.volces.com/api/v3/models',
        modelsFilter: (models) => models.data.filter(m => 
            !m.id.includes('embedding')
        ),
        apiFormat: 'openai'
    },
    ollama: {
        name: 'Ollama',
        needApiKey: false,
        needServerUrl: true,
        serverUrlLabel: 'Ollama 服务器地址',
        serverUrlPlaceholder: 'http://localhost:11434',
        serverUrlHelp: 'https://ollama.com/',
        modelsEndpoint: null, // 动态构建
        modelsFilter: (models) => models,
        apiFormat: 'ollama'
    },
    lmstudio: {
        name: 'LM Studio',
        needApiKey: false,
        needServerUrl: true,
        serverUrlLabel: 'LM Studio 服务器地址',
        serverUrlPlaceholder: 'http://localhost:1234',
        serverUrlHelp: 'https://lmstudio.ai/',
        modelsEndpoint: 'http://localhost:1234/v1/models',
        modelsFilter: (models) => models.data,
        apiFormat: 'openai'
    },
    vllm: {
        name: 'vLLM',
        needApiKey: false,
        needServerUrl: true,
        serverUrlLabel: 'vLLM 服务器地址',
        serverUrlPlaceholder: 'http://localhost:8000',
        serverUrlHelp: 'https://github.com/vllm-project/vllm',
        modelsEndpoint: 'http://localhost:8000/v1/models',
        modelsFilter: (models) => models.data,
        apiFormat: 'openai'
    }
};

// --- 全局变量 ---
let currentProvider = null;
let currentSettings = {
    apiKey: '',
    serverUrl: '',
    selectedModel: '',
    useCustomModel: false,
    customModel: ''
};
let syncEnabled = false; // 默认关闭同步

// 获取存储对象（根据同步开关决定使用 local 还是 sync）
function getStorage() {
    return syncEnabled ? chrome.storage.sync : chrome.storage.local;
}

// --- DOM元素 ---
const elements = {
    providerSelect: document.getElementById('provider-select'),
    providerConfig: document.getElementById('provider-config'),
    apiKeyGroup: document.getElementById('api-key-group'),
    serverUrlGroup: document.getElementById('server-url-group'),
    apiKeyInput: document.getElementById('api-key-input'),
    serverUrlInput: document.getElementById('server-url-input'),
    apiKeyLabel: document.getElementById('api-key-label'),
    serverUrlLabel: document.getElementById('server-url-label'),
    apiKeyHelp: document.getElementById('api-key-help'),
    serverUrlHelp: document.getElementById('server-url-help'),
    testConnection: document.getElementById('test-connection'),
    testServer: document.getElementById('test-server'),
    modelSelect: document.getElementById('model-select'),
    fetchModels: document.getElementById('fetch-models'),
    modelHint: document.getElementById('model-hint'),
    providerSpecific: document.getElementById('provider-specific-settings'),
    toggleApiKey: document.getElementById('toggle-api-key'),
    statusDiv: document.getElementById('status'),
    defaultTargetLanguageSelect: document.getElementById('default-target-language'),
    secondTargetLanguageSelect: document.getElementById('second-target-language'),
    // 新增自定义模型相关元素
    customModelCheckbox: document.getElementById('custom-model-checkbox'),
    customModelSection: document.getElementById('custom-model-section'),
    customModelInput: document.getElementById('custom-model-input'),
    // 保存按钮
    saveSettingsBtn: document.getElementById('save-settings-btn'),
    // 同步设置
    enableSyncCheckbox: document.getElementById('enable-sync-checkbox')
};

// --- 工具函数 ---
function showStatus(message, type = 'info', duration = 3000) {
    // 创建 Toast 容器（如果不存在）
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    // 创建 Toast 元素
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    // 添加到容器
    container.appendChild(toast);

    // 触发动画
    setTimeout(() => toast.classList.add('show'), 10);

    // 自动移除
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode === container) {
                container.removeChild(toast);
            }
            // 如果容器空了，移除容器
            if (container.childNodes.length === 0) {
                document.body.removeChild(container);
            }
        }, 300);
    }, duration);
}

function saveProviderSettings() {
    getStorage().get(['providerSettings'], (result) => {
        const allSettings = result.providerSettings || {};
        
        // 保存当前供应商的特定设置
        if (currentProvider) {
            if (!allSettings.providers) allSettings.providers = {};
            allSettings.providers[currentProvider] = {
                apiKey: currentSettings.apiKey,
                serverUrl: currentSettings.serverUrl,
                selectedModel: currentSettings.selectedModel,
                useCustomModel: currentSettings.useCustomModel,
                customModel: currentSettings.customModel
            };
        }
        
        // 保存当前选中的供应商
        allSettings.currentProvider = currentProvider;
        
        // 为了向后兼容，保留顶层字段（可选，但为了 background.js 方便）
        allSettings.apiKey = currentSettings.apiKey;
        allSettings.serverUrl = currentSettings.serverUrl;
        allSettings.selectedModel = currentSettings.selectedModel;
        allSettings.useCustomModel = currentSettings.useCustomModel;
        allSettings.customModel = currentSettings.customModel;

        getStorage().set({ providerSettings: allSettings });
    });
}

async function loadProviderSettings() {
    const storage = getStorage();
    const result = await storage.get(['providerSettings']);
    if (result.providerSettings) {
        const allSettings = result.providerSettings;
        currentProvider = allSettings.currentProvider;
        
        if (currentProvider) {
            elements.providerSelect.value = currentProvider;
            
            // 加载该供应商的特定设置
            const providerData = (allSettings.providers && allSettings.providers[currentProvider]) || {};
            currentSettings = {
                apiKey: providerData.apiKey || '',
                serverUrl: providerData.serverUrl || '',
                selectedModel: providerData.selectedModel || '',
                useCustomModel: providerData.useCustomModel || false,
                customModel: providerData.customModel || ''
            };
            
            await setupProviderConfig(currentProvider);
        }
    }
}

// --- 提供商配置 ---
async function setupProviderConfig(providerId) {
    const config = PROVIDER_CONFIG[providerId];
    if (!config) return;

    // 如果切换了供应商，先加载该供应商的设置
    if (currentProvider !== providerId) {
        currentProvider = providerId;
        const storage = getStorage();
        const result = await storage.get(['providerSettings']);
        const allSettings = result.providerSettings || {};
        const providerData = (allSettings.providers && allSettings.providers[providerId]) || {};
        
        currentSettings = {
            apiKey: providerData.apiKey || '',
            serverUrl: providerData.serverUrl || '',
            selectedModel: providerData.selectedModel || '',
            useCustomModel: providerData.useCustomModel || false,
            customModel: providerData.customModel || ''
        };
    }

    // 显示配置区域
    elements.providerConfig.style.display = 'block';
    
    // 配置API密钥组
    if (config.needApiKey) {
        elements.apiKeyGroup.style.display = 'block';
        elements.apiKeyLabel.textContent = config.apiKeyLabel;
        elements.apiKeyInput.placeholder = config.apiKeyPlaceholder;
        elements.apiKeyHelp.href = config.apiKeyHelp;
        elements.apiKeyInput.value = currentSettings.apiKey;
    } else {
        elements.apiKeyGroup.style.display = 'none';
    }
    
    // 配置服务器地址组
    if (config.needServerUrl) {
        elements.serverUrlGroup.style.display = 'block';
        elements.serverUrlLabel.textContent = config.serverUrlLabel || '服务器地址';
        elements.serverUrlInput.placeholder = config.serverUrlPlaceholder || 'http://localhost:11434';
        elements.serverUrlHelp.href = config.serverUrlHelp || '#';
        elements.serverUrlInput.value = currentSettings.serverUrl;
        
        // 更新测试按钮的文本
        elements.testServer.textContent = `测试${config.name}连接`;
    } else {
        elements.serverUrlGroup.style.display = 'none';
    }
    
    // 重置模型选择
    elements.modelSelect.innerHTML = '<option>请先获取模型列表</option>';
    elements.modelSelect.disabled = true;
    elements.fetchModels.disabled = !hasValidCredentials();
    
    // 如果有固定的模型列表，直接填充
    if (config.fixedModels) {
        populateFixedModels(config.fixedModels);
    }
    
    // 显示提供商特定提示
    updateProviderSpecificHint(providerId);
    
    // 初始化自定义模型相关UI
    elements.customModelCheckbox.checked = currentSettings.useCustomModel;
    elements.customModelInput.value = currentSettings.customModel;
    updateCustomModelUI();
    
    // 如果有保存的设置，尝试加载模型
    if (hasValidCredentials() && currentSettings.selectedModel && !currentSettings.useCustomModel) {
        await fetchModels();
    }
}

function hasValidCredentials() {
    const config = PROVIDER_CONFIG[currentProvider];
    if (!config) return false;
    
    if (config.needApiKey && !currentSettings.apiKey.trim()) return false;
    if (config.needServerUrl && !currentSettings.serverUrl.trim()) return false;
    
    return true;
}

function updateProviderSpecificHint(providerId) {
    const config = PROVIDER_CONFIG[providerId];
    let hint = '';
    
    if (providerId === 'ollama') {
        hint = '⚠️ 使用 Ollama 前，请设置环境变量 OLLAMA_ORIGINS="*" 并重启 Ollama 服务以允许浏览器访问。';
    } else if (providerId === 'lmstudio') {
        hint = '请确保 LM Studio 正在运行并已加载模型。';
    } else if (providerId === 'vllm') {
        hint = '请确保 vLLM 服务器正在运行。';
    }
    
    elements.modelHint.textContent = hint || config.apiKeyHelp ? '配置完成后点击"获取模型列表"按钮' : '';
}

function populateFixedModels(models) {
    elements.modelSelect.innerHTML = '';
    models.forEach(model => {
        const option = document.createElement('option');
        option.value = model;
        option.textContent = model;
        elements.modelSelect.appendChild(option);
    });
    
    if (currentSettings.selectedModel) {
        elements.modelSelect.value = currentSettings.selectedModel;
    }
    
    elements.modelSelect.disabled = false;
}

// --- 自定义模型功能 ---
function updateCustomModelUI() {
    const isChecked = elements.customModelCheckbox.checked;
    elements.customModelSection.style.display = isChecked ? 'block' : 'none';
    
    if (isChecked) {
        // 启用自定义模型时，禁用模型选择和获取按钮
        elements.modelSelect.disabled = true;
        elements.fetchModels.disabled = true;
        
        // 如果有自定义模型名称，设置为选中状态
        if (currentSettings.customModel) {
            currentSettings.selectedModel = currentSettings.customModel;
        }
    } else {
        // 禁用自定义模型时，恢复正常状态
        elements.modelSelect.disabled = !elements.modelSelect.options.length || elements.modelSelect.options.length <= 1;
        elements.fetchModels.disabled = !hasValidCredentials();
        
        // 清空自定义模型，恢复之前的选中模型
        currentSettings.customModel = '';
        elements.customModelInput.value = '';
    }
}

// --- API调用 ---
async function testConnection() {
    const config = PROVIDER_CONFIG[currentProvider];
    if (!config) return;
    
    if (!currentSettings.apiKey.trim()) {
        showStatus('请输入 API 密钥后再进行测试', 'error');
        return;
    }
    
    try {
        elements.testConnection.textContent = '测试中...';
        elements.testConnection.disabled = true;
        
        let url = config.modelsEndpoint;
        let options = {
            method: 'GET',
            headers: {},
            credentials: 'omit'
        };
        
        if (config.apiFormat === 'openai') {
            options.headers['Authorization'] = `Bearer ${currentSettings.apiKey}`;
            if (url.includes('openrouter.ai')) {
                options.headers['HTTP-Referer'] = 'https://github.com/Abelliuxl/ez-translate';
                options.headers['X-Title'] = 'EZ Translate';
            }
        } else if (config.apiFormat === 'anthropic') {
            options.method = 'POST';
            options.headers['x-api-key'] = currentSettings.apiKey;
            options.headers['anthropic-version'] = '2023-06-01';
            options.headers['content-type'] = 'application/json';
            options.body = JSON.stringify({
                model: config.fixedModels ? config.fixedModels[0] : 'claude-3-haiku-20240307',
                max_tokens: 1,
                messages: [{ role: 'user', content: 'Hi' }]
            });
        } else if (config.apiFormat === 'google') {
            url = `${url}?key=${currentSettings.apiKey}`;
        } else if (config.apiFormat === 'zhipu') {
            options.headers['Authorization'] = `Bearer ${currentSettings.apiKey}`;
        }
        
        const response = await fetch(url, options);
        
        if (response.ok) {
            // 进一步验证返回的内容是否为 JSON 且不包含错误
            const data = await response.json();
            if (data.error) {
                throw new Error(data.error.message || 'API 返回了错误信息');
            }
            showStatus(`${config.name} 连接测试成功！`, 'success');
        } else {
            let errorMsg = 'API 密钥无效或请求失败';
            try {
                const errorData = await response.json();
                errorMsg = errorData.error?.message || errorData.message || errorMsg;
            } catch (e) {
                // 无法解析 JSON 错误，使用默认消息
            }
            showStatus(`${config.name} 测试失败: ${errorMsg}`, 'error');
        }
    } catch (error) {
        showStatus(`连接测试失败: ${error.message}`, 'error');
    } finally {
        elements.testConnection.textContent = '测试连接';
        elements.testConnection.disabled = false;
    }
}

async function testServerConnection() {
    const config = PROVIDER_CONFIG[currentProvider];
    if (!config) return;
    
    try {
        elements.testServer.textContent = '测试中...';
        elements.testServer.disabled = true;
        
        let url = currentSettings.serverUrl;
        if (currentProvider === 'ollama') {
            url = `${url}/api/tags`;
        } else if (config.apiFormat === 'openai') {
            url = `${url}/v1/models`;
        }
        
        const response = await fetch(url);
        if (response.ok) {
            showStatus(`${config.name} 服务器连接成功！`, 'success');
            elements.fetchModels.disabled = false;
        } else {
            showStatus(`${config.name} 服务器连接失败，请检查地址`, 'error');
        }
    } catch (error) {
        showStatus(`服务器连接失败: ${error.message}`, 'error');
    } finally {
        elements.testServer.textContent = '测试连接';
        elements.testServer.disabled = false;
    }
}

async function fetchModels() {
    const config = PROVIDER_CONFIG[currentProvider];
    if (!config) return;
    
    try {
        elements.fetchModels.textContent = '获取中...';
        elements.fetchModels.disabled = true;
        elements.modelSelect.innerHTML = '<option>正在获取模型列表...</option>';
        
        let models = [];
        
        if (config.fixedModels) {
            models = config.fixedModels;
        } else if (currentProvider === 'ollama') {
            const response = await fetch(`${currentSettings.serverUrl}/api/tags`);
            if (!response.ok) throw new Error('Failed to fetch Ollama models');
            const data = await response.json();
            models = data.models.map(m => m.name);
        } else if (config.modelsEndpoint) {
            let url = config.modelsEndpoint;
            let headers = {};
            
            if (config.apiFormat === 'openai' && config.needApiKey) {
                headers['Authorization'] = `Bearer ${currentSettings.apiKey}`;
                
                // OpenRouter 推荐添加这些 Header 以识别应用
                if (url.includes('openrouter.ai')) {
                    headers['HTTP-Referer'] = 'https://github.com/Abelliuxl/ez-translate';
                    headers['X-Title'] = 'EZ Translate Extension';
                }
            } else if (config.apiFormat === 'google') {
                url = `${url}?key=${currentSettings.apiKey}`;
            } else if (config.apiFormat === 'anthropic') {
                headers['x-api-key'] = currentSettings.apiKey;
                headers['anthropic-version'] = '2023-06-01';
            }
            
            // 对于本地部署的服务器
            if (config.needServerUrl && currentProvider !== 'ollama') {
                url = `${currentSettings.serverUrl}/v1/models`;
            }
            
            const response = await fetch(url, { 
                headers,
                credentials: 'omit'
            });
            if (!response.ok) throw new Error('Failed to fetch models');
            const data = await response.json();
            
            if (config.modelsFilter) {
                const filtered = config.modelsFilter(data);
                models = Array.isArray(filtered) ? filtered.map(m => m.id || m.name || m) : filtered;
            } else if (data.data) {
                models = data.data.map(m => m.id || m.name || m);
            } else if (data.models) {
                models = data.models.map(m => m.name || m.id || m);
            }
        }
        
        // 填充模型选择器
        elements.modelSelect.innerHTML = '';
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = model;
            elements.modelSelect.appendChild(option);
        });
        
        // 恢复之前选择的模型
        if (currentSettings.selectedModel && models.includes(currentSettings.selectedModel)) {
            elements.modelSelect.value = currentSettings.selectedModel;
        }
        
        elements.modelSelect.disabled = false;
        showStatus(`成功获取 ${models.length} 个模型`, 'success');
        
    } catch (error) {
        elements.modelSelect.innerHTML = '<option>获取模型失败</option>';
        showStatus(`获取模型失败: ${error.message}`, 'error');
    } finally {
        elements.fetchModels.textContent = '获取模型列表';
        elements.fetchModels.disabled = false;
    }
}

// --- 语言设置 ---
const languageKeys = [
    "langEnglish", "langSimplifiedChinese", "langTraditionalChinese", "langFrench", "langSpanish", "langArabic", "langRussian", "langPortuguese", "langGerman", "langItalian", "langDutch", "langDanish", "langIrish", "langWelsh", "langFinnish", "langIcelandic", "langSwedish", "langNorwegianNynorsk", "langNorwegianBokmal", "langJapanese", "langKorean", "langVietnamese", "langThai", "langIndonesian", "langMalay", "langBurmese", "langTagalog", "langKhmer", "langLao", "langHindi", "langBengali", "langUrdu", "langNepali", "langHebrew", "langTurkish", "langPersian", "langPolish", "langUkrainian", "langCzech", "langRomanian", "langBulgarian", "langSlovak", "langHungarian", "langSlovenian", "langLatvian", "langEstonian", "langLithuanian", "langBelarusian", "langGreek", "langCroatian", "langMacedonian", "langMaltese", "langSerbian", "langBosnian", "langGeorgian", "langArmenian", "langNorthAzerbaijani", "langKazakh", "langNorthernUzbek", "langTajik", "langSwahili", "langAfrikaans", "langCantonese", "langLuxembourgish", "langLimburgish", "langCatalan", "langGalician", "langAsturian", "langBasque", "langOccitan", "langVenetian", "langSardinian", "langSicilian", "langFriulian", "langLombard", "langLigurian", "langFaroese", "langToskAlbanian", "langSilesian", "langBashkir", "langTatar", "langMesopotamianArabic", "langNajdiArabic", "langEgyptianArabic", "langLevantineArabic", "langTaizziAdeniArabic", "langDari", "langTunisianArabic", "langMoroccanArabic", "langKabuverdianu", "langTokPisin", "langEasternYiddish", "langSindhi", "langSinhala", "langTelugu", "langPunjabi", "langTamil", "langGujarati", "langMalayalam", "langMarathi", "langKannada", "langMagahi", "langOriya", "langAwadhi", "langMaithili", "langAssamese", "langChhattisgarhi", "langBhojpuri", "langMinangkabau", "langBalinese", "langJavanese", "langBanjar", "langSundanese", "langCebuano", "langPangasinan", "langIloko", "langWarayPhilippines", "langHaitian", "langPapiamento"
];

function populateLanguages() {
    [elements.defaultTargetLanguageSelect, elements.secondTargetLanguageSelect].forEach(select => {
        select.innerHTML = '';
        languageKeys.forEach(key => {
            const message = chrome.i18n.getMessage(key);
            const option = document.createElement('option');
            option.value = key;
            option.textContent = message;
            select.appendChild(option);
        });
    });
}

function loadLanguageSettings() {
    getStorage().get(['targetLanguage', 'secondTargetLanguage'], (result) => {
        if (result.targetLanguage) {
            elements.defaultTargetLanguageSelect.value = result.targetLanguage;
        } else {
            const browserLang = chrome.i18n.getUILanguage();
            const defaultLangKey = getDefaultLanguageKey(browserLang);
            elements.defaultTargetLanguageSelect.value = defaultLangKey;
        }
        
        if (result.secondTargetLanguage) {
            elements.secondTargetLanguageSelect.value = result.secondTargetLanguage;
        } else {
            const defaultLang = elements.defaultTargetLanguageSelect.value;
            const secondLang = defaultLang === 'langSimplifiedChinese' ? 'langEnglish' : 'langSimplifiedChinese';
            elements.secondTargetLanguageSelect.value = secondLang;
        }
    });
}

function getDefaultLanguageKey(browserLang) {
    const browserLangToMsgKey = {
        'en': 'langEnglish',
        'zh': 'langSimplifiedChinese',
        'zh-CN': 'langSimplifiedChinese',
        'zh-TW': 'langTraditionalChinese',
        'fr': 'langFrench',
        'es': 'langSpanish',
        'ar': 'langArabic',
        'ru': 'langRussian',
        'pt': 'langPortuguese',
        'de': 'langGerman',
        'it': 'langItalian',
        'nl': 'langDutch',
        'da': 'langDanish',
        'ja': 'langJapanese',
        'ko': 'langKorean',
        'sv': 'langSwedish',
        'no': 'langNorwegianBokmal',
        'pl': 'langPolish',
        'tr': 'langTurkish',
        'fi': 'langFinnish',
        'hu': 'langHungarian',
        'cs': 'langCzech',
        'el': 'langGreek',
        'hi': 'langHindi',
        'id': 'langIndonesian',
        'th': 'langThai',
        'vi': 'langVietnamese',
        'ro': 'langRomanian',
        'sk': 'langSlovak'
    };
    
    return browserLangToMsgKey[browserLang] || browserLangToMsgKey[browserLang.split('-')[0]] || 'langEnglish';
}

// --- I18n ---
function setupI18n() {
    document.querySelectorAll('[data-i18n]').forEach(elem => {
        const key = elem.getAttribute('data-i18n');
        elem.textContent = chrome.i18n.getMessage(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(elem => {
        const key = elem.getAttribute('data-i18n-placeholder');
        elem.placeholder = chrome.i18n.getMessage(key);
    });
    document.title = chrome.i18n.getMessage('settingsTitle');
}

// --- 事件监听器 ---
function setupEventListeners() {
    // 提供商选择
    elements.providerSelect.addEventListener('change', async (e) => {
        const providerId = e.target.value;
        if (providerId) {
            await setupProviderConfig(providerId);
        } else {
            elements.providerConfig.style.display = 'none';
        }
    });
    
    // API密钥输入
    elements.apiKeyInput.addEventListener('input', (e) => {
        currentSettings.apiKey = e.target.value;
        elements.fetchModels.disabled = !hasValidCredentials();
        saveProviderSettings();
    });
    
    // 服务器地址输入
    elements.serverUrlInput.addEventListener('input', (e) => {
        currentSettings.serverUrl = e.target.value;
        elements.fetchModels.disabled = !hasValidCredentials();
        saveProviderSettings();
    });
    
    // 测试连接
    elements.testConnection.addEventListener('click', testConnection);
    elements.testServer.addEventListener('click', testServerConnection);

    // 切换API密钥显示/隐藏
    elements.toggleApiKey.addEventListener('click', () => {
        const type = elements.apiKeyInput.type === 'password' ? 'text' : 'password';
        elements.apiKeyInput.type = type;
        elements.toggleApiKey.textContent = type === 'password' ? '👁️' : '🔒';
    });
    
    // 获取模型
    elements.fetchModels.addEventListener('click', fetchModels);
    
    // 模型选择
    elements.modelSelect.addEventListener('change', (e) => {
        currentSettings.selectedModel = e.target.value;
        saveProviderSettings();
        showStatus(`已选择模型: ${e.target.value}`, 'success');
    });
    
    // 语言设置
    elements.defaultTargetLanguageSelect.addEventListener('change', (e) => {
        getStorage().set({ targetLanguage: e.target.value });
        showStatus(`默认目标语言已设置`, 'success');
    });
    
    elements.secondTargetLanguageSelect.addEventListener('change', (e) => {
        getStorage().set({ secondTargetLanguage: e.target.value });
        showStatus(`第二目标语言已设置`, 'success');
    });
    
    // 自定义模型勾选框
    elements.customModelCheckbox.addEventListener('change', (e) => {
        currentSettings.useCustomModel = e.target.checked;
        updateCustomModelUI();
        saveProviderSettings();
    });
    
    // 自定义模型输入
    elements.customModelInput.addEventListener('input', (e) => {
        currentSettings.customModel = e.target.value;
        if (currentSettings.useCustomModel) {
            currentSettings.selectedModel = e.target.value;
        }
        saveProviderSettings();
    });
    
    // 保存按钮
    elements.saveSettingsBtn.addEventListener('click', () => {
        saveAllSettings();
    });

    // 同步开关
    elements.enableSyncCheckbox.addEventListener('change', async (e) => {
        const newSyncEnabled = e.target.checked;
        const storage = getStorage();

        if (newSyncEnabled !== syncEnabled) {
            // 同步开关状态发生变化
            const oldStorage = syncEnabled ? chrome.storage.sync : chrome.storage.local;
            const newStorage = newSyncEnabled ? chrome.storage.sync : chrome.storage.local;

            // 迁移数据：从旧存储读取，写入新存储
            showStatus('正在迁移数据...', 'info');

            try {
                // 获取所有旧存储的数据
                const oldData = await oldStorage.get(null);

                // 写入新存储
                await new Promise((resolve, reject) => {
                    newStorage.set(oldData, () => {
                        if (chrome.runtime.lastError) {
                            reject(chrome.runtime.lastError);
                        } else {
                            resolve();
                        }
                    });
                });

                // 保存同步开关状态到 local（不同步这个开关本身）
                chrome.storage.local.set({ syncEnabled: newSyncEnabled });

                syncEnabled = newSyncEnabled;

                const message = newSyncEnabled
                    ? '已启用浏览器同步，配置将同步到所有登录了相同浏览器账户的设备'
                    : '已关闭浏览器同步，配置将仅保存在本地';
                showStatus(message, 'success', 5000);
            } catch (error) {
                // 迁移失败，恢复开关状态
                elements.enableSyncCheckbox.checked = syncEnabled;
                showStatus(`数据迁移失败: ${error.message}`, 'error');
            }
        }
    });
}

// --- 保存所有设置 ---
function saveAllSettings() {
    try {
        // 保存提供商设置
        saveProviderSettings();
        
        // 保存语言设置
        const targetLanguage = elements.defaultTargetLanguageSelect.value;
        const secondTargetLanguage = elements.secondTargetLanguageSelect.value;
        
        getStorage().set({
            targetLanguage,
            secondTargetLanguage
        });
        
        showStatus('所有设置已保存成功！', 'success', 3000);
        
        // 添加保存成功的视觉反馈
        const originalText = elements.saveSettingsBtn.textContent;
        elements.saveSettingsBtn.textContent = '✓ 已保存';
        elements.saveSettingsBtn.style.backgroundColor = '#218838';
        
        setTimeout(() => {
            elements.saveSettingsBtn.textContent = originalText;
            elements.saveSettingsBtn.style.backgroundColor = '';
        }, 2000);
        
    } catch (error) {
        showStatus(`保存设置失败: ${error.message}`, 'error');
    }
}

// --- 初始化 ---
async function initialize() {
    setupI18n();
    populateLanguages();

    // 加载同步开关设置（始终从 local 读取，因为开关本身不同步）
    chrome.storage.local.get(['syncEnabled'], (result) => {
        syncEnabled = result.syncEnabled || false;
        elements.enableSyncCheckbox.checked = syncEnabled;

        // 加载其他设置
        loadLanguageSettings();
    });

    await loadProviderSettings();
    setupEventListeners();
}

// 启动应用
document.addEventListener('DOMContentLoaded', initialize);
