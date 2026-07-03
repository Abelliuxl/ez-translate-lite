# Ask AI Vision Tools — Design Spec

**Date:** 2026-07-03
**Status:** Draft (awaiting user review)
**Author:** ZCode (brainstorming session)
**Project:** ez-translate-lite
**Rollback anchor:** `pre-ask-vision-tools-v2.1.2` (→ `ce21b1e` on `origin/main`)

---

## 1. Problem

### Current behavior (v2.1.2)

When a user attaches an image to Ask AI (right-click → "Ask AI ?" on an image, or programmatically from a translation result), the image is analyzed **exactly once** by an optional "独立 Vision LLM" via `buildAskMessagesWithVisionAnalysis` in `src/background/background.js:1221-1285`.

The analysis produces a single text blob (≤8 bullet points) that is inlined into the **first** user message:

```
<original text>

图片解析（由 Vision LLM 生成）：
<one-shot description>
```

After that, the image is **stripped from the message stream entirely**. In every subsequent turn, the Ask LLM has only the static text description to work from. It cannot re-look at the image, focus on a specific region, OCR a different part, or answer a follow-up question that requires new visual evidence.

The cache in `askVisionAnalysisCache` (line 104) only prevents re-running the same one-shot analysis; it does not preserve the image for the Ask LLM to use later.

### Pain points

1. **No follow-up visual reasoning.** "What does the third label say?" / "OCR the code in the corner" / "What is in the bottom-left legend?" — all impossible without re-attaching the image.
2. **Single description quality ceiling.** A 8-bullet summary cannot be both comprehensive and targeted. Either it is too vague (LLM must guess) or it crowds out the user's actual question.
3. **Token waste in the common case.** When the question does not require vision at all, the description still ships in the first message.

---

## 2. Goal

