# Ask AI Vision Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-shot image description in Ask AI with three callable vision tools (`ocr_image`, `describe_image`, `answer_image`) so the Ask LLM can repeatedly analyze the attached image across multi-turn conversations.

**Architecture:** Service worker holds an in-memory `Map<image_ref, { mime, base64 }>`. The first user turn caches the image and pre-injects a 2-line `describe(short)` summary. On every turn, the Ask LLM may call the three new tools; the SW resolves the `image_ref` from the cache and re-invokes the configured OpenAI-compatible Vision LLM endpoint. The existing `askVisionEnabled` toggle and `askVisionConfigId` are reused; no new settings UI. Non-OpenAI-compatible providers fall back to the current pre-analysis path.

**Tech Stack:** Manifest V3 Chrome extension, vanilla JavaScript, OpenAI-compatible chat completions, Service Worker messaging.

**Spec:** [`docs/superpowers/specs/2026-07-03-ask-ai-vision-tools-design.md`](../specs/2026-07-03-ask-ai-vision-tools-design.md)

**Rollback anchor:** `pre-ask-vision-tools-v2.1.2` → `ce21b1e` on `origin/main` (already pushed).

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `src/background/background.js` | Modify | Add `askImageCache`, three new tool definitions, three new `executeAskTool` branches, cold-start describe call, image-stripping pass. |
| `src/settings/settings.html` | Modify | Update the `askVisionEnabled` hint copy (one paragraph). |
| `src/manifest.json` | Modify | Bump version 2.1.2 → 2.2.0. |

No new files. No new dependencies. No settings additions.

---

## Task 1: Add `askImageCache` module-level state

**Files:**
- Modify: `src/background/background.js:103-105` (just below `askVisionAnalysisCache`)

- [ ] **Step 1: Add the cache + counter next to the existing `askVisionAnalysisCache`**

In `src/background/background.js`, find the existing block:

```js
const ASK_IMAGE_CONTEXT_MENU_ID = 'llm-translate-ask-image';
const askVisionAnalysisCache = new Map();
const MAX_IMAGE_DATA_URL_BYTES = 6 * 1024 * 1024;
```

Replace it with:

```js
const ASK_IMAGE_CONTEXT_MENU_ID = 'llm-translate-ask-image';
const askVisionAnalysisCache = new Map();
const askImageCache = new Map();
let askImageCacheCounter = 0;
const ASK_IMAGE_CACHE_LIMIT = 8;
const MAX_IMAGE_DATA_URL_BYTES = 6 * 1024 * 1024;
```

- [ ] **Step 2: Add the cache helpers immediately after the helpers in `buildAskToolDefinitions` region, but before `executeAskTool`. Find `function parseToolCallArguments` (around line 1531) and insert the helpers immediately above it.**

Insert the following block directly above `function parseToolCallArguments`:

```js
function addImageEntry(sourceUrl, mime, base64) {
    askImageCacheCounter += 1;
    const imageRef = `image_${askImageCacheCounter}`;
    if (askImageCache.size >= ASK_IMAGE_CACHE_LIMIT) {
        const oldestKey = askImageCache.keys().next().value;
        askImageCache.delete(oldestKey);
    }
    askImageCache.set(imageRef, {
        imageRef,
        sourceUrl,
        mime,
        base64,
        cachedAt: Date.now()
    });
    return imageRef;
}

function getImageEntry(imageRef) {
    return askImageCache.get(imageRef) || null;
}
```

- [ ] **Step 3: Verify the file still parses**

Open `chrome://extensions`, toggle the extension off and on, click "service worker" → "Inspect". In the console, type:

```js
addImageEntry('https://example.com/a.png', 'image/png', 'AAAA')
```

Expected: prints `"image_1"`. (This is a smoke check that the module loaded. The function is module-scoped so it is not on `globalThis`; this step is informational only — skip the smoke test if the function is not in scope.)

- [ ] **Step 4: Commit**

```bash
git add src/background/background.js
git commit -m "feat(ask): add askImageCache for vision tool image_ref resolution"
```

---

## Task 2: Add the three tool definitions

**Files:**
- Modify: `src/background/background.js` — `buildAskToolDefinitions` (around line 1355)

- [ ] **Step 1: Append three new tool definitions to the array returned by `buildAskToolDefinitions`**

Find:

