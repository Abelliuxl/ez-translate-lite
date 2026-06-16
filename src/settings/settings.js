// --- 提供商配置 ---
const PROVIDER_CONFIG = {
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
    longcat: {
        name: 'Longcat AI',
        needApiKey: true,
        needServerUrl: false,
        apiKeyLabel: 'Longcat API Key',
        apiKeyPlaceholder: 'ak-...',
        apiKeyHelp: 'https://api.longcat.chat/',
        modelsEndpoint: 'https://api.longcat.chat/openai/v1/models',
        modelsFilter: null,
        fixedModels: ['LongCat-Flash-Chat'],
        apiFormat: 'openai',
        testMode: 'chat',
        testEndpoint: 'https://api.longcat.chat/openai/v1/chat/completions'
    },
    minimax: {
        name: 'MiniMax',
        needApiKey: true,
        needServerUrl: false,
        apiKeyLabel: 'MiniMax API Key',
        apiKeyPlaceholder: 'your-minimax-api-key',
        apiKeyHelp: 'https://platform.minimax.io/',
        modelsEndpoint: 'https://api.minimax.io/v1/models',
        modelsFilter: null,
        fixedModels: ['MiniMax-Text-01'],
        apiFormat: 'openai',
        testMode: 'chat',
        testEndpoint: 'https://api.minimax.io/v1/chat/completions'
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
    'custom-openai': {
        name: '自定义 OpenAI 兼容',
        needApiKey: true,
        needServerUrl: true,
        apiKeyLabel: 'API Key',
        apiKeyPlaceholder: 'Your API Key',
        apiKeyHelp: '填写你的 API Key',
        serverUrlLabel: 'Base URL',
        serverUrlPlaceholder: 'https://api.example.com',
        serverUrlHelp: '填写 Base URL（不要包含 /v1、/models、/chat/completions 等接口路径）',
        modelsEndpoint: '{serverUrl}/v1/models',
        modelsFilter: (models) => models.data || models,
        apiFormat: 'custom-openai'
    },
    'custom-anthropic': {
        name: '自定义 Anthropic 兼容',
        needApiKey: true,
        needServerUrl: true,
        apiKeyLabel: 'API Key',
        apiKeyPlaceholder: 'Your API Key',
        apiKeyHelp: '填写你的 API Key',
        serverUrlLabel: 'Base URL',
        serverUrlPlaceholder: 'https://api.example.com',
        serverUrlHelp: '填写 Base URL（不要包含 /v1、/messages 等接口路径）',
        modelsEndpoint: '{serverUrl}/v1/models',
        modelsFilter: (models) => models.data || models,
        apiFormat: 'custom-anthropic'
    }
};

// --- 全局状态 ---
let configurations = [];
let activeConfigId = null;
let editingConfigId = null; // null = 新建模式, string = 编辑模式
let modalProviderSettings = {}; // 模态框内临时设置

// --- DOM 元素 ---
const $ = (id) => document.getElementById(id);

const el = {
    // 配置列表
    configList: $('config-list'),
    configEmpty: $('config-empty'),
    btnNewConfig: $('btn-new-config'),

    // 模态框
    modal: $('config-modal'),
    modalOverlay: document.querySelector('.modal-overlay'),
    modalTitle: $('modal-title'),
    modalClose: $('modal-close'),
    modalCancel: $('modal-cancel'),
    modalSave: $('modal-save'),

    // 模态框表单
    configName: $('config-name'),
    configProvider: $('config-provider'),
    apiKeyGroup: $('config-apikey-group'),
    apiKeyInput: $('config-apikey-input'),
    apiKeyLabel: $('config-apikey-label'),
    apiKeyHelp: $('config-apikey-help'),
    toggleApiKey: $('config-toggle-apikey'),
    testConnection: $('config-test-connection'),

    serverUrlGroup: $('config-serverurl-group'),
    serverUrlInput: $('config-serverurl-input'),
    serverUrlLabel: $('config-serverurl-label'),
    serverUrlHelp: $('config-serverurl-help'),
    testServer: $('config-test-server'),

    modelSelect: $('config-model-select'),
    fetchModels: $('config-fetch-models'),
    modelHint: $('config-model-hint'),

    customModelCheckbox: $('config-custom-model-checkbox'),
    customModelSection: $('config-custom-model-section'),
    customModelInput: $('config-custom-model-input'),

    thinkingCheckbox: $('config-thinking-checkbox'),
    reasoningSelect: $('config-reasoning-select'),
    customReasoningCheckbox: $('config-custom-reasoning-checkbox'),
    customReasoningSection: $('config-custom-reasoning-section'),
    customReasoningInput: $('config-custom-reasoning-input'),

    // 语言选择
    defaultTargetLanguage: $('default-target-language'),
    secondTargetLanguage: $('second-target-language'),
};

// --- 工具函数 ---
function generateConfigId() {
    const ts = Date.now();
    const rand = Math.random().toString(36).substring(2, 8);
    return `cfg_${ts}_${rand}`;
}

function maskApiKey(key) {
    if (!key || key.length < 8) return key ? key.substring(0, 3) + '****' : '';
    return key.substring(0, 3) + '****' + key.substring(key.length - 4);
}

function getProviderName(providerId) {
    return PROVIDER_CONFIG[providerId]?.name || providerId;
}

// --- Toast ---
function showStatus(message, type = 'info', duration = 3000) {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode === container) {
                container.removeChild(toast);
            }
            if (container.childNodes.length === 0) {
                document.body.removeChild(container);
            }
        }, 300);
    }, duration);
}

// --- 数据持久化 ---
function getStorage() {
    return chrome.storage.local;
}

async function loadConfigurations() {
    const storage = getStorage();
    const result = await storage.get(['configurations', 'activeConfigId']);
    configurations = result.configurations || [];
    activeConfigId = result.activeConfigId || null;
}

