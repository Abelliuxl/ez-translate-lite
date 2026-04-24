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
        handleTranslation({
            text: request.text,
            targetLanguage: request.targetLanguage,
            secondTargetLanguage: request.secondTargetLanguage,
            stream: Boolean(request.stream),
            requestId: request.requestId || '',
            sender,
            sendResponse
        });
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
async function handleTranslation({ text, targetLanguage, secondTargetLanguage, stream, requestId, sender, sendResponse }) {
    try {
        // 获取提供商设置
        const storage = await getStorage();
        const providerSettingsResult = await storage.get('providerSettings');
        const allProviderSettings = providerSettingsResult.providerSettings;
        if (!allProviderSettings) {
            sendResponse({ error: '请先在设置页面配置LLM提供商' });
            return;
        }
        
        const { currentProvider, apiKey, serverUrl, selectedModel, thinkingEnabled } = resolveActiveProviderSettings(allProviderSettings);
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

        const canStreamToTab = Boolean(stream && requestId && sender?.tab?.id);
        const sendProgress = canStreamToTab
            ? (payload) => sendTranslationStreamUpdate(sender.tab.id, requestId, payload)
            : null;

        if (sendProgress) {
            await sendProgress({
                stage: 'start',
                model: selectedModel
            });
        }
        
        // 调用翻译API
        const result = await callTranslationAPI({
            provider: currentProvider,
            config,
            apiKey,
            serverUrl,
            model: selectedModel,
            text,
            targetLanguage: actualTargetLanguage,
            secondTargetLanguage,
            thinkingEnabled,
            onProgress: sendProgress
        });

        if (sendProgress) {
            await sendProgress({
                stage: 'done',
                model: result.model || selectedModel,
                translation: result.translation
            });
        }
        
        sendResponse({
            translation: result.translation,
            model: result.model || selectedModel
        });
    } catch (error) {
        if (stream && requestId && sender?.tab?.id) {
            await sendTranslationStreamUpdate(sender.tab.id, requestId, {
                stage: 'error',
                error: error.message || String(error || '')
            });
        }
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

function pickFirstNonEmptyString(...values) {
    for (const value of values) {
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (trimmed) {
                return trimmed;
            }
        }
    }
    return '';
}

function resolveCurrentProvider(allSettings = {}) {
    if (allSettings.currentProvider) {
        return allSettings.currentProvider;
    }

    const providers = allSettings.providers;
    if (providers && typeof providers === 'object') {
        const providerIds = Object.keys(providers).filter(Boolean);
        if (providerIds.length === 1) {
            return providerIds[0];
        }
    }

    return '';
}

function resolveSelectedModel(providerData = {}, fallbackData = {}) {
    const useCustomModel = providerData.useCustomModel ?? fallbackData.useCustomModel ?? false;
    const selectedModel = pickFirstNonEmptyString(providerData.selectedModel, fallbackData.selectedModel);
    const customModel = pickFirstNonEmptyString(providerData.customModel, fallbackData.customModel);

    if (useCustomModel) {
        return customModel || selectedModel;
    }

    return selectedModel || customModel;
}

function resolveActiveProviderSettings(allSettings = {}) {
    const currentProvider = resolveCurrentProvider(allSettings);
    const providers = (allSettings.providers && typeof allSettings.providers === 'object')
        ? allSettings.providers
        : null;
    const hasProvidersMap = Boolean(providers && Object.keys(providers).length > 0);
    const providerData = (providers && currentProvider && providers[currentProvider]) || {};
    const hasProviderData = Object.keys(providerData).length > 0;
    const fallbackData = (!hasProvidersMap || hasProviderData) ? allSettings : {};

    return {
        currentProvider,
        apiKey: pickFirstNonEmptyString(providerData.apiKey, fallbackData.apiKey),
        serverUrl: pickFirstNonEmptyString(providerData.serverUrl, fallbackData.serverUrl),
        selectedModel: resolveSelectedModel(providerData, fallbackData),
        thinkingEnabled: providerData.thinkingEnabled ?? fallbackData.thinkingEnabled ?? false
    };
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

async function sendTranslationStreamUpdate(tabId, requestId, payload = {}) {
    if (!tabId || !requestId) {
        return;
    }

    return new Promise((resolve) => {
        try {
            chrome.tabs.sendMessage(tabId, {
                type: 'translation_stream',
                requestId,
                ...payload
            }, () => {
                // 接收端可能已经销毁，忽略该错误即可
                void chrome.runtime.lastError;
                resolve();
            });
        } catch (error) {
            resolve();
        }
    });
}

function sanitizeTranslationOutput(rawText = '') {
    if (!rawText) return '';

    let text = String(rawText);
    text = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
    text = text.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');

    const lowerText = text.toLowerCase();
    const openThinkIndex = lowerText.lastIndexOf('<think>');
    const openThinkingIndex = lowerText.lastIndexOf('<thinking>');
    const lastOpenIndex = Math.max(openThinkIndex, openThinkingIndex);
    if (lastOpenIndex !== -1) {
        const closeTag = lastOpenIndex === openThinkIndex ? '</think>' : '</thinking>';
        if (lowerText.indexOf(closeTag, lastOpenIndex) === -1) {
            text = text.slice(0, lastOpenIndex);
        }
    }

    return text;
}

function hasOpenThinkBlock(rawText = '') {
    if (!rawText) return false;

    const lowerText = String(rawText).toLowerCase();
    const openThinkIndex = lowerText.lastIndexOf('<think>');
    if (openThinkIndex !== -1 && lowerText.indexOf('</think>', openThinkIndex) === -1) {
        return true;
    }

    const openThinkingIndex = lowerText.lastIndexOf('<thinking>');
    if (openThinkingIndex !== -1 && lowerText.indexOf('</thinking>', openThinkingIndex) === -1) {
        return true;
    }

    return false;
}

function normalizeStructuredTextContent(content) {
    if (!content) {
        return '';
    }

    if (typeof content === 'string') {
        return content;
    }

    if (Array.isArray(content)) {
        return content.map((part) => {
            if (typeof part === 'string') {
                return part;
            }

            if (!part || typeof part !== 'object') {
                return '';
            }

            const partType = String(part.type || '').toLowerCase();
            if (partType.includes('reason') || partType.includes('think')) {
                return '';
            }

            if (typeof part.text === 'string') return part.text;
            if (typeof part.output_text === 'string') return part.output_text;
            if (typeof part.content === 'string') return part.content;
            return '';
        }).join('');
    }

    if (typeof content === 'object') {
        if (typeof content.text === 'string') return content.text;
        if (typeof content.output_text === 'string') return content.output_text;
        if (typeof content.content === 'string') return content.content;
    }

    return '';
}

function hasOpenAIReasoningDelta(delta) {
    if (!delta || typeof delta !== 'object') {
        return false;
    }

    if (typeof delta.reasoning === 'string' && delta.reasoning.trim()) return true;
    if (typeof delta.reasoning_content === 'string' && delta.reasoning_content.trim()) return true;
    if (typeof delta.thinking === 'string' && delta.thinking.trim()) return true;

    if (Array.isArray(delta.content)) {
        return delta.content.some((part) => {
            if (!part || typeof part !== 'object') {
                return false;
            }
            const partType = String(part.type || '').toLowerCase();
            return partType.includes('reason') || partType.includes('think');
        });
    }

    return false;
}

function extractOpenAIDeltaText(delta) {
    if (!delta || typeof delta !== 'object') {
        return '';
    }

    if (typeof delta.content === 'string') {
        return delta.content;
    }

    if (Array.isArray(delta.content)) {
        return delta.content.map((part) => {
            if (!part || typeof part !== 'object') {
                return '';
            }
            const partType = String(part.type || '').toLowerCase();
            if (partType.includes('reason') || partType.includes('think')) {
                return '';
            }
            if (typeof part.text === 'string') return part.text;
            if (typeof part.output_text === 'string') return part.output_text;
            if (typeof part.content === 'string') return part.content;
            return '';
        }).join('');
    }

    return '';
}

function extractOpenAIFinalText(data) {
    const choice = data?.choices?.[0];
    if (!choice) {
        return '';
    }

    const messageContent = normalizeStructuredTextContent(choice.message?.content);
    if (messageContent) {
        return messageContent;
    }

    return normalizeStructuredTextContent(choice.text);
}

function extractAnthropicFinalText(data) {
    if (!data) {
        return '';
    }

    if (Array.isArray(data.content)) {
        return data.content.map((part) => {
            if (!part || typeof part !== 'object') {
                return '';
            }

            const partType = String(part.type || '').toLowerCase();
            if (partType.includes('reason') || partType.includes('think')) {
                return '';
            }
            if (typeof part.text === 'string') {
                return part.text;
            }
            return '';
        }).join('');
    }

    return '';
}

function shouldFallbackToNonStream(status, message = '') {
    if (status === 400 || status === 404 || status === 415 || status === 422) {
        return true;
    }

    const lowerMessage = String(message).toLowerCase();
    return lowerMessage.includes('stream') || lowerMessage.includes('sse');
}

async function readSseDataLines(response, onDataLine) {
    const reader = response.body?.getReader();
    if (!reader) {
        throw new Error('流式响应不可读');
    }

    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let lineBreakIndex = buffer.indexOf('\n');
        while (lineBreakIndex !== -1) {
            const line = buffer.slice(0, lineBreakIndex).replace(/\r$/, '');
            buffer = buffer.slice(lineBreakIndex + 1);

            const trimmed = line.trim();
            if (trimmed.startsWith('data:')) {
                const dataLine = trimmed.slice(5).trim();
                if (dataLine) {
                    onDataLine(dataLine);
                }
            }

            lineBreakIndex = buffer.indexOf('\n');
        }
    }

    const finalBuffer = decoder.decode();
    if (finalBuffer) {
        buffer += finalBuffer;
    }

    const tail = buffer.trim();
    if (tail.startsWith('data:')) {
        const dataLine = tail.slice(5).trim();
        if (dataLine) {
            onDataLine(dataLine);
        }
    }
}


// --- 统一API调用 ---

/**
 * 调用文本翻译API
 */
async function callTranslationAPI({ provider, config, apiKey, serverUrl, model, text, targetLanguage, secondTargetLanguage, thinkingEnabled = false, onProgress = null }) {
    // 确保参数正确传递给 getMessage
    const prompt = chrome.i18n.getMessage('translationPrompt', [
        String(targetLanguage), 
        String(secondTargetLanguage), 
        String(text)
    ]);
    
    if (config.apiFormat === 'openai') {
        return await callOpenAICompatibleAPI(config.modelsEndpoint, apiKey, model, prompt, thinkingEnabled, onProgress);
    } else if (config.apiFormat === 'anthropic') {
        return await callAnthropicAPI(config.modelsEndpoint, apiKey, model, prompt, onProgress);
    } else if (config.apiFormat === 'google') {
        return await callGoogleAPI(config.modelsEndpoint, apiKey, model, prompt);
    } else if (config.apiFormat === 'zhipu') {
        return await callZhipuAPI(config.modelsEndpoint, apiKey, model, prompt, onProgress);
    } else if (config.apiFormat === 'azure') {
        const endpoint = config.modelsEndpoint.replace('{serverUrl}', serverUrl).replace('{model}', model);
        return await callOpenAICompatibleAPI(endpoint, apiKey, model, prompt, thinkingEnabled, onProgress);
    } else if (config.apiFormat === 'ollama') {
        const endpoint = config.modelsEndpoint.replace('{serverUrl}', serverUrl);
        return await callOllamaAPI(endpoint, model, prompt, onProgress);
    } else if (config.apiFormat === 'custom-openai') {
        const endpoints = buildEndpointCandidates(serverUrl, '/chat/completions');
        return await callOpenAICompatibleAPI(endpoints, apiKey, model, prompt, thinkingEnabled, onProgress);
    } else if (config.apiFormat === 'custom-anthropic') {
        const endpoints = buildEndpointCandidates(serverUrl, '/messages');
        const modelCandidates = [
            model,
            'LongCat-Flash-Chat',
            'claude-3-5-haiku-latest',
            'claude-3-5-sonnet-latest'
        ].filter(Boolean);
        return await callAnthropicAPI(endpoints, apiKey, modelCandidates, prompt, onProgress);
    } else {
        throw new Error(`未支持的API格式: ${config.apiFormat}`);
    }
}


// --- OpenAI兼容API ---
async function callOpenAICompatibleAPI(endpoint, apiKey, model, prompt, thinkingEnabled = false, onProgress = null) {
    const endpoints = Array.isArray(endpoint) ? endpoint : [endpoint];
    const streamRequested = typeof onProgress === 'function';
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

        const attemptModes = streamRequested ? [true, false] : [false];

        for (let modeIndex = 0; modeIndex < attemptModes.length; modeIndex++) {
            const streamMode = attemptModes[modeIndex];
            let response;

            try {
                const requestBody = {
                    model,
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 2048,
                    temperature: 0.3,
                    stream: streamMode
                };
                if (!thinkingEnabled) {
                    requestBody.thinking = { type: 'disabled' };
                }
                response = await fetch(currentEndpoint, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(requestBody),
                    credentials: 'omit'
                });
            } catch (error) {
                lastError = error;
                if (modeIndex === attemptModes.length - 1 && i === endpoints.length - 1) {
                    throw error;
                }
                continue;
            }

            if (!response.ok) {
                const errorMessage = await extractErrorMessage(response, 'API 请求失败');
                const requestError = new Error(errorMessage);
                requestError.status = response.status;
                lastError = requestError;

                if (streamMode && modeIndex < attemptModes.length - 1 && shouldFallbackToNonStream(response.status, errorMessage)) {
                    continue;
                }

                if (response.status === 404 && i < endpoints.length - 1) {
                    break;
                }
                throw requestError;
            }

            const responseContentType = response.headers.get('content-type') || '';
            if (streamMode && response.body && responseContentType.includes('text/event-stream')) {
                let rawText = '';
                let visibleText = '';
                let usedModel = model;
                let thinkingActive = false;

                const emitModel = (nextModel) => {
                    if (!onProgress) return;
                    const normalizedModel = (nextModel || '').trim();
                    if (!normalizedModel || normalizedModel === usedModel) return;
                    usedModel = normalizedModel;
                    onProgress({ stage: 'model', model: usedModel });
                };

                const emitText = (nextText) => {
                    if (!onProgress) return;
                    if (nextText === visibleText) return;
                    visibleText = nextText;
                    onProgress({ stage: 'text', text: visibleText, model: usedModel });
                };

                const emitThinking = (nextThinking) => {
                    if (!onProgress) return;
                    if (thinkingActive === nextThinking) return;
                    thinkingActive = nextThinking;
                    onProgress({ stage: 'thinking', active: thinkingActive, model: usedModel });
                };

                if (onProgress && usedModel) {
                    onProgress({ stage: 'model', model: usedModel });
                }

                await readSseDataLines(response, (dataLine) => {
                    if (dataLine === '[DONE]') {
                        return;
                    }

                    let payload;
                    try {
                        payload = JSON.parse(dataLine);
                    } catch (error) {
                        return;
                    }

                    if (typeof payload.model === 'string' && payload.model.trim()) {
                        emitModel(payload.model.trim());
                    }

                    const choice = payload.choices?.[0];
                    if (!choice) {
                        return;
                    }

                    const delta = choice.delta || {};
                    if (hasOpenAIReasoningDelta(delta)) {
                        emitThinking(true);
                    }

                    const chunkText = extractOpenAIDeltaText(delta);
                    if (chunkText) {
                        rawText += chunkText;
                        const sanitizedText = sanitizeTranslationOutput(rawText);
                        emitText(sanitizedText);
                        emitThinking(hasOpenThinkBlock(rawText));
                    }
                });

                const finalTranslation = sanitizeTranslationOutput(rawText).trim();
                emitThinking(false);

                if (!finalTranslation) {
                    if (modeIndex < attemptModes.length - 1) {
                        continue;
                    }
                    throw new Error('模型返回空内容');
                }

                return {
                    translation: finalTranslation,
                    model: usedModel || model
                };
            }

            const data = await response.json();
            const usedModel = (data.model || model || '').trim();
            const finalTranslation = sanitizeTranslationOutput(extractOpenAIFinalText(data)).trim();
            if (!finalTranslation) {
                throw new Error('模型返回空内容');
            }

            return {
                translation: finalTranslation,
                model: usedModel
            };
        }
    }

    throw lastError || new Error('API 请求失败');
}