```js
function buildAskToolDefinitions() {
    return [
        {
            type: 'function',
            function: {
                name: 'tavily_search',
                ...
            }
        },
        {
            type: 'function',
            function: {
                name: 'web_fetch',
                ...
            }
        }
    ];
}
```

Replace the closing `];` block by appending three more entries inside the array (after the `web_fetch` entry, before the final `];`):

```js
        ,
        {
            type: 'function',
            function: {
                name: 'ocr_image',
                description: 'Extract every character of text from the attached image verbatim, in reading order. Do not translate or summarize.',
                parameters: {
                    type: 'object',
                    properties: {
                        image_ref: {
                            type: 'string',
                            description: 'Optional. Image reference id (e.g. "image_1"). Defaults to the currently attached image.'
                        }
                    },
                    required: []
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'describe_image',
                description: 'Objectively describe the attached image at the requested detail level.',
                parameters: {
                    type: 'object',
                    properties: {
                        image_ref: {
                            type: 'string',
                            description: 'Optional. Image reference id (e.g. "image_1"). Defaults to the currently attached image.'
                        },
                        detail: {
                            type: 'string',
                            enum: ['short', 'medium', 'long'],
                            default: 'medium',
                            description: 'Length of the description. short <= 60 CJK or 120 Latin chars; medium <= 180 CJK or 360 Latin chars; long <= 600 CJK or 1200 Latin chars.'
                        }
                    },
                    required: []
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'answer_image',
                description: 'Answer a question grounded solely in the attached image. Use this when the user asks something specific about the image and the answer requires new visual evidence.',
                parameters: {
                    type: 'object',
                    properties: {
                        image_ref: {
                            type: 'string',
                            description: 'Optional. Image reference id (e.g. "image_1"). Defaults to the currently attached image.'
                        },
                        question: {
                            type: 'string',
                            description: 'The question to answer based on the image.'
                        },
                        context: {
                            type: 'string',
                            description: 'Optional extra context or hints for the visual QA.'
                        }
                    },
                    required: ['question']
                }
            }
        }
    ];
}
```

- [ ] **Step 2: Visually confirm three new functions are in the array**

Open the file. Confirm the array now contains exactly 5 entries in this order: `tavily_search`, `web_fetch`, `ocr_image`, `describe_image`, `answer_image`.

- [ ] **Step 3: Commit**

```bash
git add src/background/background.js
git commit -m "feat(ask): define ocr_image/describe_image/answer_image tool schemas"
```

---

## Task 3: Add the three tool executor branches

**Files:**
- Modify: `src/background/background.js` — `executeAskTool` (around line 1541)

- [ ] **Step 1: Add three new system-prompt constants near the existing `ASK_WEB_TOOLS_SYSTEM_PROMPT`**

Find the block around line 96:

```js
const ASK_WEB_TOOLS_SYSTEM_PROMPT = [
    '你是带有联网工具的 Ask 助手。',
    ...
].join('\n');
```

Insert directly below it:

```js
const ASK_VISION_TOOL_SYSTEM_PROMPT = {
    ocr: '按图中的阅读顺序逐字抽取所有可见文字。仅输出抽取到的文字本身，不要翻译、不要总结、不要加评论。保留原始换行。',
    describe: '客观描述这张图片。以图片主体为开头，使用现在时、第三人称。不要推测意图。',
    answer: '你是视觉问答助手。回答必须完全基于图片中可见的内容。如果图片信息不足，回答「图片未提供足够信息」。不要猜测。'
};
```

- [ ] **Step 2: Add a helper `callAskVisionTool` near `callOpenAICompatibleVisionAnalysis` (around line 1287) for the three tools' shared network call**

Insert the following function directly above `function buildOpenAICompatibleHeaders`:

```js
async function callAskVisionTool({ entry, system, userText, maxTokens, apiKey, serverUrl, providerConfig, model }) {
    const endpoints = getOpenAICompatibleVisionEndpoints(providerConfig, serverUrl, model);
    let lastError = null;

    for (let i = 0; i < endpoints.length; i += 1) {
        const endpoint = endpoints[i];
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: buildOpenAICompatibleHeaders(endpoint, apiKey),
                body: JSON.stringify({
                    model,
                    messages: [
                        { role: 'system', content: system },
                        {
                            role: 'user',
                            content: [
                                { type: 'text', text: userText },
                                { type: 'image_url', image_url: { url: `data:${entry.mime};base64,${entry.base64}` } }
                            ]
                        }
                    ],
                    max_tokens: maxTokens,
                    temperature: 0.2,
                    stream: false
                }),
                credentials: 'omit'
            });
            if (!response.ok) {
                const errorMessage = await extractErrorMessage(response, 'Vision 工具调用失败');
                const requestError = new Error(errorMessage);
                requestError.status = response.status;
                throw requestError;
            }
            const data = await response.json();
            const text = sanitizeTranslationOutput(extractOpenAIFinalText(data)).trim();
            if (!text) throw new Error('Vision LLM 返回空内容');
            return { content: text, model: (data.model || model || '').trim() };
        } catch (error) {
            lastError = error;
            if (error.status === 404 && i < endpoints.length - 1) continue;
            throw error;
        }
    }
    throw lastError || new Error('Vision 工具调用失败');
}
```