async function saveConfigurations() {
    const storage = getStorage();
    await storage.set({
        configurations,
        activeConfigId
    });
}

// --- 自动迁移旧格式 ---
async function migrateFromOldFormat() {
    if (configurations.length > 0) return; // 已迁移

    const storage = getStorage();
    const result = await storage.get('providerSettings');
    const old = result.providerSettings;
    if (!old) return;

    const migrated = [];

    if (old.providers && typeof old.providers === 'object') {
        for (const [providerId, data] of Object.entries(old.providers)) {
            if (!data.apiKey) continue;
            const config = createConfigFromOldData(providerId, data);
            if (config) migrated.push(config);
        }
    }

    // 顶层单条数据（更旧格式）
    if (migrated.length === 0 && old.apiKey) {
        const config = createConfigFromOldData(old.currentProvider || '', old);
        if (config) migrated.push(config);
    }

    if (migrated.length > 0) {
        configurations = migrated;
        activeConfigId = migrated[0].id;
        await saveConfigurations();
        showStatus(`已自动迁移 ${migrated.length} 个旧配置到新格式`, 'success');
    }
}

function createConfigFromOldData(providerId, data) {
    if (!providerId || !data) return null;
    const providerName = getProviderName(providerId);
    const model = data.selectedModel || data.customModel || '';
    return {
        id: generateConfigId(),
        name: `${providerName}${model ? ' - ' + model : ''}`,
        provider: providerId,
        apiKey: data.apiKey || '',
        serverUrl: data.serverUrl || '',
        model: data.selectedModel || '',
        useCustomModel: Boolean(data.useCustomModel),
        customModel: data.customModel || '',
        thinkingEnabled: Boolean(data.thinkingEnabled),
        reasoningEffort: 'low',
        useCustomReasoningEffort: false,
        customReasoningEffort: ''
    };
}

// --- 配置卡片渲染 ---
function renderConfigList() {
    el.configList.innerHTML = '';

    if (configurations.length === 0) {
        el.configEmpty.style.display = 'block';
        return;
    }
    el.configEmpty.style.display = 'none';

    configurations.forEach(config => {
        const card = createConfigCard(config);
        el.configList.appendChild(card);
    });
}

function createConfigCard(config) {
    const isActive = config.id === activeConfigId;
    const card = document.createElement('div');
    card.className = `config-card${isActive ? ' active' : ''}`;
    card.dataset.configId = config.id;

    const providerName = getProviderName(config.provider);
    const modelName = config.useCustomModel ? config.customModel : config.model;
    const thinkingStatus = config.thinkingEnabled ? '开启' : '关闭';
    let reasoningDisplay = config.reasoningEffort || 'low';
    if (config.useCustomReasoningEffort && config.customReasoningEffort) {
        reasoningDisplay = config.customReasoningEffort;
    }

    card.innerHTML = `
        <div class="config-card-header">
            <div class="config-card-name">
                ${escHtml(config.name)}
                ${isActive ? '<span class="config-card-badge">当前生效</span>' : ''}
            </div>
            <div class="config-card-actions">
                <button class="config-card-icon-btn" data-action="edit" title="编辑">✏️</button>
                <button class="config-card-icon-btn config-card-icon-delete" data-action="delete" title="删除">✕</button>
                <label class="config-card-toggle" title="${isActive ? '当前生效' : '点击启用'}">
                    <input type="checkbox" data-action="activate" ${isActive ? 'checked' : ''}>
                    <span class="config-card-toggle-slider"></span>
                </label>
            </div>
        </div>
        <div class="config-card-meta">
            <span>${escHtml(providerName)}</span>
            <span>模型: ${escHtml(modelName || '未设置')}</span>
            <span class="detail-item"><span class="detail-label">API: </span><span class="detail-value">${escHtml(maskApiKey(config.apiKey))}</span></span>
            <span class="detail-item"><span class="detail-label">Think: </span><span class="detail-value">${thinkingStatus}</span></span>
            <span class="detail-item"><span class="detail-label">Reason: </span><span class="detail-value">${escHtml(reasoningDisplay)}</span></span>
        </div>
    `;

    card.querySelector('[data-action="edit"]').addEventListener('click', () => openEditConfigModal(config.id));
    card.querySelector('[data-action="delete"]').addEventListener('click', () => deleteConfig(config.id));
    card.querySelector('[data-action="activate"]').addEventListener('change', (e) => {
        if (e.target.checked) {
            setActiveConfig(config.id);
        } else {
            e.target.checked = true;
        }
    });

    return card;
}

function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

// --- CRUD 操作 ---
async function setActiveConfig(configId) {
    activeConfigId = configId;
    await saveConfigurations();
    renderConfigList();
    showStatus(`已切换到配置: ${configurations.find(c => c.id === configId)?.name}`, 'success');
}

async function deleteConfig(configId) {
    const config = configurations.find(c => c.id === configId);
    if (!config) return;

    if (!confirm(`确定删除配置「${config.name}」吗？`)) return;

    configurations = configurations.filter(c => c.id !== configId);

    if (activeConfigId === configId) {
        activeConfigId = configurations.length > 0 ? configurations[0].id : null;
    }

    await saveConfigurations();
    renderConfigList();
    showStatus('配置已删除', 'success');
}

// --- 模态框 ---
function openNewConfigModal() {
    editingConfigId = null;
    el.modalTitle.textContent = '新建配置';
    resetModalForm();
    showModal();
}

function openEditConfigModal(configId) {
    const config = configurations.find(c => c.id === configId);
    if (!config) return;

    editingConfigId = configId;
    el.modalTitle.textContent = '编辑配置';
    fillModalForm(config);
    showModal();
}

function showModal() {
    el.modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    el.modal.style.display = 'none';
    document.body.style.overflow = '';
}

