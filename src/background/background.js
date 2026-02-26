// --- 存储辅助函数 ---
// 获取同步开关状态并返回相应的存储对象
async function getStorage() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['syncEnabled'], (result) => {
            const syncEnabled = result.syncEnabled || false;
            resolve(syncEnabled ? chrome.storage.sync : chrome.storage.local);
        });
    });
}

// --- 提供商配置 ---
const PROVIDER_CONFIG = {
    openrouter: {
        name: 'OpenRouter',
        modelsEndpoint: 'https://openrouter.ai/api/v1/chat/completions',
        visionEndpoint: 'https://openrouter.ai/api/v1/chat/completions',
        apiFormat: 'openai',
        supportsVision: true
    },
    siliconflow: {
        name: '硅基流动',
        modelsEndpoint: 'https://api.siliconflow.cn/v1/chat/completions',
        visionEndpoint: 'https://api.siliconflow.cn/v1/chat/completions',
        apiFormat: 'openai',
        supportsVision: true
    },
    longcat: {
        name: 'Longcat AI',
        modelsEndpoint: 'https://api.longcat.chat/openai/v1/chat/completions',
        visionEndpoint: 'https://api.longcat.chat/openai/v1/chat/completions',
        apiFormat: 'openai',
        supportsVision: false
    },
    minimax: {
        name: 'MiniMax',
        modelsEndpoint: 'https://api.minimax.io/v1/chat/completions',
        visionEndpoint: 'https://api.minimax.io/v1/chat/completions',
        apiFormat: 'openai',
        supportsVision: false
    },
    zhipuai: {
        name: '智谱AI',
        modelsEndpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
        visionEndpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
        apiFormat: 'zhipu',
        supportsVision: true
    },
    moonshot: {
        name: '月之暗面 Kimi',
        modelsEndpoint: 'https://api.moonshot.cn/v1/chat/completions',
        visionEndpoint: 'https://api.moonshot.cn/v1/chat/completions',
        apiFormat: 'openai',
        supportsVision: true
    },
    deepseek: {
        name: '深度求索 DeepSeek',
        modelsEndpoint: 'https://api.deepseek.com/v1/chat/completions',
        visionEndpoint: 'https://api.deepseek.com/v1/chat/completions',
        apiFormat: 'openai',
        supportsVision: true
    },
    qwen: {
        name: '通义千问',
        modelsEndpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
        visionEndpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
        apiFormat: 'openai',
        supportsVision: true
    },
    doubao: {
        name: '字节跳动豆包',
        modelsEndpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
        visionEndpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
        apiFormat: 'openai',
        supportsVision: true
    },
    'custom-openai': {
        name: '自定义 OpenAI 兼容',
        modelsEndpoint: '{serverUrl}/v1/chat/completions',
        visionEndpoint: '{serverUrl}/v1/chat/completions',
        apiFormat: 'custom-openai',
        supportsVision: true
    },
    'custom-anthropic': {
        name: '自定义 Anthropic 兼容',
        modelsEndpoint: '{serverUrl}/v1/messages',
        visionEndpoint: '{serverUrl}/v1/messages',
        apiFormat: 'custom-anthropic',
        supportsVision: true
    }
};

// --- 初始化与安装 ---
chrome.runtime.onInstalled.addListener(async () => {
    console.log("LLM-Translate 插件已安装或更新。");

    // 获取存储对象
    const storage = await getStorage();

    // 设置初始默认值，仅当它们不存在时
    storage.get(null, (items) => {
        const defaults = {
            targetLanguage: 'langSimplifiedChinese',
            secondTargetLanguage: 'langEnglish'
        };
        let itemsToSet = {};
        for (const key in defaults) {
            if (items[key] === undefined) {
                itemsToSet[key] = defaults[key];
            }
        }
        if (Object.keys(itemsToSet).length > 0) {
            storage.set(itemsToSet);
            console.log("已设置初始默认值:", itemsToSet);
        }
    });
});

// --- 消息监听 ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'translate') {
        handleTranslation(request.text, request.targetLanguage, request.secondTargetLanguage, sendResponse);
        return true; // 异步响应
    }
});