- [ ] **Step 3: Extend `executeAskTool` with three new branches**

Find:

```js
async function executeAskTool({ toolName, args, tavilyApiKey, toolState, emitToolStatus }) {
    if (toolName === 'tavily_search') {
        ...
    }

    if (toolName === 'web_fetch') {
        ...
    }

    return { error: `未知工具: ${toolName || 'unknown'}` };
}
```

Replace the final `return { error: ... }` line with the three new branches followed by the fallback. The complete new function body:

```js
async function executeAskTool({ toolName, args, tavilyApiKey, toolState, emitToolStatus, visionCtx = null }) {
    if (toolName === 'tavily_search') {
        if (toolState.searches >= ASK_TOOL_LIMITS.maxSearches) {
            return { error: `搜索次数已达上限 ${ASK_TOOL_LIMITS.maxSearches}` };
        }
        toolState.searches += 1;
        const query = String(args.query || '').trim();
        if (!query) return { error: '缺少搜索关键词' };
        const maxResults = clampInteger(args.max_results, 1, ASK_TOOL_LIMITS.maxSearchResults, ASK_TOOL_LIMITS.maxSearchResults);
        emitToolStatus(`正在搜索：${query}`);
        return await tavilySearch({ apiKey: tavilyApiKey, query, maxResults });
    }

    if (toolName === 'web_fetch') {
        if (toolState.fetches >= ASK_TOOL_LIMITS.maxFetches) {
            return { error: `网页抓取次数已达上限 ${ASK_TOOL_LIMITS.maxFetches}` };
        }
        toolState.fetches += 1;
        const url = String(args.url || '').trim();
        emitToolStatus(`正在打开网页：${url}`);
        return await fetchReadableWebPage(url);
    }

    if (toolName === 'ocr_image' || toolName === 'describe_image' || toolName === 'answer_image') {
        if (!visionCtx) {
            return { error: '当前 Ask LLM 未启用独立 Vision 工具' };
        }
        const { apiKey, serverUrl, model, providerConfig } = visionCtx;
        const imageRef = String(args.image_ref || 'image_1');
        const entry = getImageEntry(imageRef);
        if (!entry) {
            return { error: '图片已失效，请重新附带' };
        }
        if (toolName === 'answer_image') {
            const question = String(args.question || '').trim();
            if (!question) return { error: '缺少问题' };
            const context = String(args.context || '').trim();
            emitToolStatus(`正在针对图片回答问题：${question}`);
            try {
                const userText = context ? `${question}\n\n上下文：${context}` : question;
                return await callAskVisionTool({
                    entry,
                    system: ASK_VISION_TOOL_SYSTEM_PROMPT.answer,
                    userText,
                    maxTokens: 800,
                    apiKey,
                    serverUrl,
                    providerConfig,
                    model
                });
            } catch (error) {
                return { error: error.message || 'Vision 工具调用失败' };
            }
        }
        if (toolName === 'ocr_image') {
            emitToolStatus('正在 OCR 图片');
            try {
                return await callAskVisionTool({
                    entry,
                    system: ASK_VISION_TOOL_SYSTEM_PROMPT.ocr,
                    userText: '请抽取图中的全部文字。',
                    maxTokens: 1500,
                    apiKey,
                    serverUrl,
                    providerConfig,
                    model
                });
            } catch (error) {
                return { error: error.message || 'Vision 工具调用失败' };
            }
        }
        // describe_image
        const detail = ['short', 'medium', 'long'].includes(args.detail) ? args.detail : 'medium';
        const detailHint = {
            short: '请简略描述这张图片。',
            medium: '请详细描述这张图片。',
            long: '请尽可能详尽地描述这张图片中的所有可见元素。'
        }[detail];
        emitToolStatus(`正在描述图片（${detail}）`);
        try {
            return await callAskVisionTool({
                entry,
                system: ASK_VISION_TOOL_SYSTEM_PROMPT.describe,
                userText: detailHint,
                maxTokens: detail === 'long' ? 1500 : 800,
                apiKey,
                serverUrl,
                providerConfig,
                model
            });
        } catch (error) {
            return { error: error.message || 'Vision 工具调用失败' };
        }
    }

    return { error: `未知工具: ${toolName || 'unknown'}` };
}
```