function resetModalForm() {
    el.configName.value = '';
    el.configProvider.value = '';
    el.apiKeyGroup.style.display = 'none';
    el.serverUrlGroup.style.display = 'none';
    el.apiKeyInput.value = '';
    el.serverUrlInput.value = '';
    el.modelSelect.innerHTML = '<option>请先配置API密钥并获取模型列表</option>';
    el.modelSelect.disabled = true;
    el.fetchModels.disabled = true;
    el.fetchModels.textContent = '获取模型列表';
    el.customModelCheckbox.checked = false;
    el.customModelSection.style.display = 'none';
    el.customModelInput.value = '';
    el.thinkingCheckbox.checked = false;
    el.reasoningSelect.value = 'low';
    el.customReasoningCheckbox.checked = false;
    el.customReasoningSection.style.display = 'none';
    el.customReasoningInput.value = '';
    el.modelHint.textContent = '配置API密钥后点击"获取模型列表"按钮';

    modalProviderSettings = {};
}

function fillModalForm(config) {
    el.configName.value = config.name || '';
    el.configProvider.value = config.provider || '';
    el.apiKeyInput.value = config.apiKey || '';
    el.serverUrlInput.value = config.serverUrl || '';
    el.customModelCheckbox.checked = Boolean(config.useCustomModel);
    el.customModelSection.style.display = config.useCustomModel ? 'block' : 'none';
    el.customModelInput.value = config.customModel || '';
    el.thinkingCheckbox.checked = Boolean(config.thinkingEnabled);
    el.reasoningSelect.value = config.reasoningEffort || 'low';
    el.customReasoningCheckbox.checked = Boolean(config.useCustomReasoningEffort);
    el.customReasoningSection.style.display = config.useCustomReasoningEffort ? 'block' : 'none';
    el.customReasoningInput.value = config.customReasoningEffort || '';

    modalProviderSettings = {
        apiKey: config.apiKey || '',
        serverUrl: config.serverUrl || '',
        selectedModel: config.model || '',
        useCustomModel: Boolean(config.useCustomModel),
        customModel: config.customModel || '',
    };

    // 触发提供商配置 UI
    const providerId = config.provider;
    if (providerId && PROVIDER_CONFIG[providerId]) {
        setupModalProviderConfig(providerId, true);
    }
}

function collectModalForm() {
    const providerId = el.configProvider.value;
    const useCustomModel = el.customModelCheckbox.checked;
    const model = useCustomModel ? el.customModelInput.value : el.modelSelect.value;

    return {
        id: editingConfigId || generateConfigId(),
        name: el.configName.value.trim() || getProviderName(providerId) + ' 配置',
        provider: providerId,
        apiKey: el.apiKeyInput.value.trim(),
        serverUrl: el.serverUrlInput.value.trim(),
        model: model || '',
        useCustomModel,
        customModel: useCustomModel ? el.customModelInput.value.trim() : '',
        thinkingEnabled: el.thinkingCheckbox.checked,
        reasoningEffort: el.reasoningSelect.value,
        useCustomReasoningEffort: el.customReasoningCheckbox.checked,
        customReasoningEffort: el.customReasoningCheckbox.checked ? el.customReasoningInput.value.trim() : ''
    };
}

async function saveConfigFromModal() {
    const data = collectModalForm();

    if (!data.provider) {
        showStatus('请选择提供商', 'error');
        return;
    }

    const config = PROVIDER_CONFIG[data.provider];
    if (config?.needApiKey && !data.apiKey) {
        showStatus('请输入 API Key', 'error');
        return;
    }
    if (config?.needServerUrl && !data.serverUrl) {
        showStatus('请输入服务器地址', 'error');
        return;
    }

    if (!data.model) {
        showStatus('请选择或输入模型名称', 'error');
        return;
    }

    if (editingConfigId) {
        const idx = configurations.findIndex(c => c.id === editingConfigId);
        if (idx !== -1) {
            configurations[idx] = data;
        }
    } else {
        configurations.push(data);
        if (!activeConfigId) {
            activeConfigId = data.id;
        }
    }

    await saveConfigurations();
    renderConfigList();
    closeModal();

    if (editingConfigId) {
        showStatus('配置已更新', 'success');
    } else {
        showStatus('配置已创建', 'success');
    }
}

// --- 模态框提供商配置 ---
async function setupModalProviderConfig(providerId, skipApiKeyCheck = false) {
    const config = PROVIDER_CONFIG[providerId];
    if (!config) return;

    modalProviderSettings.provider = providerId;

    // API Key
    if (config.needApiKey) {
        el.apiKeyGroup.style.display = 'block';
        el.apiKeyLabel.textContent = config.apiKeyLabel;
        el.apiKeyInput.placeholder = config.apiKeyPlaceholder;
        el.apiKeyHelp.href = config.apiKeyHelp || '#';
        el.apiKeyHelp.style.display = config.apiKeyHelp ? 'inline' : 'none';

        if (!skipApiKeyCheck) {
            el.apiKeyInput.value = modalProviderSettings.apiKey || '';
        }
    } else {
        el.apiKeyGroup.style.display = 'none';
    }

    // Server URL
    if (config.needServerUrl) {
        el.serverUrlGroup.style.display = 'block';
        el.serverUrlLabel.textContent = config.serverUrlLabel || '服务器地址';
        el.serverUrlInput.placeholder = config.serverUrlPlaceholder || 'http://localhost:11434';
        el.serverUrlHelp.href = config.serverUrlHelp || '#';
        el.serverUrlHelp.style.display = config.serverUrlHelp ? 'inline' : 'none';
    } else {
        el.serverUrlGroup.style.display = 'none';
    }

    // 模型选择
    el.modelSelect.innerHTML = '<option>请先获取模型列表</option>';
    el.modelSelect.disabled = true;
    el.fetchModels.disabled = !hasModalValidCredentials();

    if (config.fixedModels) {
        populateModalFixedModels(config.fixedModels, skipApiKeyCheck);
    }

    updateModalModelHint(providerId);

    // 自定义模型
    if (!skipApiKeyCheck) {
        el.customModelCheckbox.checked = Boolean(modalProviderSettings.useCustomModel);
        el.customModelInput.value = modalProviderSettings.customModel || '';
        updateModalCustomModelUI();
    }

    // 如果有保存的凭据，尝试加载模型
    if (!skipApiKeyCheck && hasModalValidCredentials() && modalProviderSettings.selectedModel && !modalProviderSettings.useCustomModel) {
        await fetchModalModels();
    }
}