// --- 语言名称标准化函数 ---
function normalizeLanguageToEnglishName(langValue) {
    const langKeyToEnName = {
        'langEnglish': 'English',
        'langSimplifiedChinese': 'Simplified Chinese',
        'langTraditionalChinese': 'Traditional Chinese',
        'langFrench': 'French',
        'langSpanish': 'Spanish',
        'langArabic': 'Arabic',
        'langRussian': 'Russian',
        'langPortuguese': 'Portuguese',
        'langGerman': 'German',
        'langItalian': 'Italian',
        'langDutch': 'Dutch',
        'langDanish': 'Danish',
        'langJapanese': 'Japanese',
        'langKorean': 'Korean',
        'langVietnamese': 'Vietnamese',
        'langThai': 'Thai',
        'langIndonesian': 'Indonesian',
        'langHindi': 'Hindi',
        'langTurkish': 'Turkish',
        'langPolish': 'Polish',
        'langFinnish': 'Finnish',
        'langHungarian': 'Hungarian',
        'langCzech': 'Czech',
        'langGreek': 'Greek',
        'langRomanian': 'Romanian',
        'langSlovak': 'Slovak'
    };
    
    if (langKeyToEnName[langValue]) {
        return langKeyToEnName[langValue];
    } else {
        return langValue;
    }
}

// --- 核心翻译处理 ---
async function handleTranslation(text, targetLanguage, secondTargetLanguage, sendResponse) {
    try {
        // 获取提供商设置
        const storage = await getStorage();
        const providerSettings = await storage.get('providerSettings');
        if (!providerSettings.providerSettings) {
            sendResponse({ error: '请先在设置页面配置LLM提供商' });
            return;
        }
        
        const { currentProvider, apiKey, serverUrl, selectedModel } = providerSettings.providerSettings;
        if (!currentProvider || !selectedModel) {
            sendResponse({ error: '请先在设置页面选择提供商和模型' });
            return;
        }
        
        const config = PROVIDER_CONFIG[currentProvider];
        if (!config) {
            sendResponse({ error: `未知的提供商: ${currentProvider}` });
            return;
        }
        
        // 检查凭据
        if (config.apiFormat !== 'ollama' && !apiKey) {
            sendResponse({ error: `${config.name} API密钥未配置` });
            return;
        }
        
        if (config.apiFormat === 'ollama' && !serverUrl) {
            sendResponse({ error: `${config.name} 服务器地址未配置` });
            return;
        }

        if ((config.apiFormat === 'custom-openai' || config.apiFormat === 'custom-anthropic') && !serverUrl) {
            sendResponse({ error: `${config.name} Base URL 未配置` });
            return;
        }
        
        // Detect source language and determine actual target language
        const actualTargetLanguage = await determineTargetLanguage(text, targetLanguage, secondTargetLanguage);
        
        // 调用翻译API
        const translation = await callTranslationAPI({
            provider: currentProvider,
            config,
            apiKey,
            serverUrl,
            model: selectedModel,
            text,
            targetLanguage: actualTargetLanguage,
            secondTargetLanguage
        });
        
        sendResponse({ translation });
    } catch (error) {
        sendResponse({ error: `翻译失败: ${error.message}` });
    }
}

// --- 语言检测与目标语言确定 ---
async function determineTargetLanguage(text, targetLanguage, secondTargetLanguage) {
    return new Promise((resolve) => {
        chrome.i18n.detectLanguage(text, (result) => {
            if (result && result.languages && result.languages.length > 0) {
                const detectedLanguage = result.languages[0].language;
                const confidence = result.languages[0].percentage;
                
                // Map detected language to target language format
                const detectedLangName = mapLanguageCodeToName(detectedLanguage);
                
                // If detected language matches target language, use second target language
                if (detectedLangName === targetLanguage && confidence > 50) {
                    console.log(`Source language (${detectedLangName}) matches target language (${targetLanguage}), using second target language (${secondTargetLanguage})`);
                    resolve(secondTargetLanguage);
                } else {
                    console.log(`Using primary target language: ${targetLanguage}`);
                    resolve(targetLanguage);
                }
            } else {
                // If language detection fails, use primary target language
                console.log(`Language detection failed, using primary target language: ${targetLanguage}`);
                resolve(targetLanguage);
            }
        });
    });
}