// --- Anthropic API ---
async function callAnthropicAPI(endpoint, apiKey, model, prompt, onProgress = null) {
    const endpoints = Array.isArray(endpoint) ? endpoint : [endpoint];
    const modelCandidates = Array.isArray(model) ? [...new Set(model)] : [model];
    const streamRequested = typeof onProgress === 'function';
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
                const attemptModes = streamRequested ? [true, false] : [false];

                for (let modeIndex = 0; modeIndex < attemptModes.length; modeIndex++) {
                    const streamMode = attemptModes[modeIndex];

                    try {
                        const response = await fetch(currentEndpoint, {
                            method: 'POST',
                            headers: authHeaderVariants[j],
                            body: JSON.stringify({
                                model: currentModel,
                                max_tokens: 2048,
                                messages: [{ role: 'user', content: prompt }],
                                temperature: 0.3,
                                stream: streamMode
                            }),
                            credentials: 'omit'
                        });

                        if (!response.ok) {
                            const errorMessage = await extractErrorMessage(response, 'Anthropic API 请求失败');

                            if (streamMode && modeIndex < attemptModes.length - 1 && shouldFallbackToNonStream(response.status, errorMessage)) {
                                continue;
                            }

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
                            const requestError = new Error(errorMessage);
                            requestError.status = response.status;
                            throw requestError;
                        }

                        const responseContentType = response.headers.get('content-type') || '';
                        if (streamMode && response.body && responseContentType.includes('text/event-stream')) {
                            let rawText = '';
                            let visibleText = '';
                            let thinkingActive = false;
                            let usedModel = currentModel;

                            const emitModel = (nextModel) => {
                                if (!onProgress) return;
                                const normalizedModel = (nextModel || '').trim();
                                if (!normalizedModel || normalizedModel === usedModel) return;
                                usedModel = normalizedModel;
                                onProgress({ stage: 'model', model: usedModel });
                            };

                            const emitText = (nextText) => {
                                if (!onProgress) return;
                                if (nextText === visibleText) return;
                                visibleText = nextText;
                                onProgress({ stage: 'text', text: visibleText, model: usedModel });
                            };

                            const emitThinking = (nextThinking) => {
                                if (!onProgress) return;
                                if (thinkingActive === nextThinking) return;
                                thinkingActive = nextThinking;
                                onProgress({ stage: 'thinking', active: thinkingActive, model: usedModel });
                            };

                            if (onProgress && usedModel) {
                                onProgress({ stage: 'model', model: usedModel });
                            }

                            await readSseDataLines(response, (dataLine) => {
                                if (dataLine === '[DONE]') {
                                    return;
                                }

                                let payload;
                                try {
                                    payload = JSON.parse(dataLine);
                                } catch (error) {
                                    return;
                                }

                                if (payload.type === 'message_start' && payload.message?.model) {
                                    emitModel(payload.message.model);
                                }

                                const blockType = String(payload.content_block?.type || '').toLowerCase();
                                if (blockType.includes('think') || blockType.includes('reason')) {
                                    emitThinking(true);
                                }

                                const deltaType = String(payload.delta?.type || '').toLowerCase();
                                if (deltaType.includes('think') || deltaType.includes('reason')) {
                                    emitThinking(true);
                                }

                                let chunkText = '';
                                if (payload.type === 'content_block_start') {
                                    const startType = String(payload.content_block?.type || '').toLowerCase();
                                    if (startType === 'text' && typeof payload.content_block?.text === 'string') {
                                        chunkText = payload.content_block.text;
                                    }
                                } else if (payload.type === 'content_block_delta') {
                                    if (typeof payload.delta?.text === 'string') {
                                        chunkText = payload.delta.text;
                                    }
                                }

                                if (chunkText) {
                                    rawText += chunkText;
                                    const sanitizedText = sanitizeTranslationOutput(rawText);
                                    emitText(sanitizedText);
                                    emitThinking(hasOpenThinkBlock(rawText));
                                }

                                if (payload.type === 'message_stop') {
                                    emitThinking(false);
                                }
                            });

                            const finalTranslation = sanitizeTranslationOutput(rawText).trim();
                            emitThinking(false);

                            if (!finalTranslation) {
                                if (modeIndex < attemptModes.length - 1) {
                                    continue;
                                }
                                throw new Error('模型返回空内容');
                            }

                            return {
                                translation: finalTranslation,
                                model: usedModel
                            };
                        }

                        const data = await response.json();
                        const usedModel = (data.model || currentModel || '').trim();
                        const finalTranslation = sanitizeTranslationOutput(extractAnthropicFinalText(data)).trim();
                        if (!finalTranslation) {
                            throw new Error('模型返回空内容');
                        }

                        return {
                            translation: finalTranslation,
                            model: usedModel
                        };
                    } catch (error) {
                        lastError = error;
                        if (j === authHeaderVariants.length - 1 &&
                            k === modelCandidates.length - 1 &&
                            i === endpoints.length - 1 &&
                            modeIndex === attemptModes.length - 1) {
                            throw error;
                        }
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
    const translation = sanitizeTranslationOutput(data?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
    if (!translation) {
        throw new Error('模型返回空内容');
    }

    return {
        translation,
        model
    };
}


// --- 智谱API ---
async function callZhipuAPI(endpoint, apiKey, model, prompt, onProgress = null) {
    const streamRequested = typeof onProgress === 'function';
    const attemptModes = streamRequested ? [true, false] : [false];

    let lastError = null;

    for (let modeIndex = 0; modeIndex < attemptModes.length; modeIndex++) {
        const streamMode = attemptModes[modeIndex];
        let response;

        try {
            response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model,
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 2048,
                    temperature: 0.3,
                    stream: streamMode
                }),
            });
        } catch (error) {
            lastError = error;
            continue;
        }

        if (!response.ok) {
            const errorMessage = await extractErrorMessage(response, '智谱API 请求失败');
            const requestError = new Error(errorMessage);
            requestError.status = response.status;
            lastError = requestError;

            if (streamMode && modeIndex < attemptModes.length - 1 && shouldFallbackToNonStream(response.status, errorMessage)) {
                continue;
            }
            throw requestError;
        }

        const responseContentType = response.headers.get('content-type') || '';
        if (streamMode && response.body && responseContentType.includes('text/event-stream')) {
            let rawText = '';
            let visibleText = '';
            let thinkingActive = false;
            let usedModel = model;

            const emitText = (nextText) => {
                if (!onProgress) return;
                if (nextText === visibleText) return;
                visibleText = nextText;
                onProgress({ stage: 'text', text: visibleText, model: usedModel });
            };

            const emitThinking = (nextThinking) => {
                if (!onProgress) return;
                if (thinkingActive === nextThinking) return;
                thinkingActive = nextThinking;
                onProgress({ stage: 'thinking', active: thinkingActive, model: usedModel });
            };

            if (onProgress && usedModel) {
                onProgress({ stage: 'model', model: usedModel });
            }

            await readSseDataLines(response, (dataLine) => {
                if (dataLine === '[DONE]') {
                    return;
                }

                let payload;
                try {
                    payload = JSON.parse(dataLine);
                } catch (error) {
                    return;
                }

                if (typeof payload.model === 'string' && payload.model.trim()) {
                    usedModel = payload.model.trim();
                    if (onProgress) {
                        onProgress({ stage: 'model', model: usedModel });
                    }
                }

                const choice = payload.choices?.[0];
                if (!choice) {
                    return;
                }

                const delta = choice.delta || {};
                if (hasOpenAIReasoningDelta(delta)) {
                    emitThinking(true);
                }

                const chunkText = extractOpenAIDeltaText(delta);
                if (chunkText) {
                    rawText += chunkText;
                    const sanitizedText = sanitizeTranslationOutput(rawText);
                    emitText(sanitizedText);
                    emitThinking(hasOpenThinkBlock(rawText));
                }
            });

            emitThinking(false);
            const finalTranslation = sanitizeTranslationOutput(rawText).trim();
            if (!finalTranslation) {
                if (modeIndex < attemptModes.length - 1) {
                    continue;
                }
                throw new Error('模型返回空内容');
            }

            return {
                translation: finalTranslation,
                model: usedModel
            };
        }

        const data = await response.json();
        const usedModel = (data.model || model || '').trim();
        const finalTranslation = sanitizeTranslationOutput(extractOpenAIFinalText(data)).trim();
        if (!finalTranslation) {
            throw new Error('模型返回空内容');
        }

        return {
            translation: finalTranslation,
            model: usedModel
        };
    }

    throw lastError || new Error('智谱API 请求失败');
}