function hasModalValidCredentials() {
    const providerId = el.configProvider.value;
    if (!providerId) return false;
    const config = PROVIDER_CONFIG[providerId];
    if (!config) return false;
    if (config.needApiKey && !el.apiKeyInput.value.trim()) return false;
    if (config.needServerUrl && !el.serverUrlInput.value.trim()) return false;
    return true;
}

function updateModalModelHint(providerId) {
    const config = PROVIDER_CONFIG[providerId];
    let hint = '';
    if (providerId === 'ollama') {
        hint = '⚠️ 使用 Ollama 前，请设置环境变量 OLLAMA_ORIGINS="*" 并重启 Ollama 服务以允许浏览器访问。';
    } else if (providerId === 'lmstudio') {
        hint = '请确保 LM Studio 正在运行并已加载模型。';
    } else if (providerId === 'vllm') {
        hint = '请确保 vLLM 服务器正在运行。';
    }
    el.modelHint.textContent = hint || (config?.apiKeyHelp ? '配置完成后点击"获取模型列表"按钮' : '');
}

function populateModalFixedModels(models, skipApiKeyCheck) {
    el.modelSelect.innerHTML = '';
    models.forEach(model => {
        const opt = document.createElement('option');
        opt.value = model;
        opt.textContent = model;
        el.modelSelect.appendChild(opt);
    });

    if (!skipApiKeyCheck && modalProviderSettings.selectedModel && models.includes(modalProviderSettings.selectedModel)) {
        el.modelSelect.value = modalProviderSettings.selectedModel;
    } else if (models.length > 0) {
        el.modelSelect.value = models[0];
        modalProviderSettings.selectedModel = models[0];
    }

    el.modelSelect.disabled = false;
}

function updateModalCustomModelUI() {
    const isChecked = el.customModelCheckbox.checked;
    el.customModelSection.style.display = isChecked ? 'block' : 'none';

    if (isChecked) {
        el.modelSelect.disabled = true;
        el.fetchModels.disabled = true;
    } else {
        el.modelSelect.disabled = el.modelSelect.options.length <= 1;
        el.fetchModels.disabled = !hasModalValidCredentials();
    }
}