- [ ] **Step 4: Commit**

```bash
git add src/background/background.js
git commit -m "feat(ask): implement ocr/describe/answer image tool executors"
```

---

## Task 4: Cache the image, strip `image_url` parts, and inject the cold-start summary in `handleAsk`

**Files:**
- Modify: `src/background/background.js` — `handleAsk` (around line 515)

- [ ] **Step 1: Add a helper that resolves the image_ref for the current request**

Insert this function directly above `async function handleAsk`:

```js
function collectImageRefsFromMessages(messages, visionConfig) {
    const refs = [];
    const seen = new Set();
    if (!visionConfig) return refs;
    const imageUrls = extractImageUrlsFromMessages(messages);
    imageUrls.forEach((url) => {
        if (!url || seen.has(url)) return;
        seen.add(url);
        let entry = null;
        for (const candidate of askImageCache.values()) {
            if (candidate.sourceUrl === url) {
                entry = candidate;
                break;
            }
        }
        if (entry) {
            refs.push(entry.imageRef);
            return;
        }
        // Not in cache yet: data URLs we can decode directly; http(s) we mark and let handleAsk fetch.
        if (url.startsWith('data:')) {
            const match = url.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
                const mime = match[1];
                const base64 = match[2];
                const imageRef = addImageEntry(url, mime, base64);
                refs.push(imageRef);
            }
        } else {
            // http(s) URL: ask handleAsk to fetch+cache it. Stash a placeholder.
            refs.push({ pendingUrl: url });
        }
    });
    return refs;
}
```

- [ ] **Step 2: Refactor the `handleAsk` image branch**

Find the block:

```js
        const hasImageInput = messagesContainImages(messages);
        let askMessages = messages;

        if (hasImageInput && settingsResult.askVisionEnabled === true) {
            askMessages = await buildAskMessagesWithVisionAnalysis({
                messages,
                configs,
                visionConfigId: settingsResult.askVisionConfigId,
                onProgress: sendProgress
            });
        } else if (hasImageInput && !isOpenAICompatibleApiFormat(config.apiFormat)) {
            sendResponse({ error: '图片 Ask 直接发送目前仅支持 OpenAI-compatible LLM；请在 Ask 设置中启用独立 Vision LLM 解析。' });
            return;
        }
```

Replace it with the new logic that:
- Resolves the vision config
- Caches the image (data URLs synchronously, http(s) via `fetchImageAsDataUrl`)
- Strips `image_url` parts
- If `useSearchTools` (Ask LLM is OpenAI-compatible AND search enabled), pre-injects a 2-line `describe_image(short)` summary; otherwise falls back to the legacy pre-analysis path