// --- Ollama API ---
async function callOllamaAPI(endpoint, model, prompt, onProgress = null) {
    const streamMode = typeof onProgress === 'function';
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model,
            prompt,
            stream: streamMode,
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

    if (streamMode && response.body) {
        let rawText = '';
        let visibleText = '';
        let thinkingActive = false;
        let usedModel = model;

        const emitText = (nextText) => {
            if (!onProgress) return;
            if (nextText === visibleText) return;
            visibleText = nextText;
            onProgress({ stage: 'text', text: visibleText, model: usedModel });
        };

        const emitThinking = (nextThinking) => {
            if (!onProgress) return;
            if (thinkingActive === nextThinking) return;
            thinkingActive = nextThinking;
            onProgress({ stage: 'thinking', active: thinkingActive, model: usedModel });
        };

        if (onProgress && usedModel) {
            onProgress({ stage: 'model', model: usedModel });
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            let lineBreakIndex = buffer.indexOf('\n');
            while (lineBreakIndex !== -1) {
                const line = buffer.slice(0, lineBreakIndex).trim();
                buffer = buffer.slice(lineBreakIndex + 1);

                if (line) {
                    let payload;
                    try {
                        payload = JSON.parse(line);
                    } catch (error) {
                        payload = null;
                    }

                    if (payload) {
                        if (typeof payload.model === 'string' && payload.model.trim()) {
                            usedModel = payload.model.trim();
                            if (onProgress) {
                                onProgress({ stage: 'model', model: usedModel });
                            }
                        }

                        if (typeof payload.thinking === 'string' && payload.thinking.trim()) {
                            emitThinking(true);
                        }

                        if (typeof payload.response === 'string' && payload.response) {
                            rawText += payload.response;
                            const sanitizedText = sanitizeTranslationOutput(rawText);
                            emitText(sanitizedText);
                            emitThinking(hasOpenThinkBlock(rawText));
                        }
                    }
                }

                lineBreakIndex = buffer.indexOf('\n');
            }
        }

        const finalChunk = decoder.decode();
        if (finalChunk) {
            buffer += finalChunk;
        }
        const tail = buffer.trim();
        if (tail) {
            try {
                const payload = JSON.parse(tail);
                if (typeof payload.response === 'string' && payload.response) {
                    rawText += payload.response;
                    const sanitizedText = sanitizeTranslationOutput(rawText);
                    emitText(sanitizedText);
                }
            } catch (error) {
                // 忽略尾部非 JSON 片段
            }
        }

        emitThinking(false);
        const finalTranslation = sanitizeTranslationOutput(rawText).trim();
        if (!finalTranslation) {
            throw new Error('Ollama 返回了空响应，请检查模型是否正确加载');
        }

        return {
            translation: finalTranslation,
            model: usedModel
        };
    }

    const responseText = await response.text();
    if (!responseText.trim()) {
        throw new Error('Ollama 返回了空响应，请检查模型是否正确加载');
    }

    try {
        const data = JSON.parse(responseText);
        const finalTranslation = sanitizeTranslationOutput(data.response || '').trim();
        if (!finalTranslation) {
            throw new Error('Ollama 响应格式异常，缺少 response 字段');
        }
        return {
            translation: finalTranslation,
            model: (data.model || model || '').trim()
        };
    } catch (jsonError) {
        throw new Error(`Ollama 响应解析失败: ${jsonError.message}`);
    }
}