// --- 模态框 API 调用 ---
async function fetchModalModels() {
    const providerId = el.configProvider.value;
    const config = PROVIDER_CONFIG[providerId];
    if (!config) return;

    try {
        el.fetchModels.textContent = '获取中...';
        el.fetchModels.disabled = true;
        el.modelSelect.innerHTML = '<option>正在获取模型列表...</option>';

        let models = [];

        if (config.fixedModels) {
            models = config.fixedModels;
        } else if (providerId === 'ollama') {
            const resp = await fetch(`${el.serverUrlInput.value}/api/tags`);
            if (!resp.ok) throw new Error('Failed to fetch Ollama models');
            const data = await resp.json();
            models = data.models.map(m => m.name);
        } else if (config.modelsEndpoint) {
            let url = config.modelsEndpoint;
            let headers = {};

            if (config.apiFormat === 'openai' && config.needApiKey) {
                headers['Authorization'] = `Bearer ${el.apiKeyInput.value}`;
                if (url.includes('openrouter.ai')) {
                    headers['HTTP-Referer'] = 'https://github.com/Abelliuxl/ez-translate';
                    headers['X-Title'] = 'EZ Translate Extension';
                }
            } else if (config.apiFormat === 'custom-openai') {
                headers['Authorization'] = `Bearer ${el.apiKeyInput.value}`;
            } else if (config.apiFormat === 'google') {
                url = `${url}?key=${el.apiKeyInput.value}`;
            } else if (config.apiFormat === 'anthropic') {
                headers['x-api-key'] = el.apiKeyInput.value;
                headers['anthropic-version'] = '2023-06-01';
            }

            let urlCandidates = [url];
            if (config.needServerUrl && providerId !== 'ollama') {
                if (config.apiFormat === 'custom-openai' || config.apiFormat === 'custom-anthropic') {
                    urlCandidates = buildEndpointCandidates(el.serverUrlInput.value, '/models');
                } else {
                    urlCandidates = [buildV1Endpoint(el.serverUrlInput.value, '/models')];
                }
            }

            const baseOptions = { headers, credentials: 'omit' };
            const { response } = config.apiFormat === 'custom-anthropic'
                ? await fetchWithHeaderVariants(urlCandidates, baseOptions, getAnthropicAuthHeaderVariants(el.apiKeyInput.value), [404])
                : await fetchWithFallback(urlCandidates, baseOptions, [404]);
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

        el.modelSelect.innerHTML = '';
        models.forEach(model => {
            const opt = document.createElement('option');
            opt.value = model;
            opt.textContent = model;
            el.modelSelect.appendChild(opt);
        });

        if (modalProviderSettings.selectedModel && models.includes(modalProviderSettings.selectedModel)) {
            el.modelSelect.value = modalProviderSettings.selectedModel;
        } else if (models.length > 0) {
            el.modelSelect.value = models[0];
            modalProviderSettings.selectedModel = models[0];
        }

        el.modelSelect.disabled = false;
        showStatus(`成功获取 ${models.length} 个模型`, 'success');

    } catch (error) {
        el.modelSelect.innerHTML = '<option>获取模型失败</option>';
        if ((config.apiFormat === 'custom-openai' || config.apiFormat === 'custom-anthropic') &&
            (error.message.includes('404') || error.message.toLowerCase().includes('not found'))) {
            showStatus('当前兼容供应商未提供模型列表接口，请勾选"使用自定义模型"并手动填写模型名', 'error');
        } else {
            showStatus(`获取模型失败: ${error.message}`, 'error');
        }
    } finally {
        el.fetchModels.textContent = '获取模型列表';
        el.fetchModels.disabled = false;
    }
}

// --- API 工具函数（复用于测试连接） ---
function normalizeBaseUrl(url) {
    return (url || '').trim().replace(/\/+$/, '');
}

function sanitizeBaseUrlForPath(baseUrl, path) {
    const normalizedBase = normalizeBaseUrl(baseUrl);
    if (!normalizedBase) return '';
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    if (normalizedBase.endsWith(`/v1${normalizedPath}`)) {
        return normalizedBase.slice(0, -(`/v1${normalizedPath}`).length);
    }
    if (normalizedBase.endsWith(normalizedPath)) {
        return normalizedBase.slice(0, -normalizedPath.length);
    }
    return normalizedBase;
}

function buildEndpointCandidates(baseUrl, path) {
    const normalizedBase = sanitizeBaseUrlForPath(baseUrl, path);
    if (!normalizedBase) return [];
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const baseWithoutV1 = normalizedBase.replace(/\/v1$/, '');
    const withV1 = normalizedBase.endsWith('/v1')
        ? `${normalizedBase}${normalizedPath}`
        : `${normalizedBase}/v1${normalizedPath}`;
    const withoutV1 = `${baseWithoutV1}${normalizedPath}`;
    return [...new Set([withV1, withoutV1])];
}

function buildV1Endpoint(baseUrl, path) {
    return buildEndpointCandidates(baseUrl, path)[0] || '';
}

async function extractErrorMessage(response, fallback = '请求失败') {
    try {
        const errorData = await response.json();
        return errorData.error?.message || errorData.message || fallback;
    } catch (e) {
        try {
            const text = await response.text();
            return text || fallback;
        } catch (readError) {
            return fallback;
        }
    }
}

async function fetchWithFallback(urlCandidates, options = {}, retryStatuses = [404], acceptedStatuses = []) {
    const candidates = (Array.isArray(urlCandidates) ? urlCandidates : [urlCandidates]).filter(Boolean);
    if (candidates.length === 0) throw new Error('请求地址为空');

    let lastError = null;
    for (let i = 0; i < candidates.length; i++) {
        const url = candidates[i];
        try {
            const response = await fetch(url, options);
            if (response.ok || acceptedStatuses.includes(response.status)) {
                return { url, response };
            }
            if (retryStatuses.includes(response.status) && i < candidates.length - 1) continue;
            const message = await extractErrorMessage(response, `HTTP ${response.status}`);
            const error = new Error(message);
            error.status = response.status;
            throw error;
        } catch (error) {
            lastError = error;
            if (i === candidates.length - 1) throw error;
        }
    }
    throw lastError || new Error('请求失败');
}

function getAnthropicAuthHeaderVariants(apiKey) {
    return [
        { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        { 'Authorization': `Bearer ${apiKey}`, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }
    ];
}

function getCustomAnthropicProbeModels(preferredModel = '') {
    return [...new Set([
        preferredModel,
        modalProviderSettings.customModel || '',
        'LongCat-Flash-Chat',
        'claude-3-5-haiku-latest',
        'claude-3-5-sonnet-latest'
    ].filter(Boolean))];
}

async function fetchWithHeaderVariants(urlCandidates, baseOptions, headerVariants, retryStatuses = [404], acceptedStatuses = []) {
    const authRetryStatuses = [401, 403, 404];
    let lastError = null;
    for (let i = 0; i < headerVariants.length; i++) {
        const options = {
            ...baseOptions,
            headers: { ...(baseOptions.headers || {}), ...headerVariants[i] }
        };
        try {
            const result = await fetchWithFallback(urlCandidates, options, retryStatuses, acceptedStatuses);
            if (authRetryStatuses.includes(result.response.status) && i < headerVariants.length - 1) continue;
            return result;
        } catch (error) {
            lastError = error;
            if (authRetryStatuses.includes(error.status) && i < headerVariants.length - 1) continue;
            throw error;
        }
    }
    throw lastError || new Error('请求失败');
}

async function probeCustomAnthropicConnection(serverUrl, apiKey, preferredModel = '') {
    const urlCandidates = buildEndpointCandidates(serverUrl, '/messages');
    const modelsToTry = getCustomAnthropicProbeModels(preferredModel);
    let lastError = null;

    for (const probeModel of modelsToTry) {
        const options = {
            method: 'POST',
            body: JSON.stringify({ model: probeModel, max_tokens: 1, messages: [{ role: 'user', content: 'Hi' }] }),
            credentials: 'omit'
        };
        try {
            const result = await fetchWithHeaderVariants(urlCandidates, options, getAnthropicAuthHeaderVariants(apiKey), [404], [400, 401, 403]);
            return { ...result, model: probeModel };
        } catch (error) {
            lastError = error;
            if (error.status === 404) continue;
            throw error;
        }
    }
    throw lastError || new Error('Anthropic 连接探测失败');
}

// --- 模态框测试连接 ---
async function testModalConnection() {
    const providerId = el.configProvider.value;
    const config = PROVIDER_CONFIG[providerId];
    if (!config) return;

    const apiKey = el.apiKeyInput.value.trim();
    const serverUrl = el.serverUrlInput.value.trim();

    if (!apiKey) {
        showStatus('请输入 API 密钥后再进行测试', 'error');
        return;
    }

    try {
        el.testConnection.textContent = '测试中...';
        el.testConnection.disabled = true;

        let url = config.modelsEndpoint;
        let urlCandidates = [url];
        let options = { method: 'GET', headers: {}, credentials: 'omit' };

        if (config.apiFormat === 'openai') {
            options.headers['Authorization'] = `Bearer ${apiKey}`;
            if (config.testMode === 'chat') {
                url = config.testEndpoint || config.modelsEndpoint;
                options.method = 'POST';
                options.headers['content-type'] = 'application/json';
                options.body = JSON.stringify({
                    model: (modalProviderSettings.selectedModel || modalProviderSettings.customModel) || (config.fixedModels && config.fixedModels[0]) || '',
                    max_tokens: 1,
                    messages: [{ role: 'user', content: 'Hi' }]
                });
            }
            if (url.includes('openrouter.ai')) {
                options.headers['HTTP-Referer'] = 'https://github.com/Abelliuxl/ez-translate';
                options.headers['X-Title'] = 'EZ Translate';
            }
        } else if (config.apiFormat === 'anthropic') {
            options.method = 'POST';
            options.headers['x-api-key'] = apiKey;
            options.headers['anthropic-version'] = '2023-06-01';
            options.headers['content-type'] = 'application/json';
            options.body = JSON.stringify({
                model: config.fixedModels ? config.fixedModels[0] : 'claude-3-haiku-20240307',
                max_tokens: 1,
                messages: [{ role: 'user', content: 'Hi' }]
            });
        } else if (config.apiFormat === 'google') {
            url = `${url}?key=${apiKey}`;
        } else if (config.apiFormat === 'zhipu') {
            options.headers['Authorization'] = `Bearer ${apiKey}`;
        } else if (config.apiFormat === 'custom-openai') {
            if (!serverUrl) throw new Error('请先填写 Base URL');
            urlCandidates = buildEndpointCandidates(serverUrl, '/models');
            options.headers['Authorization'] = `Bearer ${apiKey}`;
        } else if (config.apiFormat === 'custom-anthropic') {
            if (!serverUrl) throw new Error('请先填写 Base URL');
            const { response } = await probeCustomAnthropicConnection(serverUrl, apiKey, modalProviderSettings.selectedModel || modalProviderSettings.customModel);
            if (response.ok || response.status === 400) {
                const hasModel = Boolean(modalProviderSettings.selectedModel || modalProviderSettings.customModel);
                showStatus(`${config.name} ${hasModel ? '连接测试成功' : '接口可达，但尚未选择模型，翻译时会失败'}`, hasModel ? 'success' : 'info');
            } else if (response.status === 401 || response.status === 403) {
                showStatus(`${config.name} 测试失败: 认证失败，请检查 API Key`, 'error');
            } else {
                showStatus(`${config.name} 测试失败: ${await extractErrorMessage(response, `HTTP ${response.status}`)}`, 'error');
            }
            return;
        }

        const requestTargets = (config.apiFormat === 'custom-openai' || config.apiFormat === 'custom-anthropic') ? urlCandidates : [url];
        const { response } = config.apiFormat === 'custom-anthropic'
            ? await fetchWithHeaderVariants(requestTargets, options, getAnthropicAuthHeaderVariants(apiKey), [404])
            : await fetchWithFallback(requestTargets, options, [404]);

        if (response.ok) {
            try {
                const data = await response.json();
                if (data.error) throw new Error(data.error.message || 'API 返回了错误信息');
            } catch (e) {}
            const hasModel = Boolean(modalProviderSettings.selectedModel || modalProviderSettings.customModel);
            showStatus(`${config.name} ${hasModel ? '连接测试成功！' : '接口可达，但尚未选择模型，翻译时会失败'}`, hasModel ? 'success' : 'info');
        } else {
            let errorMsg = 'API 密钥无效或请求失败';
            try {
                const errorData = await response.json();
                errorMsg = errorData.error?.message || errorData.message || errorMsg;
            } catch (e) {}
            showStatus(`${config.name} 测试失败: ${errorMsg}`, 'error');
        }
    } catch (error) {
        if (config.apiFormat === 'custom-anthropic' && error.status === 404) {
            showStatus('连接测试返回 404。请检查 Base URL 是否只填服务根地址（不含 /v1、/messages 等路径），并确认模型名称可用', 'error');
        } else {
            showStatus(`连接测试失败: ${error.message}`, 'error');
        }
    } finally {
        el.testConnection.textContent = '测试连接';
        el.testConnection.disabled = false;
    }
}

async function testModalServerConnection() {
    const providerId = el.configProvider.value;
    const config = PROVIDER_CONFIG[providerId];
    if (!config) return;

    const apiKey = el.apiKeyInput.value.trim();
    const serverUrl = el.serverUrlInput.value.trim();

    try {
        el.testServer.textContent = '测试中...';
        el.testServer.disabled = true;

        let url = normalizeBaseUrl(serverUrl);
        let urlCandidates = [url];
        let options = { method: 'GET', headers: {}, credentials: 'omit' };

        if (providerId === 'ollama') {
            urlCandidates = [`${url}/api/tags`];
        } else if (config.apiFormat === 'custom-openai') {
            urlCandidates = buildEndpointCandidates(url, '/models');
            options.headers['Authorization'] = `Bearer ${apiKey}`;
        } else if (config.apiFormat === 'custom-anthropic') {
            const { response } = await probeCustomAnthropicConnection(url, apiKey, modalProviderSettings.selectedModel || modalProviderSettings.customModel);
            if (response.ok || response.status === 400) {
                const hasModel = Boolean(modalProviderSettings.selectedModel || modalProviderSettings.customModel);
                showStatus(`${config.name} ${hasModel ? '服务器连接成功' : '服务器可达，但尚未选择模型，翻译时会失败'}`, hasModel ? 'success' : 'info');
                el.fetchModels.disabled = false;
            } else if (response.status === 401 || response.status === 403) {
                showStatus(`${config.name} 服务器可达，但认证失败（请检查 API Key）`, 'error');
            } else {
                showStatus(`${config.name} 服务器连接失败: ${await extractErrorMessage(response, `HTTP ${response.status}`)}`, 'error');
            }
            return;
        } else if (config.apiFormat === 'openai') {
            urlCandidates = [buildV1Endpoint(url, '/models')];
        } else if (config.apiFormat === 'anthropic') {
            urlCandidates = [config.modelsEndpoint];
            options.method = 'POST';
            options.headers['x-api-key'] = apiKey;
            options.headers['anthropic-version'] = '2023-06-01';
            options.headers['content-type'] = 'application/json';
            options.body = JSON.stringify({
                model: config.fixedModels ? config.fixedModels[0] : 'claude-3-5-haiku-latest',
                max_tokens: 1,
                messages: [{ role: 'user', content: 'Hi' }]
            });
        } else if (config.apiFormat === 'google') {
            urlCandidates = [`${config.modelsEndpoint}?key=${apiKey}`];
        } else if (config.apiFormat === 'zhipu') {
            urlCandidates = [config.modelsEndpoint];
            options.headers['Authorization'] = `Bearer ${apiKey}`;
        }

        let response;
        try {
            if (config.apiFormat === 'custom-anthropic') {
                ({ response } = await fetchWithHeaderVariants(urlCandidates, options, getAnthropicAuthHeaderVariants(apiKey), [404], [400, 401, 403]));
            } else {
                ({ response } = await fetchWithFallback(urlCandidates, options, [404], [400, 401, 403]));
            }
        } catch (error) {
            if (config.apiFormat === 'custom-openai') {
                const effectiveModel = modalProviderSettings.selectedModel || modalProviderSettings.customModel;
                if (!effectiveModel) throw new Error('当前服务未提供 /models 接口，请先选择模型或填写自定义模型后再测试');
                const probeCandidates = buildEndpointCandidates(url, '/chat/completions');
                const probeOptions = {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model: effectiveModel, messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 }),
                    credentials: 'omit'
                };
                ({ response } = await fetchWithFallback(probeCandidates, probeOptions, [404], [400, 401, 403]));
            } else {
                throw error;
            }
        }

        if (response.ok) {
            const hasModel = Boolean(modalProviderSettings.selectedModel || modalProviderSettings.customModel);
            showStatus(`${config.name} ${hasModel ? '服务器连接成功！' : '服务器可达，但尚未选择模型，翻译时会失败'}`, hasModel ? 'success' : 'info');
            el.fetchModels.disabled = false;
        } else if (response.status === 400 && (config.apiFormat === 'custom-openai' || config.apiFormat === 'custom-anthropic')) {
            const hasModel = Boolean(modalProviderSettings.selectedModel || modalProviderSettings.customModel);
            showStatus(`${config.name} 服务器可达（${hasModel ? '接口返回参数错误' : '但尚未选择模型，翻译时会失败'}）`, hasModel ? 'info' : 'info');
            el.fetchModels.disabled = false;
        } else if (response.status === 401 || response.status === 403) {
            showStatus(`${config.name} 服务器可达，但认证失败（请检查 API Key）`, 'error');
        } else {
            showStatus(`${config.name} 服务器连接失败，请检查地址`, 'error');
        }
    } catch (error) {
        showStatus(`服务器连接失败: ${error.message}`, 'error');
    } finally {
        el.testServer.textContent = '测试连接';
        el.testServer.disabled = false;
    }
}