```js
        const hasImageInput = messagesContainImages(messages);
        let askMessages = messages;
        let visionCtx = null;
        let imageRefForTools = null;

        if (hasImageInput && settingsResult.askVisionEnabled === true) {
            const visionConfig = configs.find(c => c.id === settingsResult.askVisionConfigId);
            if (!visionConfig) {
                sendResponse({ error: '图片 Ask 的 Vision LLM 配置不存在' });
                return;
            }
            const resolvedVision = resolveConfigSettings(visionConfig);
            const visionProviderConfig = PROVIDER_CONFIG[resolvedVision.currentProvider];
            if (!visionProviderConfig || !isOpenAICompatibleApiFormat(visionProviderConfig.apiFormat)) {
                sendResponse({ error: '独立 Vision LLM 解析目前仅支持 OpenAI-compatible 配置' });
                return;
            }
            visionCtx = {
                apiKey: resolvedVision.apiKey,
                serverUrl: resolvedVision.serverUrl,
                model: resolvedVision.selectedModel,
                providerConfig: visionProviderConfig
            };

            // Cache every image URL in the messages, deduplicating against existing entries.
            const imageUrls = extractImageUrlsFromMessages(messages);
            for (const url of imageUrls) {
                if (!url) continue;
                let entry = null;
                for (const candidate of askImageCache.values()) {
                    if (candidate.sourceUrl === url) {
                        entry = candidate;
                        break;
                    }
                }
                if (entry) {
                    imageRefForTools = entry.imageRef;
                    continue;
                }
                if (url.startsWith('data:')) {
                    const match = url.match(/^data:([^;]+);base64,(.+)$/);
                    if (!match) continue;
                    const mime = match[1];
                    const base64 = match[2];
                    imageRefForTools = addImageEntry(url, mime, base64);
                } else {
                    try {
                        const dataUrl = await fetchImageAsDataUrl(url);
                        const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
                        if (!match) continue;
                        imageRefForTools = addImageEntry(url, match[1], match[2]);
                    } catch (error) {
                        sendResponse({ error: `图片加载失败：${error.message || 'unknown'}` });
                        return;
                    }
                }
            }

            // Strip image_url parts and replace with a textual note so the model can refer to the ref.
            askMessages = (Array.isArray(messages) ? messages : []).map((message) => {
                if (!Array.isArray(message?.content)) return message;
                const text = extractTextFromStructuredContent(message.content);
                const note = imageRefForTools
                    ? `（图片已转为可调用的工具：${imageRefForTools}）`
                    : '（图片已附带但未能缓存到 vision 工具）';
                return { ...message, content: text ? `${text}\n${note}` : note };
            });
        } else if (hasImageInput && !isOpenAICompatibleApiFormat(config.apiFormat)) {
            sendResponse({ error: '图片 Ask 直接发送目前仅支持 OpenAI-compatible LLM；请在 Ask 设置中启用独立 Vision LLM 解析。' });
            return;
        }
```

- [ ] **Step 3: Update the tool-call branch to pass `visionCtx` and inject the cold-start summary**

Find:

```js
        const useSearchTools = settingsResult.askSearchEnabled === true && Boolean((settingsResult.askTavilyApiKey || '').trim());
        let result;
        if (useSearchTools) {
            if (!isOpenAICompatibleApiFormat(config.apiFormat)) {
                sendResponse({ error: 'Ask 联网搜索目前仅支持 OpenAI-compatible LLM 配置' });
                return;
            }

            result = await callOpenAICompatibleAskWithTools({
                config,
                apiKey,
                serverUrl,
                model: selectedModel,
                messages: askMessages,
                tavilyApiKey: settingsResult.askTavilyApiKey.trim(),
                onProgress: sendProgress
            });
```

Replace with:

```js
        const useSearchTools = settingsResult.askSearchEnabled === true && Boolean((settingsResult.askTavilyApiKey || '').trim());
        const isFirstAskTurn = askMessages.every(m => m.role !== 'assistant');
        let result;
        if (useSearchTools) {
            if (!isOpenAICompatibleApiFormat(config.apiFormat)) {
                sendResponse({ error: 'Ask 联网搜索目前仅支持 OpenAI-compatible LLM 配置' });
                return;
            }

            // Cold-start: on the first turn, inject a 2-line describe_image(short) summary so
            // "what is this?" still works without the model calling a tool.
            if (isFirstAskTurn && visionCtx && imageRefForTools) {
                try {
                    if (sendProgress) sendProgress({ stage: 'tool_status', text: '正在解析图片', model: visionCtx.model });
                    const entry = getImageEntry(imageRefForTools);
                    if (entry) {
                        const brief = await callAskVisionTool({
                            entry,
                            system: ASK_VISION_TOOL_SYSTEM_PROMPT.describe,
                            userText: '请简略描述这张图片。',
                            maxTokens: 400,
                            apiKey: visionCtx.apiKey,
                            serverUrl: visionCtx.serverUrl,
                            providerConfig: visionCtx.providerConfig,
                            model: visionCtx.model
                        });
                        if (brief && brief.content) {
                            const summary = brief.content.length > 200 ? `${brief.content.slice(0, 200)}…` : brief.content;
                            askMessages = askMessages.map((m, idx) => {
                                if (idx === 0 || m.role !== 'user') return m;
                                const text = extractTextFromStructuredContent(m.content);
                                return { ...m, content: `图片背景：${summary}\n\n${text}` };
                            });
                        }
                    }
                } catch (error) {
                    if (sendProgress) sendProgress({ stage: 'tool_status', text: '图片冷启动描述失败', model: visionCtx.model });
                }
            }

            result = await callOpenAICompatibleAskWithTools({
                config,
                apiKey,
                serverUrl,
                model: selectedModel,
                messages: askMessages,
                tavilyApiKey: settingsResult.askTavilyApiKey.trim(),
                visionCtx,
                onProgress: sendProgress
            });
```