function mapLanguageCodeToName(languageCode) {
    const languageMap = {
        'en': 'English',
        'zh': 'Simplified Chinese',
        'zh-CN': 'Simplified Chinese',
        'zh-TW': 'Traditional Chinese',
        'fr': 'French',
        'es': 'Spanish',
        'ar': 'Arabic',
        'ru': 'Russian',
        'pt': 'Portuguese',
        'de': 'German',
        'it': 'Italian',
        'nl': 'Dutch',
        'da': 'Danish',
        'ja': 'Japanese',
        'ko': 'Korean',
        'sv': 'Swedish',
        'no': 'Norwegian Bokmål',
        'pl': 'Polish',
        'tr': 'Turkish',
        'fi': 'Finnish',
        'hu': 'Hungarian',
        'cs': 'Czech',
        'el': 'Greek',
        'hi': 'Hindi',
        'id': 'Indonesian',
        'th': 'Thai',
        'vi': 'Vietnamese',
        'ro': 'Romanian',
        'sk': 'Slovak'
    };
    
    return languageMap[languageCode] || 'English';
}

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

async function extractErrorMessage(response, fallback = 'API 请求失败') {
    try {
        const errorBody = await response.json();
        return errorBody.error?.message || errorBody.message || fallback;
    } catch (e) {
        try {
            const text = await response.text();
            return text || fallback;
        } catch (readError) {
            return fallback;
        }
    }
}


// --- 统一API调用 ---

/**
 * 调用文本翻译API
 */
async function callTranslationAPI({ provider, config, apiKey, serverUrl, model, text, targetLanguage, secondTargetLanguage }) {
    // 确保参数正确传递给 getMessage
    const prompt = chrome.i18n.getMessage('translationPrompt', [
        String(targetLanguage), 
        String(secondTargetLanguage), 
        String(text)
    ]);
    
    if (config.apiFormat === 'openai') {
        return await callOpenAICompatibleAPI(config.modelsEndpoint, apiKey, model, prompt);
    } else if (config.apiFormat === 'anthropic') {
        return await callAnthropicAPI(config.modelsEndpoint, apiKey, model, prompt);
    } else if (config.apiFormat === 'google') {
        return await callGoogleAPI(config.modelsEndpoint, apiKey, model, prompt);
    } else if (config.apiFormat === 'zhipu') {
        return await callZhipuAPI(config.modelsEndpoint, apiKey, model, prompt);
    } else if (config.apiFormat === 'azure') {
        const endpoint = config.modelsEndpoint.replace('{serverUrl}', serverUrl).replace('{model}', model);
        return await callOpenAICompatibleAPI(endpoint, apiKey, model, prompt);
    } else if (config.apiFormat === 'ollama') {
        const endpoint = config.modelsEndpoint.replace('{serverUrl}', serverUrl);
        return await callOllamaAPI(endpoint, model, prompt);
    } else if (config.apiFormat === 'custom-openai') {
        const endpoints = buildEndpointCandidates(serverUrl, '/chat/completions');
        return await callOpenAICompatibleAPI(endpoints, apiKey, model, prompt);
    } else if (config.apiFormat === 'custom-anthropic') {
        const endpoints = buildEndpointCandidates(serverUrl, '/messages');
        const modelCandidates = [
            model,
            'LongCat-Flash-Chat',
            'claude-3-5-haiku-latest',
            'claude-3-5-sonnet-latest'
        ].filter(Boolean);
        return await callAnthropicAPI(endpoints, apiKey, modelCandidates, prompt);
    } else {
        throw new Error(`未支持的API格式: ${config.apiFormat}`);
    }
}


// --- OpenAI兼容API ---
async function callOpenAICompatibleAPI(endpoint, apiKey, model, prompt) {
    const endpoints = Array.isArray(endpoint) ? endpoint : [endpoint];
    let lastError = null;

    for (let i = 0; i < endpoints.length; i++) {
        const currentEndpoint = endpoints[i];
        const headers = {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        };

        // OpenRouter 推荐添加这些 Header 以识别应用
        if (currentEndpoint.includes('openrouter.ai')) {
            headers['HTTP-Referer'] = 'https://github.com/Abelliuxl/ez-translate';
            headers['X-Title'] = 'EZ Translate';
            headers['X-OpenRouter-Title'] = 'EZ Translate';
        }

        try {
            const response = await fetch(currentEndpoint, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    model: model,
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 2048,
                    temperature: 0.3,
                }),
                credentials: 'omit'
            });

            if (!response.ok) {
                if (response.status === 404 && i < endpoints.length - 1) {
                    continue;
                }
                const errorMessage = await extractErrorMessage(response, 'API 请求失败');
                throw new Error(errorMessage);
            }

            const data = await response.json();
            return data.choices[0].message.content.trim();
        } catch (error) {
            lastError = error;
            if (i === endpoints.length - 1) {
                throw error;
            }
        }
    }

    throw lastError || new Error('API 请求失败');
}