// --- 语言设置 ---
const languageKeys = [
    "langEnglish", "langSimplifiedChinese", "langTraditionalChinese", "langFrench", "langSpanish", "langArabic", "langRussian", "langPortuguese", "langGerman", "langItalian", "langDutch", "langDanish", "langIrish", "langWelsh", "langFinnish", "langIcelandic", "langSwedish", "langNorwegianNynorsk", "langNorwegianBokmal", "langJapanese", "langKorean", "langVietnamese", "langThai", "langIndonesian", "langMalay", "langBurmese", "langTagalog", "langKhmer", "langLao", "langHindi", "langBengali", "langUrdu", "langNepali", "langHebrew", "langTurkish", "langPersian", "langPolish", "langUkrainian", "langCzech", "langRomanian", "langBulgarian", "langSlovak", "langHungarian", "langSlovenian", "langLatvian", "langEstonian", "langLithuanian", "langBelarusian", "langGreek", "langCroatian", "langMacedonian", "langMaltese", "langSerbian", "langBosnian", "langGeorgian", "langArmenian", "langNorthAzerbaijani", "langKazakh", "langNorthernUzbek", "langTajik", "langSwahili", "langAfrikaans", "langCantonese", "langLuxembourgish", "langLimburgish", "langCatalan", "langGalician", "langAsturian", "langBasque", "langOccitan", "langVenetian", "langSardinian", "langSicilian", "langFriulian", "langLombard", "langLigurian", "langFaroese", "langToskAlbanian", "langSilesian", "langBashkir", "langTatar", "langMesopotamianArabic", "langNajdiArabic", "langEgyptianArabic", "langLevantineArabic", "langTaizziAdeniArabic", "langDari", "langTunisianArabic", "langMoroccanArabic", "langKabuverdianu", "langTokPisin", "langEasternYiddish", "langSindhi", "langSinhala", "langTelugu", "langPunjabi", "langTamil", "langGujarati", "langMalayalam", "langMarathi", "langKannada", "langMagahi", "langOriya", "langAwadhi", "langMaithili", "langAssamese", "langChhattisgarhi", "langBhojpuri", "langMinangkabau", "langBalinese", "langJavanese", "langBanjar", "langSundanese", "langCebuano", "langPangasinan", "langIloko", "langWarayPhilippines", "langHaitian", "langPapiamento"
];