- [ ] **Step 4: Pass `visionCtx` into `executeAskTool` calls inside `callOpenAICompatibleAskWithToolsAtEndpoint`**

Find the `executeAskTool` invocation inside the tool-call loop (around the `for (const toolCall of toolCalls)` block, currently around line 1511):

```js
            const toolResult = await executeAskTool({
                toolName,
                args,
                tavilyApiKey,
                toolState,
                emitToolStatus
            });
```

Replace with:

```js
            const toolResult = await executeAskTool({
                toolName,
                args,
                tavilyApiKey,
                toolState,
                emitToolStatus,
                visionCtx
            });
```

- [ ] **Step 5: Update `callOpenAICompatibleAskWithTools` signature to accept and forward `visionCtx`**

Find:

```js
async function callOpenAICompatibleAskWithTools({ config, apiKey, serverUrl, model, messages, tavilyApiKey, onProgress = null }) {
```

Replace with:

```js
async function callOpenAICompatibleAskWithTools({ config, apiKey, serverUrl, model, messages, tavilyApiKey, visionCtx = null, onProgress = null }) {
```

Find:

```js
            return await callOpenAICompatibleAskWithToolsAtEndpoint({
                endpoint: endpoints[i],
                apiKey,
                model,
                messages,
                tavilyApiKey,
                onProgress
            });
```

Replace with:

```js
            return await callOpenAICompatibleAskWithToolsAtEndpoint({
                endpoint: endpoints[i],
                apiKey,
                model,
                messages,
                tavilyApiKey,
                visionCtx,
                onProgress
            });
```

Find:

```js
async function callOpenAICompatibleAskWithToolsAtEndpoint({ endpoint, apiKey, model, messages, tavilyApiKey, onProgress = null }) {
```

Replace with:

```js
async function callOpenAICompatibleAskWithToolsAtEndpoint({ endpoint, apiKey, model, messages, tavilyApiKey, visionCtx = null, onProgress = null }) {
```

- [ ] **Step 6: Verify the build loads**

Open `chrome://extensions`, click the service worker link. In the console:

```js
typeof askImageCache === 'object' && typeof addImageEntry === 'function'
```

Expected: `true` (this is a smoke check that the module loaded without syntax errors). If `addImageEntry` is not in scope, the page-level test fails — instead, just confirm the SW starts cleanly and the extension does not show a "service worker (inactive)" badge.

- [ ] **Step 7: Commit**

```bash
git add src/background/background.js
git commit -m "feat(ask): wire askImageCache, image_url stripping, and cold-start describe in handleAsk"
```

---

## Task 5: Update the settings hint copy and bump the manifest version

**Files:**
- Modify: `src/settings/settings.html:140-143` (hint copy under the `ask-vision-toggle` checkbox)
- Modify: `src/manifest.json` (version field, line 4)

- [ ] **Step 1: Replace the hint copy in `settings.html`**

Find:

```html
                <label for="ask-vision-toggle">
                    <input type="checkbox" id="ask-vision-toggle">
                    图片 Ask 使用独立 Vision LLM 解析
                </label>
                <p class="hint">关闭时，图片会直接发送给 Ask LLM；开启时，先用下面选择的 Vision LLM 解析图片，再把解析结果交给 Ask LLM。</p>
```

Replace with:

```html
                <label for="ask-vision-toggle">
                    <input type="checkbox" id="ask-vision-toggle">
                    图片 Ask 使用独立 Vision LLM 解析
                </label>
                <p class="hint">关闭时，图片会直接发送给 Ask LLM；开启时，图片会转为可在 Ask 对话中反复调用的 OCR / 描述 / 视觉问答工具（首轮自动注入 2 行简短描述保持冷启动体验）。仅在使用 OpenAI 兼容的 Ask LLM 时生效。</p>
```

- [ ] **Step 2: Bump manifest version**

In `src/manifest.json`, change:

```json
  "version": "2.1.2",
```

to:

```json
  "version": "2.2.0",
```

- [ ] **Step 3: Commit**