Allow the Ask LLM to **repeatedly invoke vision capabilities on the attached image across multi-turn conversations**, with three distinct tools that mirror the operator intents captured by the reference project [`vision-mcp`](https://github.com/.../vision-mcp):

| Tool | Operator intent |
|---|---|
| `ocr_image` | Extract all text verbatim. |
| `describe_image` | Objective description at a chosen detail level. |
| `answer_image` | Answer a specific question grounded in the image. |

The first-turn cold-start experience is preserved: the user still gets a sensible answer if they only ask "what is this?" without invoking a tool.

### Non-goals (YAGNI)

- Multi-image attachments (single image only — explicitly out of scope per user decision).
- Persisting images across browser restarts (the image is held in the service worker memory only for the session).
- Exposing local file paths to the model.
- A separate Vision LLM endpoint integration — the three tools use the same OpenAI-compatible Vision LLM the user has already configured.
- Per-tool quota / rate limiting (we rely on the existing `ASK_TOOL_LIMITS.maxIterations=6` to bound total tool calls).
- OCR language selection (auto only).
- A new settings tab item — the existing `askVisionEnabled` toggle is reused.
- Anthropic/Azure tool-call paths — when the configured provider is not OpenAI-compatible, fall back to the current one-shot pre-analysis path unchanged.

---

## 3. Architecture

```
┌─────────────────────────────────────────────┐
│ content.js  (chat UI)                       │
│  - Image attachment (unchanged)             │
│  - User sends messages (image_url in        │
│    content parts, same as today)            │
└──────────────────┬──────────────────────────┘
                   │ chrome.runtime.sendMessage('ask', { messages, ... })
                   ▼
┌─────────────────────────────────────────────┐
│ background.js  handleAsk                    │
│                                             │
│  1. Load askVisionEnabled + askVisionConfigId│
│  2. If askVisionEnabled + OpenAI-compatible:│
│     a. Walk messages, collect image URLs    │
│     b. For each URL, fetch+base64 → store   │
│        in askImageCache (Map) with          │
│        synthetic image_ref id              │
│     c. Strip image_url parts from messages │
│     d. Run describe_image(image_ref,'short')│
│        → 2-line "图片背景" injected into    │
│        first user message                  │
│  3. If askSearchEnabled + OpenAI-compatible:│
│     → callOpenAICompatibleAskWithTools with │
│       tools = [tavily_search, web_fetch,    │
│                 ocr_image, describe_image,  │
│                 answer_image]               │
│  4. Else: callChatAPI (no tools, no image)  │
│  5. Non-OpenAI-compatible provider:         │
│     → existing buildAskMessagesWithVisionAnalysis
└──────────────────┬──────────────────────────┘
                   │ tool_choice: 'auto'
                   ▼
        OpenAI-compatible Chat API
        (豆包 / OpenRouter / ... / user-defined)
        ↳ Model may call ocr/describe/answer
        ↳ SW resolves image_ref → cached base64
        ↳ Same Vision LLM endpoint, re-called
        ↳ Tool result rejoins conversation
```

### Key design decisions (locked)

1. **Single image per session.** `chatAttachedImageUrl` in `content.js` stays a single string. Multiple images are explicitly deferred.
2. **In-memory image cache keyed by `image_ref`.** No disk writes. MV3 service workers cannot host a local HTTP MCP server, so we cannot reuse `vision-mcp`'s deployment model; we **borrow only the tool shape and prompts**.
3. **`image_ref` is opaque to the model.** Model sees `"image_1"`. SW resolves to cached `{ mime, base64 }`. This avoids leaking source URLs into tool arguments.
4. **Reuse `askVisionEnabled` and `askVisionConfigId`.** No new settings. Tool availability = "Vision LLM configured AND OpenAI-compatible Ask LLM AND askSearchEnabled must also be true to expose tools". Tools are only exposed through `callOpenAICompatibleAskWithTools`.
5. **Cold-start preserved.** First turn still injects a 2-line `describe(short)` summary so "what is this?" works without the model having to call a tool.
6. **No tool for non-OpenAI providers.** Anthropic / Azure path keeps current one-shot pre-analysis; vision-mcp inspiration is not applied there.
7. **No new tool-level quota.** `ASK_TOOL_LIMITS.maxIterations=6` caps total tool calls per turn loop. Sufficient for the use case.

---

## 4. Components

### 4.1 `askImageCache` (new)

A `Map<image_ref, ImageEntry>` at module scope in `background.js`, plus a counter.

```
ImageEntry = {
  imageRef: string,           // "image_1"
  sourceUrl: string,          // original http(s) URL or "data:..."
  mime: string,               // "image/png", etc.
  base64: string,             // without the "data:...;base64," prefix
  cachedAt: number,           // Date.now()
}
```

**Operations:**

| Op | Behavior |
|---|---|
| `addImageEntry(sourceUrl, mime, base64)` | Create a new entry, return its `image_ref`. Use a monotonic counter (`image_1`, `image_2`, ...). The counter resets when the SW wakes fresh, which is fine because the cache itself is empty then. |
| `getImageEntry(imageRef)` | Return the entry or `null`. If `null`, tool returns `{ error: '图片已失效，请重新附带' }`. |
| `clearAll()` | Used between sessions (called when `handleAsk` starts a new top-level request? — see §5). |

**Capacity:** Soft cap 8 entries, LRU eviction. (Single-image sessions stay at 1; multi-image is out of scope but the structure does not block it.)

**Lifetime:** The cache lives for the service-worker process. Chrome may terminate the SW after ~30s of inactivity, which drops the cache. Users in that situation re-attach the image — the existing image-attachment UI already covers this.

### 4.2 Tool definitions (new)

Added to `buildAskToolDefinitions()` in `background.js:1355`.

```
ocr_image:
  image_ref: string (optional; defaults to "image_1" if omitted)
  system:    "按图中的阅读顺序逐字抽取所有可见文字。仅输出抽取到的文字本身，不要翻译、不要总结、不要加评论。保留原始换行。"
  max_tokens: 1500

describe_image:
  image_ref: string (optional; defaults to "image_1")
  detail:    "short" | "medium" | "long"   (default "medium")
  system:    "客观描述这张图片。以图片主体为开头，使用现在时、第三人称。不要推测意图。长度上限：short ≤ 60 CJK / 120 拉丁字符；medium ≤ 180 CJK / 360 拉丁字符；long ≤ 600 CJK / 1200 拉丁字符。遵守所请求的 detail 等级。"
  max_tokens: 800

answer_image:
  image_ref: string (optional; defaults to "image_1")
  question:  string (required)
  context:   string (optional; free-form user/assistant-supplied hint)
  system:    "你是视觉问答助手。回答必须完全基于图片中可见的内容。如果图片信息不足，回答「图片未提供足够信息」。不要猜测。"
  max_tokens: 800
```

The system prompts are localized versions of the prompts in `vision-mcp/proxy/vision_proxy.py:81-83` (`SYSTEM_OCR` / `SYSTEM_DESCRIBE` / `SYSTEM_ANSWER`).

### 4.3 `executeAskTool` extensions (modified)

`executeAskTool` at `background.js:1541` gains three new branches: `ocr_image`, `describe_image`, `answer_image`. Each:

1. Resolves the entry from `askImageCache` using `args.image_ref || "image_1"`.
2. On miss, returns `{ error: '图片已失效，请重新附带' }`.
3. Builds an OpenAI-compatible chat-completion request using the same `getOpenAICompatibleVisionEndpoints` / `buildOpenAICompatibleHeaders` helpers already used by `callOpenAICompatibleVisionAnalysis` (lines 1287-1338).
4. Returns the assistant text in `{ content, model, mode: 'ocr' | 'describe' | 'answer' }`.
5. Calls `emitToolStatus` with a Chinese label so the chat UI shows progress: "正在 OCR 图片", "正在描述图片（medium）", "正在针对图片回答问题".

### 4.4 Cold-start 2-line summary (new)

In `handleAsk`, after the image has been cached and before `callOpenAICompatibleAskWithTools` is invoked:

```
if (askVisionEnabled && imageRef && !coldStartInjected) {
  const brief = await executeAskTool({ toolName: 'describe_image', args: { image_ref: imageRef, detail: 'short' }, ... });
  // inject into the LAST user message of the first turn:
  //   "图片背景：<brief.content>\n\n<original user text>"
}
```

The injected summary is **only** added on the very first turn of a session. On subsequent turns, the model relies entirely on tool calls. The `chatContextInjected` flag in `content.js:96` (already present) signals "first turn" — the SW-side check is `messages.every(m => m.role !== 'assistant')`.

If the cold-start call fails, the SW silently drops the summary and proceeds. The user's question still works, just with a less primed model.

### 4.5 Message-stripping pass (new)

When the tool path is enabled, the SW walks the messages and replaces every `image_url` part with a one-line textual note:

```
"（图片已转为可调用的工具：image_1）"
```

The user-visible UI in `content.js` continues to show the image thumbnail. The model only sees the abstract ref.

### 4.6 Settings UX (touched)

Only the **hint copy** in `src/settings/settings.html:140-143` changes:

- Old: "关闭时，图片会直接发送给 Ask LLM；开启时，先用下面选择的 Vision LLM 解析图片，再把解析结果交给 Ask LLM。"
- New: "关闭时，图片会直接发送给 Ask LLM；开启时，图片会转为可在 Ask 对话中反复调用的 OCR / 描述 / 视觉问答工具（首轮自动注入 2 行简短描述保持冷启动体验）。仅在使用 OpenAI 兼容的 Ask LLM 时生效。"

No new DOM elements, no JS changes in `settings.js`.

---

## 5. Data flow (step-by-step)

### First turn

1. User right-clicks an image → "Ask AI ?". `content.js:1356 handleImageAsk` runs.
2. `chatAttachedImageUrl` populated (as a data URL via `getImageAttachmentDataUrl`).
3. User types a question → `sendChatMessage` calls `requestAsk(chatMessages, ...)`.
4. `handleAsk` runs. `hasImageInput === true`. `askVisionEnabled === true` and `askSearchEnabled === true`. Provider is OpenAI-compatible.
5. SW walks messages, finds one image URL. Calls `askImageCache.addImageEntry(...)` → `imageRef = "image_1"`. `chatAttachedImageUrl` and `chatAttachedImageSourceUrl` are both derivable; the cache key the SW uses is the source URL string for de-duplication.
6. SW calls `executeAskTool(describe_image, { image_ref: "image_1", detail: "short" })` for the cold-start summary.
7. SW strips `image_url` parts from all messages, replaces with a textual note.
8. SW appends the 2-line summary to the first user message: `图片背景：<brief>\n\n<user question>`.
9. `callOpenAICompatibleAskWithTools` runs with the augmented `tools` array. The model may answer directly, or call more tools.
10. Final reply streamed back to the chat UI.

### Subsequent turns (the new capability)

1. User asks: "把图里那段代码 OCR 出来".
2. `sendChatMessage` pushes a new user message; `chatContextInjected` is already `true`, so no new context is built. The image is **not** re-attached in the messages.
3. `handleAsk` runs. `hasImageInput === false` (no `image_url` in the new message). The SW **still** has `image_1` in the cache from step 1.5.
4. `callOpenAICompatibleAskWithTools` runs. The model sees the conversation, knows the image ref is "image_1" (from the textual note injected on turn 1), and calls `ocr_image({ image_ref: "image_1" })`.
5. SW resolves the ref, calls the Vision LLM, returns OCR text. Model composes the final reply.

### Cold-start failure

If step 1.6 throws (Vision LLM down, network error, etc.):
- SW catches, logs, and proceeds without injecting the summary.
- Tools are still exposed for subsequent turns.
- A `tool_status` event with "图片冷启动描述失败" is emitted (defensive UX; only shown to the user in the Ask dialog stream).

### Service-worker restart (cache loss)

If the SW dies between turns and restarts, `askImageCache` is empty.
- The user re-attaches the image (or starts a new session) by re-triggering the flow. Existing UX covers this — the image is fresh in `chatAttachedImageUrl` and the cache is repopulated on the next `handleAsk`.
- A defensive `getImageEntry("image_1")` that returns `null` causes tools to return `{ error: '图片已失效，请重新附带' }`. The model surfaces this and the user can re-attach.

---

## 6. Error handling

| Scenario | Behavior |
|---|---|
| `askImageCache` miss | Tool returns `{ error: '图片已失效，请重新附带' }`. Model surfaces to user. |
| Vision LLM 4xx/5xx | Tool returns `{ error: <provider message> }`. Model decides retry vs. surface. SW does not throw. |
| No image attached and model calls a tool | Tool returns `{ error: '当前会话没有附带图片' }`. |
| Cold-start describe call fails | Log, skip the 2-line injection, proceed. The user can still ask the model to use the tools. |
| Provider is non-OpenAI-compatible | Tool path skipped entirely. Old `buildAskMessagesWithVisionAnalysis` runs as before. |
| `askSearchEnabled === false` and provider is OpenAI-compatible | Tools are **not** exposed (no `callOpenAICompatibleAskWithTools` call). Old single-shot pre-analysis runs. |
| Vision LLM call returns empty content | Tool returns `{ error: 'Vision LLM 返回空内容' }` (mirrors existing `callOpenAICompatibleVisionAnalysis` line 1328). |

---

## 7. Testing

### Unit

The new functions are small and pure, easy to spot-test:
- `askImageCache.addImageEntry` / `getImageEntry` / LRU eviction.
- `parseToolCallArguments` already exists (line 1531); reuse.
- The three system prompts are string constants — verify they exist and are non-empty.

### Manual

Five scenarios:

1. **Cold start, no follow-up.** Attach image, ask "这是什么". Expect 2-line-influenced answer. Tools are exposed but the model may not call any.
2. **OCR follow-up.** Attach code screenshot, ask "把代码 OCR 出来". Expect `ocr_image` call, model returns the code.
3. **Targeted QA.** Attach a chart, ask "第 3 个柱子是多少?". Expect `answer_image` call.
4. **Long describe.** Attach image, ask "详细描述这张图里的所有元素". Expect `describe_image(detail=long)` call.
5. **Vision LLM disabled.** Toggle `askVisionEnabled=false`. Old behavior must be unchanged: image is inlined directly if provider is OpenAI-compatible; error message if not.
6. **Non-OpenAI provider (Anthropic).** Configure Anthropic. Old `buildAskMessagesWithVisionAnalysis` path runs. Behavior identical to v2.1.2.
7. **Service-worker restart between turns.** Use chrome://serviceworker-internals to kill the SW. Re-attach image, continue conversation. Verify cache repopulates.

### Regression

- Hover translation, popup translation, creation feature: untouched.
- Tavily search: untouched.
- Image right-click menu: untouched.
- Settings UI: only the hint text changes.

---

## 8. Migration & rollout

- No data migration. The `askVisionAnalysisCache` and `askImageCache` are both empty on first run.
- No settings migration. The existing `askVisionEnabled` / `askVisionConfigId` keys keep the same shape.
- Versioning: bump `manifest.json` from `2.1.2` to `2.2.0` (minor — adds capability, does not break behavior).
- Rollback: `git checkout pre-ask-vision-tools-v2.1.2 -- src/background/background.js src/settings/settings.html` and re-bump version if needed.

---

## 9. Open risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Some Vision LLMs ignore the `detail` parameter | Low | Documented; if observed, drop the parameter and use only "medium". |
| The model over-uses the tools (calls 6 tools for one question) | Medium | `maxIterations=6` already caps it. Cold-start is the only fixed call. |
| 2-line summary is too generic for some image types | Medium | Acceptable — follow-up tool calls recover. |
| `image_url` text replacement confuses some models that expect base64 in `image_url` parts | Low | We never put `image_url` parts in the message stream when tools are enabled. Model only sees text notes. |
| `askImageCache` accumulates after many sessions until SW dies | Low | Soft cap 8 entries with LRU. |
| Image `data:` URLs from `<canvas>` exceed 6 MiB limit | Low | `ASK_IMAGE_MAX_DIMENSION=1600` keeps canvas-encoded JPEGs well under the cap. `fetchImageAsDataUrl` already enforces 6 MiB for fetched images. |
| Tool-call token cost on the Ask LLM (it sees tool definitions) | Negligible | Three small tool schemas add ~400 tokens to system context. |