function populateLanguages() {
    [el.defaultTargetLanguage, el.secondTargetLanguage].forEach(select => {
        select.innerHTML = '';
        languageKeys.forEach(key => {
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = chrome.i18n.getMessage(key);
            select.appendChild(opt);
        });
    });
}

function loadLanguageSettings() {
    getStorage().get(['targetLanguage', 'secondTargetLanguage'], (result) => {
        if (result.targetLanguage) {
            el.defaultTargetLanguage.value = result.targetLanguage;
        } else {
            const browserLang = chrome.i18n.getUILanguage();
            el.defaultTargetLanguage.value = getDefaultLanguageKey(browserLang);
        }
        if (result.secondTargetLanguage) {
            el.secondTargetLanguage.value = result.secondTargetLanguage;
        } else {
            const def = el.defaultTargetLanguage.value;
            el.secondTargetLanguage.value = def === 'langSimplifiedChinese' ? 'langEnglish' : 'langSimplifiedChinese';
        }
    });
}

function getDefaultLanguageKey(browserLang) {
    const map = {
        'en': 'langEnglish', 'zh': 'langSimplifiedChinese', 'zh-CN': 'langSimplifiedChinese',
        'zh-TW': 'langTraditionalChinese', 'fr': 'langFrench', 'es': 'langSpanish',
        'ar': 'langArabic', 'ru': 'langRussian', 'pt': 'langPortuguese', 'de': 'langGerman',
        'it': 'langItalian', 'nl': 'langDutch', 'da': 'langDanish', 'ja': 'langJapanese',
        'ko': 'langKorean', 'sv': 'langSwedish', 'no': 'langNorwegianBokmal', 'pl': 'langPolish',
        'tr': 'langTurkish', 'fi': 'langFinnish', 'hu': 'langHungarian', 'cs': 'langCzech',
        'el': 'langGreek', 'hi': 'langHindi', 'id': 'langIndonesian', 'th': 'langThai',
        'vi': 'langVietnamese', 'ro': 'langRomanian', 'sk': 'langSlovak'
    };
    return map[browserLang] || map[browserLang?.split('-')[0]] || 'langEnglish';
}