```bash
git add src/settings/settings.html src/manifest.json
git commit -m "chore(ask): document vision tools in settings hint and bump to 2.2.0"
```

---

## Task 6: Manual end-to-end smoke test

**Files:** None. This task is a manual verification gate.

- [ ] **Step 1: Cold-start, no follow-up**

1. Open `chrome://extensions`, reload the extension.
2. Open any webpage with an image. Right-click the image → "Ask AI ?".
3. The Ask dialog appears with the image attached.
4. Type: "这是什么?"
5. Expected: a sensible answer that mentions the image content (cold-start `describe(short)` summary).

- [ ] **Step 2: OCR follow-up**

1. Continue from Step 1 (or start a new session with a screenshot that has visible text).
2. Type: "把图里那段代码 OCR 出来"
3. Expected: a `tool_status` event of "正在 OCR 图片" flashes briefly, then the model returns the OCR text.

- [ ] **Step 3: Targeted visual QA**

1. Attach a chart screenshot.
2. Type: "第 3 个柱子是多少?"
3. Expected: a `tool_status` of "正在针对图片回答问题：…" flashes, then a numeric answer grounded in the chart.

- [ ] **Step 4: Long describe**

1. Attach a busy image.
2. Type: "详细描述这张图"
3. Expected: a long, structured description. (`describe_image(detail=long)`.)

- [ ] **Step 5: Vision LLM disabled fallback**

1. Settings → Ask → uncheck "图片 Ask 使用独立 Vision LLM 解析" → Save.
2. Open the popup, configure an OpenAI-compatible Ask LLM (any provider).
3. Attach an image, ask a question.
4. Expected: image is inlined into the first message via the existing path; no tool call appears. (This is the v2.1.2 behavior with one improvement: the Ask LLM must be OpenAI-compatible or you see the "图片 Ask 直接发送目前仅支持 OpenAI-compatible LLM" error — same as before.)

- [ ] **Step 6: Non-OpenAI-compatible provider (Anthropic) regression**

1. Configure the Ask LLM as an Anthropic-compatible provider with `askVisionEnabled=true`.
2. Attach an image, ask a question.
3. Expected: error "独立 Vision LLM 解析目前仅支持 OpenAI-compatible 配置" (matches the v2.1.2 path). Behavior identical to v2.1.2 except the error wording is preserved.

- [ ] **Step 7: Service-worker restart between turns**

1. Attach an image and start a conversation.
2. Open `chrome://serviceworker-internals`, click "Stop" on the extension's SW.
3. Wait a few seconds. SW restarts.
4. Type another follow-up. Expected: tool returns `{ error: '图片已失效，请重新附带' }` (cache is empty). Model surfaces the error. Re-attach the image to continue.

- [ ] **Step 8: Tag the release**

```bash
git tag -a v2.2.0 -m "v2.2.0: Ask AI now exposes ocr/describe/answer_image as callable tools"
git push origin v2.2.0
```

---

## Self-Review Checklist

(For the plan author. Delete or keep as a section header.)

- [x] **Spec coverage:** Every spec section maps to a task.
  - §2 Goal → Tasks 1-4 (cache + tools + cold-start).
  - §3 Architecture → Task 4 (handleAsk rewire).
  - §4.1 askImageCache → Task 1.
  - §4.2 Tool definitions → Task 2.
  - §4.3 executeAskTool extensions → Task 3.
  - §4.4 Cold-start 2-line summary → Task 4 Step 3.
  - §4.5 Message-stripping pass → Task 4 Step 2.
  - §4.6 Settings UX → Task 5.
  - §5 Data flow → Tasks 4-6.
  - §6 Error handling → Task 3 (`{ error: ... }` returns).
  - §7 Testing → Task 6.
  - §8 Migration & rollout → Task 5 (version bump), Task 6 (tag).
  - §9 Open risks → covered by Task 6 scenarios.
- [x] **Placeholder scan:** No TBD / TODO / "fill in later" markers. All code is inlined.
- [x] **Type consistency:** `visionCtx` is defined in Task 4 Step 2, passed in Task 4 Step 5, consumed in Task 3 Step 3 — names and shape match.
- [x] **ImageEntry fields** match between Task 1 (`addImageEntry` writer) and Task 3 Step 2 (`callAskVisionTool` reader: uses `entry.mime`, `entry.base64`).
- [x] **Function signatures** `callOpenAICompatibleAskWithTools` and `...AtEndpoint` are updated once each in Task 4 Step 5.
