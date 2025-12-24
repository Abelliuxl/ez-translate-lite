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
    openai: {
        name: 'OpenAI',
        modelsEndpoint: 'https://api.openai.com/v1/chat/completions',
        visionEndpoint: 'https://api.openai.com/v1/chat/completions',
        apiFormat: 'openai',
        supportsVision: true
    },
    anthropic: {
        name: 'Anthropic Claude',
        modelsEndpoint: 'https://api.anthropic.com/v1/messages',
        visionEndpoint: 'https://api.anthropic.com/v1/messages',
        apiFormat: 'anthropic',
        supportsVision: true
    },
    google: {
        name: 'Google AI',
        modelsEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
        visionEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
        apiFormat: 'google',
        supportsVision: true
    },
    microsoft: {
        name: 'Microsoft Azure',
        modelsEndpoint: '{serverUrl}/openai/deployments/{model}/chat/completions?api-version=2024-02-15-preview',
        visionEndpoint: '{serverUrl}/openai/deployments/{model}/chat/completions?api-version=2024-02-15-preview',
        apiFormat: 'azure',
        supportsVision: true
    },
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
    together: {
        name: 'Together AI',
        modelsEndpoint: 'https://api.together.xyz/v1/chat/completions',
        visionEndpoint: 'https://api.together.xyz/v1/chat/completions',
        apiFormat: 'openai',
        supportsVision: true
    },
    groq: {
        name: 'Groq',
        modelsEndpoint: 'https://api.groq.com/openai/v1/chat/completions',
        visionEndpoint: 'https://api.groq.com/openai/v1/chat/completions',
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
    ollama: {
        name: 'Ollama',
        modelsEndpoint: '{serverUrl}/api/generate',
        visionEndpoint: '{serverUrl}/api/generate',
        apiFormat: 'ollama',
        supportsVision: false // 取决于模型
    },
    lmstudio: {
        name: 'LM Studio',
        modelsEndpoint: '{serverUrl}/v1/chat/completions',
        visionEndpoint: '{serverUrl}/v1/chat/completions',
        apiFormat: 'openai',
        supportsVision: false
    },
    vllm: {
        name: 'vLLM',
        modelsEndpoint: '{serverUrl}/v1/chat/completions',
        visionEndpoint: '{serverUrl}/v1/chat/completions',
        apiFormat: 'openai',
        supportsVision: false
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
    } else {
        throw new Error(`未支持的API格式: ${config.apiFormat}`);
    }
}


// --- OpenAI兼容API ---
async function callOpenAICompatibleAPI(endpoint, apiKey, model, prompt) {
    const headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
    };

    // OpenRouter 推荐添加这些 Header 以识别应用
    if (endpoint.includes('openrouter.ai')) {
        headers['HTTP-Referer'] = 'https://github.com/Abelliuxl/ez-translate';
        headers['X-Title'] = 'EZ Translate';
        headers['X-OpenRouter-Title'] = 'EZ Translate';
    }

    const response = await fetch(endpoint, {
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
        const errorBody = await response.json();
        throw new Error(errorBody.error?.message || `API 请求失败`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content.trim();
}


// --- Anthropic API ---
async function callAnthropicAPI(endpoint, apiKey, model, prompt) {
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            model: model,
            max_tokens: 2048,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
        }),
    });

    if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.error?.message || `Anthropic API 请求失败`);
    }
    
    const data = await response.json();
    return data.content[0].text.trim();
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