// --- I18n ---
function setupI18n() {
    document.querySelectorAll('[data-i18n]').forEach(elem => {
        elem.textContent = chrome.i18n.getMessage(elem.getAttribute('data-i18n'));
    });
    document.title = chrome.i18n.getMessage('settingsTitle');
}

// --- 事件绑定 ---
function setupEventListeners() {
    // 新建/关闭模态框
    el.btnNewConfig.addEventListener('click', openNewConfigModal);
    el.modalClose.addEventListener('click', closeModal);
    el.modalCancel.addEventListener('click', closeModal);
    el.modalOverlay.addEventListener('click', closeModal);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && el.modal.style.display === 'flex') closeModal();
    });

    // 模态框内事件
    el.configProvider.addEventListener('change', (e) => {
        const providerId = e.target.value;
        if (providerId) {
            setupModalProviderConfig(providerId);
        }
    });

    el.apiKeyInput.addEventListener('input', () => {
        modalProviderSettings.apiKey = el.apiKeyInput.value;
        el.fetchModels.disabled = !hasModalValidCredentials();
    });

    el.serverUrlInput.addEventListener('input', () => {
        modalProviderSettings.serverUrl = el.serverUrlInput.value;
        el.fetchModels.disabled = !hasModalValidCredentials();
    });

    el.toggleApiKey.addEventListener('click', () => {
        const type = el.apiKeyInput.type === 'password' ? 'text' : 'password';
        el.apiKeyInput.type = type;
        el.toggleApiKey.textContent = type === 'password' ? '👁️' : '🔒';
    });

    el.testConnection.addEventListener('click', testModalConnection);
    el.testServer.addEventListener('click', testModalServerConnection);
    el.fetchModels.addEventListener('click', fetchModalModels);

    el.modelSelect.addEventListener('change', (e) => {
        modalProviderSettings.selectedModel = e.target.value;
    });

    el.customModelCheckbox.addEventListener('change', (e) => {
        modalProviderSettings.useCustomModel = e.target.checked;
        if (e.target.checked) {
            modalProviderSettings.selectedModel = el.customModelInput.value || modalProviderSettings.selectedModel;
        } else {
            modalProviderSettings.customModel = '';
            el.customModelInput.value = '';
        }
        updateModalCustomModelUI();
    });

    el.customModelInput.addEventListener('input', (e) => {
        modalProviderSettings.customModel = e.target.value;
        if (modalProviderSettings.useCustomModel) {
            modalProviderSettings.selectedModel = e.target.value;
        }
    });

    // 推理强度
    el.customReasoningCheckbox.addEventListener('change', (e) => {
        el.customReasoningSection.style.display = e.target.checked ? 'block' : 'none';
        el.reasoningSelect.disabled = e.target.checked;
    });

    // 保存配置
    el.modalSave.addEventListener('click', saveConfigFromModal);

    // 语言设置
    el.defaultTargetLanguage.addEventListener('change', (e) => {
        getStorage().set({ targetLanguage: e.target.value });
        showStatus('默认目标语言已设置', 'success');
    });

    el.secondTargetLanguage.addEventListener('change', (e) => {
        getStorage().set({ secondTargetLanguage: e.target.value });
        showStatus('第二目标语言已设置', 'success');
    });
}

// --- 初始化 ---
async function initialize() {
    setupI18n();
    populateLanguages();
    await loadConfigurations();
    await migrateFromOldFormat();
    renderConfigList();
    loadLanguageSettings();
    setupEventListeners();
}

document.addEventListener('DOMContentLoaded', initialize);