// --- Anthropic API ---
async function callAnthropicAPI(endpoint, apiKey, model, prompt) {
    const endpoints = Array.isArray(endpoint) ? endpoint : [endpoint];
    const modelCandidates = Array.isArray(model) ? [...new Set(model)] : [model];
    let lastError = null;
    const authHeaderVariants = [
        {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
        },
        {
            'Authorization': `Bearer ${apiKey}`,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
        }
    ];

    for (let i = 0; i < endpoints.length; i++) {
        const currentEndpoint = endpoints[i];
        for (let k = 0; k < modelCandidates.length; k++) {
            const currentModel = modelCandidates[k];
            for (let j = 0; j < authHeaderVariants.length; j++) {
                try {
                    const response = await fetch(currentEndpoint, {
                        method: 'POST',
                        headers: authHeaderVariants[j],
                        body: JSON.stringify({
                            model: currentModel,
                            max_tokens: 2048,
                            messages: [{ role: 'user', content: prompt }],
                            temperature: 0.3,
                        }),
                        credentials: 'omit'
                    });

                    if (!response.ok) {
                        if (response.status === 404) {
                            // 某些兼容网关在认证头不匹配时也会返回 404，先切换认证头再试
                            if (j < authHeaderVariants.length - 1) {
                                continue;
                            }
                            if (k < modelCandidates.length - 1 || i < endpoints.length - 1) {
                                break;
                            }
                        }
                        if ((response.status === 401 || response.status === 403) && j < authHeaderVariants.length - 1) {
                            continue;
                        }
                        const errorMessage = await extractErrorMessage(response, 'Anthropic API 请求失败');
                        throw new Error(errorMessage);
                    }

                    const data = await response.json();
                    return data.content[0].text.trim();
                } catch (error) {
                    lastError = error;
                    if (j === authHeaderVariants.length - 1 &&
                        k === modelCandidates.length - 1 &&
                        i === endpoints.length - 1) {
                        throw error;
                    }
                }
            }
        }
    }

    throw lastError || new Error('Anthropic API 请求失败');
}


// --- Google API ---
async function callGoogleAPI(endpoint, apiKey, model, prompt) {
    const url = endpoint.replace('{model}', model) + `?key=${apiKey}`;
    
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
        }),
    });

    if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.error.message || `Google API 请求失败`);
    }
    
    const data = await response.json();
    return data.candidates[0].content.parts[0].text.trim();
}


// --- 智谱API ---
async function callZhipuAPI(endpoint, apiKey, model, prompt) {
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 2048,
            temperature: 0.3,
        }),
    });

    if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.error?.message || `智谱API 请求失败`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content.trim();
}


// --- Ollama API ---
async function callOllamaAPI(endpoint, model, prompt) {
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: model,
            prompt: prompt,
            stream: false,
        }),
    });
    
    if (!response.ok) {
        if (response.status === 403) {
            throw new Error('Ollama 服务器拒绝请求。请设置环境变量 OLLAMA_ORIGINS="*" 并重启 Ollama 服务。');
        }
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
            const errorBody = await response.text();
            try {
                const errorJson = JSON.parse(errorBody);
                errorMessage = errorJson.error || errorMessage;
            } catch (jsonError) {
                errorMessage = errorBody || errorMessage;
            }
        } catch (textError) {
            // 忽略解析错误，使用默认错误消息
        }
        throw new Error(errorMessage);
    }
    
    const responseText = await response.text();
    
    if (!responseText.trim()) {
        throw new Error('Ollama 返回了空响应，请检查模型是否正确加载');
    }
    
    try {
        const data = JSON.parse(responseText);
        if (!data.response) {
            throw new Error('Ollama 响应格式异常，缺少 response 字段');
        }
        return data.response.trim();
    } catch (jsonError) {
        throw new Error(`Ollama 响应解析失败: ${jsonError.message}`);
    }
}
