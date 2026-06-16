// content.js - 负责划词翻译的 UI 和交互

// --- 存储辅助函数 ---
function getStorage() {
    return chrome.storage.local;
}

const TRANSLATE_UI_SELECTOR = '#llm-translate-toolbar, #llm-translate-popover';
const EDITABLE_SELECTOR = 'textarea, input, [contenteditable]:not([contenteditable="false"])';
const SUPPORTED_INPUT_TYPES = new Set([
    'text',
    'search',
    'url',
    'tel',
    'email',
    'password'
]);

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

const aliasToEnName = {
    '中文': 'Simplified Chinese',
    '简体中文': 'Simplified Chinese',
    '繁體中文': 'Traditional Chinese',
    '繁体中文': 'Traditional Chinese',
    '英语': 'English',
    '英文': 'English',
    '日语': 'Japanese',
    '日本語': 'Japanese',
    '韩语': 'Korean',
    '韓國語': 'Korean',
    '한국어': 'Korean'
};

// --- 全局变量 ---
let actionToolbar = null;
let resultPopover = null;
let isEnabled = true;
let extensionContextInvalidated = false;
let pendingSelectionTimer = null;
let lastPointerClientX = 0;
let lastPointerClientY = 0;
let lastEditableSelectionContext = null;
let lastEditableSelectionAt = 0;
let gestureTextControl = null;
let activeTranslationRequestId = null;
let thinkingAnimationTimer = null;
let thinkingDotCount = 0;
let runtimeMessageListenerBound = false;
let storedPrimaryTranslation = '';
let storedSecondaryTranslation = null;
let showingPrimaryTranslation = true;

// 创作功能
let creationEnabled = false;
let creationPrompt = '';

// Ask 功能
let askEnabled = false;
let askConfigId = '';
let askFontSize = '12';
let askPromptTemplate = '';
let isAskResponding = false;
let chatDialog = null;
let chatMessages = [];
let chatAttachedText = '';
let chatAttachedTranslation = '';
let activeChatRequestId = null;
let currentDialogType = null; // 'translate' | 'creation' | 'chat' | null
let lastSelectedText = '';

const EDITABLE_SELECTION_CACHE_TTL = 1200;
const THINKING_PLACEHOLDER_BASE = '思考中';

// --- 初始化和设置监听 ---
initializeExtensionState();

function initializeExtensionState() {
    if (!isExtensionContextValid()) return;

    bindRuntimeMessageListener();

    try {
        chrome.storage.local.get([
            'isSelectionTranslationEnabled',
            'creationEnabled',
            'creationPrompt',
            'askEnabled',
            'askConfigId',
            'askFontSize',
            'askPromptTemplate'
        ], (result) => {
            isEnabled = result.isSelectionTranslationEnabled !== false;
            creationEnabled = result.creationEnabled === true;
            creationPrompt = result.creationPrompt || '';
            askEnabled = result.askEnabled === true;
            askConfigId = result.askConfigId || '';
            askFontSize = result.askFontSize || '12';
            askPromptTemplate = result.askPromptTemplate || '';
        });
    } catch (error) {
        handleExtensionError(error);
    }

    try {
        chrome.storage.onChanged.addListener((changes) => {
            if (changes.isSelectionTranslationEnabled) {
                isEnabled = changes.isSelectionTranslationEnabled.newValue;
                if (!isEnabled) {
                    removeTranslationUI();
                }
            }
            if (changes.creationEnabled) {
                creationEnabled = changes.creationEnabled.newValue;
            }
            if (changes.creationPrompt) {
                creationPrompt = changes.creationPrompt.newValue;
            }
            if (changes.askEnabled) {
                askEnabled = changes.askEnabled.newValue;
            }
            if (changes.askConfigId) {
                askConfigId = changes.askConfigId.newValue;
            }
            if (changes.askFontSize) {
                askFontSize = changes.askFontSize.newValue;
            }
            if (changes.askPromptTemplate) {
                askPromptTemplate = changes.askPromptTemplate.newValue;
            }
        });
    } catch (error) {
        handleExtensionError(error);
    }
}

function bindRuntimeMessageListener() {
    if (runtimeMessageListenerBound || !isExtensionContextValid()) {
        return;
    }

    try {
        chrome.runtime.onMessage.addListener(handleRuntimeMessage);
        runtimeMessageListenerBound = true;
    } catch (error) {
        handleExtensionError(error);
    }
}

function handleRuntimeMessage(message) {
    if (!message || !message.type) return;

    if (message.type === 'translation_stream') {
        if (!activeTranslationRequestId || message.requestId !== activeTranslationRequestId) return;
        applyTranslationStreamUpdate(message);
        return;
    }

    if (message.type === 'creation_stream') {
        applyCreationStreamUpdate(message);
        return;
    }

    if (message.type === 'ask_stream') {
        applyAskStreamUpdate(message);
        return;
    }
}

function isExtensionContextValid() {
    if (extensionContextInvalidated) {
        return false;
    }

    try {
        if (!chrome?.runtime?.id) {
            extensionContextInvalidated = true;
            return false;
        }

        return true;
    } catch (error) {
        handleExtensionError(error);
        return false;
    }
}

function handleExtensionError(error) {
    const message = error?.message || String(error || '');
    if (message.includes('Extension context invalidated')) {
        extensionContextInvalidated = true;
    }
}

function toUserErrorMessage(error) {
    const message = error?.message || String(error || '');
    if (message.includes('Extension context invalidated')) {
        extensionContextInvalidated = true;
        return getRefreshRequiredMessage();
    }

    return message;
}

function getRefreshRequiredMessage() {
    return navigator.language?.toLowerCase().startsWith('zh')
        ? '扩展已更新，请刷新当前页面后重试。'
        : 'The extension was updated. Refresh this page and try again.';
}

function getMessage(key, fallback) {
    if (!isExtensionContextValid()) {
        return fallback;
    }

    try {
        return chrome.i18n.getMessage(key) || fallback;
    } catch (error) {
        handleExtensionError(error);
        return fallback;
    }
}

function getRuntimeUrl(path) {
    if (!isExtensionContextValid()) {
        return '';
    }

    try {
        return chrome.runtime.getURL(path);
    } catch (error) {
        handleExtensionError(error);
        return '';
    }
}

function setLastSelectedText(text) {
    if (!isExtensionContextValid()) {
        return;
    }

    try {
        chrome.storage.local.set({ lastSelectedText: text });
    } catch (error) {
        handleExtensionError(error);
    }
}

// --- 事件监听 ---
document.addEventListener('mouseup', (event) => {
    if (!isEnabled) return;
    updateLastPointerPosition(event);
    scheduleSelectionToolbar(event);
});

document.addEventListener('mousedown', (event) => {
    updateLastPointerPosition(event);
    gestureTextControl = resolveGestureTextControl(event.target);

    const isChatUiTarget = chatDialog && chatDialog.contains(event.target);
    if (isTranslateUiTarget(event.target) || isChatUiTarget) return;

    if (currentDialogType === 'chat') return;

    removeTranslationUI();
});

document.addEventListener('mousemove', (event) => {
    if ((event.buttons & 1) === 1) {
        updateLastPointerPosition(event);
    }
});

document.addEventListener('select', (event) => {
    if (!isEnabled) return;
    if (isTranslateUiTarget(event.target)) return;

    queueSelectionToolbarCheck(
        event.target,
        getFallbackPointerX(),
        getFallbackPointerY(),
        0
    );
}, true);

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        cancelPendingSelectionToolbar();

        if (currentDialogType === 'chat') {
            closeChatDialog();
            return;
        }

        removeTranslationUI();
    }
});

function scheduleSelectionToolbar(event) {
    const target = event.target;
    const clientX = event.clientX;
    const clientY = event.clientY;

    queueSelectionToolbarCheck(target, clientX, clientY, 0);
}

function queueSelectionToolbarCheck(target, clientX, clientY, attempt) {
    cancelPendingSelectionToolbar();

    pendingSelectionTimer = window.setTimeout(() => {
        pendingSelectionTimer = null;
        const shown = tryShowSelectionToolbar(target, clientX, clientY);

        // 某些站点会异步更新选区，做几次短重试
        if (!shown && attempt < 2) {
            queueSelectionToolbarCheck(target, clientX, clientY, attempt + 1);
        }
    }, attempt === 0 ? 0 : 24);
}

function tryShowSelectionToolbar(target, clientX, clientY) {
    if (!isEnabled) return false;
    if (isTranslateUiTarget(target)) return false;

    removeTranslationUI();

    const editableContext = getEditableSelectionContext(target)
        || getGestureTextControlSelectionContext()
        || getRecentEditableSelectionContext();
    const selectedText = editableContext
        ? editableContext.selectedText
        : window.getSelection().toString().trim();

    if (!selectedText) return false;

    if (!isExtensionContextValid()) {
        showResultPopover(clientX, clientY, getRefreshRequiredMessage());
        return true;
    }

    lastSelectedText = selectedText;
    setLastSelectedText(selectedText);
    createSelectionToolbar(clientX, clientY, selectedText, editableContext);
    return true;
}

function cancelPendingSelectionToolbar() {
    if (pendingSelectionTimer !== null) {
        clearTimeout(pendingSelectionTimer);
        pendingSelectionTimer = null;
    }
}

function updateLastPointerPosition(event) {
    if (typeof event.clientX === 'number') {
        lastPointerClientX = event.clientX;
    }
    if (typeof event.clientY === 'number') {
        lastPointerClientY = event.clientY;
    }
}

function getFallbackPointerX() {
    if (lastPointerClientX !== 0) return lastPointerClientX;
    return Math.round(window.innerWidth / 2);
}

function getFallbackPointerY() {
    if (lastPointerClientY !== 0) return lastPointerClientY;
    return Math.round(window.innerHeight / 2);
}

// --- 选择与输入区检测 ---
function getEditableSelectionContext(target) {
    return getTextControlSelectionContext(target) || getContentEditableSelectionContext(target);
}

function getTextControlSelectionContext(target) {
    const element = getClosestTextControl(target) || getActiveTextControl();
    return buildTextControlSelectionContext(element);
}

function buildTextControlSelectionContext(element) {
    if (!(element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement)) {
        return null;
    }

    if (!isSupportedTextControl(element) || element.readOnly || element.disabled) {
        return null;
    }

    const start = element.selectionStart;
    const end = element.selectionEnd;
    if (typeof start !== 'number' || typeof end !== 'number' || start === end) {
        return null;
    }

    const selectedText = element.value.slice(start, end).trim();
    if (!selectedText) {
        return null;
    }

    const context = {
        type: 'text-control',
        element,
        selectedText,
        fullText: element.value,
        selectionStart: start,
        selectionEnd: end
    };
    rememberEditableSelectionContext(context);
    return context;
}

function resolveGestureTextControl(target) {
    const element = getClosestTextControl(target);
    if (!(element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement)) {
        return null;
    }

    if (!isSupportedTextControl(element) || element.readOnly || element.disabled) {
        return null;
    }

    return element;
}

function getGestureTextControlSelectionContext() {
    if (!gestureTextControl || !gestureTextControl.isConnected) {
        return null;
    }

    return buildTextControlSelectionContext(gestureTextControl);
}

function getClosestTextControl(target) {
    return getClosestElement(target, 'textarea, input');
}

function getActiveTextControl() {
    const active = document.activeElement;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
        return active;
    }
    return null;
}

function getContentEditableSelectionContext(target) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        return null;
    }

    const targetHost = getClosestEditableHost(target);
    const anchorHost = getClosestEditableHost(selection.anchorNode);
    const focusHost = getClosestEditableHost(selection.focusNode);

    if (!targetHost || targetHost !== anchorHost || anchorHost !== focusHost) {
        return null;
    }

    const selectedText = selection.toString().trim();
    const fullText = targetHost.innerText || targetHost.textContent || '';
    if (!selectedText || !fullText.trim()) {
        return null;
    }

    const selectedRange = cloneCurrentSelectionRange(selection);
    if (!selectedRange) {
        return null;
    }

    const context = {
        type: 'contenteditable',
        element: targetHost,
        selectedText,
        fullText,
        selectedRange
    };
    rememberEditableSelectionContext(context);
    return context;
}

function cloneCurrentSelectionRange(selection) {
    try {
        if (!selection || selection.rangeCount === 0) {
            return null;
        }
        return selection.getRangeAt(0).cloneRange();
    } catch (error) {
        return null;
    }
}

function rememberEditableSelectionContext(context) {
    if (!context || !context.element) {
        return;
    }

    if (context.type === 'contenteditable' && context.selectedRange) {
        lastEditableSelectionContext = {
            ...context,
            selectedRange: context.selectedRange.cloneRange()
        };
    } else {
        lastEditableSelectionContext = { ...context };
    }
    lastEditableSelectionAt = Date.now();
}

function getRecentEditableSelectionContext() {
    if (!lastEditableSelectionContext) {
        return null;
    }

    if (Date.now() - lastEditableSelectionAt > EDITABLE_SELECTION_CACHE_TTL) {
        clearEditableSelectionContextCache();
        return null;
    }

    const context = lastEditableSelectionContext;
    if (!context.element || !context.element.isConnected) {
        clearEditableSelectionContextCache();
        return null;
    }

    if (context.type === 'text-control') {
        const start = context.element.selectionStart;
        const end = context.element.selectionEnd;
        if (typeof start !== 'number' || typeof end !== 'number' || start === end) {
            return null;
        }

        return {
            ...context,
            selectedText: context.element.value.slice(start, end).trim(),
            fullText: context.element.value,
            selectionStart: start,
            selectionEnd: end
        };
    }

    if (context.type === 'contenteditable') {
        return {
            ...context,
            selectedRange: context.selectedRange ? context.selectedRange.cloneRange() : null
        };
    }

    return null;
}

function clearEditableSelectionContextCache() {
    lastEditableSelectionContext = null;
    lastEditableSelectionAt = 0;
}

function isSupportedTextControl(element) {
    if (element instanceof HTMLTextAreaElement) {
        return true;
    }

    if (!(element instanceof HTMLInputElement)) {
        return false;
    }

    const type = (element.type || 'text').toLowerCase();
    return SUPPORTED_INPUT_TYPES.has(type);
}

function getClosestEditableHost(node) {
    const element = node instanceof Element ? node : node?.parentElement;
    if (!element) {
        return null;
    }

    const editableHost = element.closest(EDITABLE_SELECTOR);
    if (!editableHost) {
        return null;
    }

    if (editableHost instanceof HTMLInputElement || editableHost instanceof HTMLTextAreaElement) {
        return editableHost;
    }

    return editableHost.isContentEditable ? editableHost : null;
}

function getClosestElement(node, selector) {
    const element = node instanceof Element ? node : node?.parentElement;
    return element ? element.closest(selector) : null;
}

function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

function isTranslateUiTarget(target) {
    return Boolean(getClosestElement(target, TRANSLATE_UI_SELECTOR));
}

// --- 翻译请求 ---
async function requestTranslation(text, options = {}) {
    if (!isExtensionContextValid()) {
        throw new Error(getRefreshRequiredMessage());
    }

    const { stream = false, requestId = '' } = options;
    const { targetLanguage, secondTargetLanguage } = await getTranslationLanguages();

    return new Promise((resolve, reject) => {
        try {
            chrome.runtime.sendMessage({
                type: 'translate',
                text,
                targetLanguage,
                secondTargetLanguage,
                stream,
                requestId
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(toUserErrorMessage(chrome.runtime.lastError)));
                    return;
                }

                if (!response) {
                    reject(new Error('未收到翻译结果'));
                    return;
                }

                if (response.error) {
                    reject(new Error(response.error));
                    return;
                }

                const translationText = typeof response.translation === 'string'
                    ? response.translation
                    : String(response.translation ?? '');

                resolve({
                    translation: translationText,
                    translation2: response.translation2 || null,
                    model: response.model || ''
                });
            });
        } catch (error) {
            reject(new Error(toUserErrorMessage(error)));
        }
        });
    }

function createTranslationRequestId() {
    const randomSuffix = Math.random().toString(36).slice(2, 8);
    return `tx-${Date.now()}-${randomSuffix}`;
}

async function getTranslationLanguages() {
    const storage = await getStorage();
    if (!storage) {
        throw new Error(getRefreshRequiredMessage());
    }

    let languageSettings;
    try {
        languageSettings = await storage.get(['targetLanguage', 'secondTargetLanguage']);
    } catch (error) {
        throw new Error(toUserErrorMessage(error));
    }

    const { targetLanguage, secondTargetLanguage } = languageSettings;

    return {
        targetLanguage: normalizeToEnName(targetLanguage || 'langSimplifiedChinese'),
        secondTargetLanguage: normalizeToEnName(secondTargetLanguage || 'langEnglish')
    };
}

function normalizeToEnName(input) {
    if (!input) return 'English';
    if (langKeyToEnName[input]) return langKeyToEnName[input];
    if (aliasToEnName[input]) return aliasToEnName[input];

    const knownNames = Object.values(langKeyToEnName);
    return knownNames.includes(input) ? input : 'English';
}

// --- UI 创建 ---
function createSelectionToolbar(x, y, selectedText, editableContext) {
    actionToolbar = document.createElement('div');
    actionToolbar.id = 'llm-translate-toolbar';
    actionToolbar.addEventListener('mousedown', stopPropagation);
    actionToolbar.addEventListener('mouseup', stopPropagation);

    // 翻译按钮
    const translateButton = document.createElement('button');
    translateButton.type = 'button';
    translateButton.id = 'llm-translate-icon';
    translateButton.className = 'llm-translate-action-btn';
    translateButton.title = getMessage('selectionTranslateButton', 'Translate');
    translateButton.addEventListener('mousedown', preventFocusSteal);

    const iconImg = document.createElement('img');
    iconImg.id = 'llm-translate-icon-img';
    iconImg.src = getRuntimeUrl('icons/icon48.png');
    iconImg.alt = '';
    iconImg.width = 20;
    iconImg.height = 20;
    translateButton.appendChild(iconImg);

    translateButton.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        removeSelectionActionUI();
        const requestId = createTranslationRequestId();
        activeTranslationRequestId = requestId;
        showResultPopover(x, y, getMessage('statusTranslating', 'Translating...'), true, 'translate');
        setResultPopoverModel('');
        setResultPopoverThinking(false);

        try {
            const result = await requestTranslation(selectedText, {
                stream: true,
                requestId
            });

            if (activeTranslationRequestId !== requestId) {
                return;
            }

            if (result.model) {
                setResultPopoverModel(result.model);
            }

            if (result.translation) {
                updateResultPopover(result.translation);
            }

            if (result.translation2) {
                storedSecondaryTranslation = result.translation2;
                updateSwitchButtonVisibility();
            }
            setResultPopoverThinking(false);
        } catch (error) {
            if (activeTranslationRequestId !== requestId) {
                return;
            }
            setResultPopoverThinking(false);
            updateResultPopover(toUserErrorMessage(error));
        }
    });

    actionToolbar.appendChild(translateButton);

    // 创作按钮（仅在输入框内选中时显示）
    if (creationEnabled && editableContext) {
        const createBtn = createToolbarBtn('✒️', getMessage('creationButtonTitle', '创作'));
        createBtn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            handleCreationClick(x, y, selectedText);
        });
        actionToolbar.appendChild(createBtn);
    }

    // Ask 按钮（任何选中文本都显示）
    if (askEnabled) {
        const askBtn = createToolbarBtn('?', 'Ask AI');
        askBtn.classList.add('llm-translate-ask-btn');
        askBtn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            handleAskClick(x, y, selectedText, null);
        });
        actionToolbar.appendChild(askBtn);
    }

    document.body.appendChild(actionToolbar);
    positionFloatingElement(actionToolbar, x, y);
}

function createToolbarBtn(icon, title) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'llm-translate-action-btn-emoji';
    btn.title = title;
    btn.textContent = icon;
    btn.addEventListener('mousedown', preventFocusSteal);
    return btn;
}

function showResultPopover(x, y, content, loading = false, mode = 'translate') {
    currentDialogType = mode;

    if (!resultPopover) {
        resultPopover = document.createElement('div');
        resultPopover.id = 'llm-translate-popover';
        resultPopover.classList.toggle('mode-creation', mode === 'creation');
        resultPopover.innerHTML = `
            <div id="llm-translate-popover-meta">
                <div id="llm-translate-popover-meta-left">
                    <span id="llm-translate-popover-model">${mode === 'creation' ? '创作：' : '模型：'}--</span>
                    <span id="llm-translate-popover-thinking" style="display: none;"></span>
                </div>
                <div style="display:flex;align-items:center;gap:4px;">
                    <button class="llm-translate-copy-btn small" id="llm-translate-popover-ask" title="Ask AI" style="${askEnabled ? '' : 'display:none;'}">?</button>
                    <button class="llm-translate-copy-btn small" id="llm-translate-popover-switch" title="切换译文" style="display:none;">⇄</button>
                    <button class="llm-translate-copy-btn small" id="llm-translate-popover-copy" title="${getMessage('copyTranslation', 'Copy translation')}">📋</button>
                </div>
            </div>
            <div id="llm-translate-popover-content"></div>
        `;
        document.body.appendChild(resultPopover);

        makeDraggable(resultPopover);
        resultPopover.addEventListener('mousedown', stopPropagation);
        resultPopover.addEventListener('mouseup', stopPropagation);

        const copyBtn = resultPopover.querySelector('#llm-translate-popover-copy');
        copyBtn.addEventListener('click', async (event) => {
            event.preventDefault();
            event.stopPropagation();

            const contentDiv = resultPopover.querySelector('#llm-translate-popover-content');
            const textToCopy = contentDiv.textContent;

            try {
                await navigator.clipboard.writeText(textToCopy);
                const originalText = copyBtn.textContent;
                copyBtn.textContent = '✅';
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                }, 1500);
            } catch (error) {
                console.error('复制失败:', error);
            }
        });

        const switchBtn = resultPopover.querySelector('#llm-translate-popover-switch');
        switchBtn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            toggleTranslationView();
        });

        // Ask 按钮在翻译弹窗内
        const askBtn = resultPopover.querySelector('#llm-translate-popover-ask');
        askBtn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            const attachedText = lastSelectedText || '';
            const contentDiv = resultPopover.querySelector('#llm-translate-popover-content');
            const attachedTranslation = contentDiv ? contentDiv.textContent : '';
            morphToChatDialog(attachedText, attachedTranslation);
        });
    }

    resultPopover.classList.toggle('mode-creation', mode === 'creation');
    const metaLeft = resultPopover.querySelector('#llm-translate-popover-model');
    if (metaLeft) {
        metaLeft.textContent = mode === 'creation' ? '创作：--' : '模型：--';
    }

    const askBtn = resultPopover.querySelector('#llm-translate-popover-ask');
    if (askBtn) {
        askBtn.style.display = (askEnabled && mode !== 'creation') ? '' : 'none';
    }

    const contentElement = resultPopover.querySelector('#llm-translate-popover-content');
    renderStatusContent(contentElement, content, loading);
    resultPopover.style.display = 'block';
    positionFloatingElement(resultPopover, x, y);
}

function updateResultPopover(content) {
    if (!resultPopover) return;

    const contentDiv = resultPopover.querySelector('#llm-translate-popover-content');
    renderStatusContent(contentDiv, content, false);
}

function setResultPopoverModel(modelName) {
    if (!resultPopover) return;

    const modelElement = resultPopover.querySelector('#llm-translate-popover-model');
    if (!modelElement) return;

    const safeModel = (modelName || '').trim();
    modelElement.textContent = `模型：${safeModel || '--'}`;
}

function applyTranslationStreamUpdate(message) {
    if (!resultPopover) {
        return;
    }

    if (message.model) {
        setResultPopoverModel(message.model);
    }

    if (message.stage === 'thinking') {
        setResultPopoverThinking(Boolean(message.active));
        return;
    }

    if (message.stage === 'text' && typeof message.text === 'string') {
        storedPrimaryTranslation = message.text;
        if (showingPrimaryTranslation) {
            updateResultPopover(message.text);
        }
        if (message.text.trim()) {
            setResultPopoverThinking(false);
        }
        return;
    }

    if (message.stage === 'done') {
        if (typeof message.translation === 'string' && message.translation) {
            storedPrimaryTranslation = message.translation;
            storedSecondaryTranslation = message.translation2 || null;
            showingPrimaryTranslation = true;
            updateResultPopover(storedPrimaryTranslation);
            updateSwitchButtonVisibility();
        }
        setResultPopoverThinking(false);
    }
}

function setResultPopoverThinking(active) {
    if (!resultPopover) return;

    const thinkingElement = resultPopover.querySelector('#llm-translate-popover-thinking');
    if (!thinkingElement) return;

    if (!active) {
        if (thinkingAnimationTimer !== null) {
            clearInterval(thinkingAnimationTimer);
            thinkingAnimationTimer = null;
        }
        thinkingDotCount = 0;
        thinkingElement.style.display = 'none';
        thinkingElement.textContent = '';
        return;
    }

    thinkingElement.style.display = 'inline-flex';
    thinkingElement.textContent = `${THINKING_PLACEHOLDER_BASE}...`;

    if (thinkingAnimationTimer !== null) {
        return;
    }

    thinkingAnimationTimer = window.setInterval(() => {
        thinkingDotCount = (thinkingDotCount + 1) % 4;
        const dots = '.'.repeat(thinkingDotCount === 0 ? 1 : thinkingDotCount);
        thinkingElement.textContent = `${THINKING_PLACEHOLDER_BASE}${dots}`;
    }, 420);
}

function renderStatusContent(element, message, loading) {
    if (!element) return;

    element.replaceChildren();

    if (!loading) {
        element.textContent = message;
        return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'llm-translate-status';

    const spinner = document.createElement('span');
    spinner.className = 'llm-translate-spinner';
    spinner.setAttribute('aria-hidden', 'true');

    const text = document.createElement('span');
    text.textContent = message;

    wrapper.appendChild(spinner);
    wrapper.appendChild(text);
    element.appendChild(wrapper);
}

function positionFloatingElement(element, clientX, clientY, offsetY = 15) {
    const margin = 12;
    let left = clientX + window.scrollX;
    let top = clientY + window.scrollY + offsetY;

    element.style.left = `${left}px`;
    element.style.top = `${top}px`;

    const rect = element.getBoundingClientRect();
    const minLeft = window.scrollX + margin;
    const maxLeft = window.scrollX + window.innerWidth - rect.width - margin;
    left = Math.min(Math.max(left, minLeft), Math.max(minLeft, maxLeft));

    const bottomOverflow = top - window.scrollY + rect.height > window.innerHeight - margin;
    if (bottomOverflow) {
        top = clientY + window.scrollY - rect.height - offsetY;
    }

    const minTop = window.scrollY + margin;
    const maxTop = window.scrollY + window.innerHeight - rect.height - margin;
    top = Math.min(Math.max(top, minTop), Math.max(minTop, maxTop));

    element.style.left = `${left}px`;
    element.style.top = `${top}px`;
}

function preventFocusSteal(event) {
    event.preventDefault();
}

// --- 拖拽 ---
function makeDraggable(element, handle) {
    let pos3 = 0;
    let pos4 = 0;
    let isFixed = false;
    handle = handle || element;

    handle.addEventListener('mousedown', dragMouseDown);

    function dragMouseDown(event) {
        if (
            event.target.tagName === 'BUTTON' ||
            event.target.tagName === 'INPUT' ||
            event.target.tagName === 'A' ||
            event.target.classList.contains('llm-translate-close') ||
            event.target.classList.contains('llm-translate-copy-btn')
        ) {
            return;
        }

        const target = event.target;
        if (
            handle !== element &&
            (!target || !(target instanceof Element) || (!target.closest('.llm-translate-header') && !target.closest('.llm-translate-popover-header') && !target.closest('.chat-header')))
        ) {
            return;
        }

        if (handle === element && event.target.id === 'llm-translate-popover-content') {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        pos3 = event.clientX;
        pos4 = event.clientY;

        const style = window.getComputedStyle(element);
        isFixed = style.position === 'fixed';

        if (isFixed && style.transform !== 'none') {
            const rect = element.getBoundingClientRect();
            element.style.transform = 'none';
            element.style.top = `${rect.top}px`;
            element.style.left = `${rect.left}px`;
            element.style.margin = '0';
        }

        document.addEventListener('mouseup', closeDragElement, true);
        document.addEventListener('mousemove', elementDrag);
        window.addEventListener('blur', closeDragElement);
        element.classList.add('llm-translate-dragging');
    }

    function elementDrag(event) {
        event.preventDefault();
        const dx = pos3 - event.clientX;
        const dy = pos4 - event.clientY;
        pos3 = event.clientX;
        pos4 = event.clientY;

        if (isFixed) {
            const rect = element.getBoundingClientRect();
            element.style.top = `${rect.top - dy}px`;
            element.style.left = `${rect.left - dx}px`;
        } else {
            element.style.top = `${element.offsetTop - dy}px`;
            element.style.left = `${element.offsetLeft - dx}px`;
        }
    }

    function closeDragElement() {
        document.removeEventListener('mouseup', closeDragElement, true);
        document.removeEventListener('mousemove', elementDrag);
        window.removeEventListener('blur', closeDragElement);
        element.classList.remove('llm-translate-dragging');
    }
}

// --- 销毁 ---
function removeSelectionActionUI() {
    if (actionToolbar) {
        actionToolbar.remove();
        actionToolbar = null;
    }
}

function removeTranslationUI() {
    cancelPendingSelectionToolbar();
    resetTranslationStreamState();
    removeSelectionActionUI();

    if (currentDialogType === 'chat') return;

    if (resultPopover) {
        resultPopover.remove();
        resultPopover = null;
    }

    if (chatDialog && currentDialogType !== 'chat') {
        chatDialog.remove();
        chatDialog = null;
    }

    currentDialogType = null;
    storedPrimaryTranslation = '';
    storedSecondaryTranslation = null;
    showingPrimaryTranslation = true;
}

function stopPropagation(event) {
    event.stopPropagation();
}

function toggleTranslationView() {
    if (storedSecondaryTranslation === null) return;
    showingPrimaryTranslation = !showingPrimaryTranslation;
    const text = showingPrimaryTranslation ? storedPrimaryTranslation : storedSecondaryTranslation;
    animateSwitchTo(text);
}

function animateSwitchTo(newText) {
    const contentDiv = document.querySelector('#llm-translate-popover-content');
    if (!contentDiv) return;
    contentDiv.style.opacity = '0';
    const handler = () => {
        contentDiv.removeEventListener('transitionend', handler);
        contentDiv.textContent = newText;
        void contentDiv.offsetHeight;
        contentDiv.style.opacity = '1';
    };
    contentDiv.addEventListener('transitionend', handler, { once: true });
    setTimeout(() => {
        if (contentDiv.style.opacity === '0') {
            contentDiv.removeEventListener('transitionend', handler);
            contentDiv.textContent = newText;
            contentDiv.style.opacity = '1';
        }
    }, 200);
}

function updateSwitchButtonVisibility() {
    const switchBtn = document.querySelector('#llm-translate-popover-switch');
    if (!switchBtn) return;
    if (storedSecondaryTranslation) {
        switchBtn.style.display = '';
    } else {
        switchBtn.style.display = 'none';
    }
}

// ========== 创作功能 ==========

function handleCreationClick(x, y, selectedText) {
    removeTranslationUI();
    const requestId = createTranslationRequestId();
    activeTranslationRequestId = requestId;
    showResultPopover(x, y, '创作中...', true, 'creation');
    setResultPopoverModel('');
    setResultPopoverThinking(false);

    requestCreation(selectedText, { stream: true, requestId })
        .then(result => {
            if (currentDialogType !== 'creation') return;
            if (result.model) setResultPopoverModel(result.model);
            if (result.content) updateResultPopover(result.content);
            setResultPopoverThinking(false);
        })
        .catch(error => {
            if (currentDialogType !== 'creation') return;
            setResultPopoverThinking(false);
            updateResultPopover(error.message || '创作失败');
        });
}

async function requestCreation(text, options = {}) {
    const { stream = false, requestId = '' } = options;
    return new Promise((resolve, reject) => {
        try {
            chrome.runtime.sendMessage({
                type: 'create',
                text,
                stream,
                requestId
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(toUserErrorMessage(chrome.runtime.lastError)));
                    return;
                }
                if (!response) {
                    reject(new Error('未收到创作结果'));
                    return;
                }
                if (response.error) {
                    reject(new Error(response.error));
                    return;
                }
                resolve({
                    content: response.result || '',
                    model: response.model || ''
                });
            });
        } catch (error) {
            reject(new Error(toUserErrorMessage(error)));
        }
    });
}

function applyCreationStreamUpdate(message) {
    if (currentDialogType !== 'creation' || !resultPopover) return;

    if (message.model) {
        const metaLeft = resultPopover.querySelector('#llm-translate-popover-model');
        if (metaLeft) metaLeft.textContent = `创作：${message.model || '--'}`;
    }

    if (message.stage === 'thinking') {
        setResultPopoverThinking(Boolean(message.active));
        return;
    }

    if (message.stage === 'text' && typeof message.text === 'string') {
        if (message.text.trim()) setResultPopoverThinking(false);
        updateResultPopover(message.text);
        return;
    }

    if (message.stage === 'done') {
        if (typeof message.translation === 'string' && message.translation) {
            updateResultPopover(message.translation);
        }
        setResultPopoverThinking(false);
    }
}

// ========== Ask 对话功能 ==========

function handleAskClick(x, y, selectedText, attachedTranslation) {
    removeSelectionActionUI();
    chatAttachedText = selectedText || '';
    chatAttachedTranslation = attachedTranslation || '';
    chatMessages = [];
    activeChatRequestId = null;

    if (resultPopover && currentDialogType === 'translate') {
        morphToChatDialog(chatAttachedText, chatAttachedTranslation);
    } else {
        removeTranslationUI();
        showChatDialog(x, y);
    }
}

function showChatDialog(x, y) {
    if (chatDialog) {
        chatDialog.remove();
        chatDialog = null;
    }

    chatDialog = document.createElement('div');
    chatDialog.id = 'llm-chat-dialog';
    chatDialog.className = `chat-font-${askFontSize || 'md'}`;
    chatDialog.innerHTML = `
        <div class="chat-header">
            <span class="chat-title">Ask AI</span>
            <button class="chat-close">✕</button>
        </div>
        <div class="chat-attached" style="display:none;"></div>
        <div class="chat-messages"></div>
        <div class="chat-input-area">
            <textarea class="chat-input" placeholder="输入你的问题..." rows="1"></textarea>
            <button class="chat-send">发送</button>
        </div>
        <div class="chat-resize-handle"></div>
    `;

    currentDialogType = 'chat';
    chatMessages = [];
    isAskResponding = false;

    document.body.appendChild(chatDialog);

    bindChatEvents(chatDialog);
    makeDraggable(chatDialog, chatDialog.querySelector('.chat-header'));
    initResizeHandle(chatDialog);

    try { updateChatAttached(chatDialog); } catch (e) { /* ignore */ }

    chatDialog.style.position = 'fixed';
    const margin = 12;
    chatDialog.style.left = `${Math.max(margin, Math.min(x, window.innerWidth - 520))}px`;
    chatDialog.style.top = `${Math.max(margin, y + 10)}px`;
    chatDialog.style.display = 'flex';

    chatDialog.style.opacity = '0';
    chatDialog.style.transform = 'translateY(10px)';
    requestAnimationFrame(() => {
        chatDialog.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
        chatDialog.style.opacity = '1';
        chatDialog.style.transform = 'translateY(0)';
    });

    setTimeout(() => doAskAutoSend(), 300);
}

function morphToChatDialog(attachedText, attachedTranslation) {
    if (!resultPopover) return;

    chatAttachedText = attachedText || '';
    chatAttachedTranslation = attachedTranslation || '';
    chatMessages = [];
    currentDialogType = 'chat';
    isAskResponding = false;

    const contentDiv = resultPopover.querySelector('#llm-translate-popover-content');
    if (!contentDiv) return;

    contentDiv.style.opacity = '0';

    const morphComplete = () => {
        resultPopover.id = 'llm-chat-dialog';
        resultPopover.innerHTML = `
            <div class="chat-header">
                <span class="chat-title">Ask AI</span>
                <button class="chat-close">✕</button>
            </div>
            <div class="chat-attached" style="display:none;"></div>
            <div class="chat-messages"></div>
            <div class="chat-input-area">
                <textarea class="chat-input" placeholder="输入你的问题..." rows="1"></textarea>
                <button class="chat-send">发送</button>
            </div>
            <div class="chat-resize-handle"></div>
        `;

        chatDialog = resultPopover;
        chatDialog.className = `chat-font-${askFontSize || 'md'}`;

        const rect = resultPopover.getBoundingClientRect();
        resultPopover.style.position = 'fixed';
        resultPopover.style.left = `${Math.max(12, rect.left)}px`;
        resultPopover.style.top = `${Math.max(12, rect.top)}px`;
        resultPopover.style.width = '600px';
        resultPopover.style.height = '690px';
        resultPopover.style.display = 'flex';
        resultPopover.style.maxWidth = '';
        resultPopover.classList.remove('mode-creation');

        bindChatEvents(resultPopover);
        const header = resultPopover.querySelector('.chat-header');
        if (header) header.style.cursor = 'move';
        makeDraggable(resultPopover, header);
        initResizeHandle(resultPopover);

        try { updateChatAttached(resultPopover); } catch (e) { /* ignore */ }

        const messagesEl = resultPopover.querySelector('.chat-messages');
        if (messagesEl) {
            messagesEl.style.opacity = '0';
            requestAnimationFrame(() => {
                messagesEl.style.transition = 'opacity 0.15s ease';
                messagesEl.style.opacity = '1';
            });
        }

        setTimeout(() => doAskAutoSend(), 300);
    };

    contentDiv.addEventListener('transitionend', morphComplete, { once: true });
    setTimeout(() => {
        if (contentDiv.style.opacity === '0') {
            contentDiv.removeEventListener('transitionend', morphComplete);
            morphComplete();
        }
    }, 200);
}

function updateChatAttached(dialog) {
    const attachedEl = dialog.querySelector('.chat-attached');
    if (!attachedEl) return;

    if (!chatAttachedText && !chatAttachedTranslation) {
        attachedEl.style.display = 'none';
        return;
    }

    attachedEl.style.display = 'block';

    const toggle = document.createElement('div');
    toggle.className = 'chat-attached-toggle';

    const arrow = document.createElement('span');
    arrow.className = 'chat-attached-arrow';
    arrow.textContent = '\u25B8';

    const label = document.createElement('span');
    label.className = 'chat-attached-label';
    label.textContent = '\u9644\u6587';

    toggle.appendChild(arrow);
    toggle.appendChild(label);

    const body = document.createElement('div');
    body.className = 'chat-attached-body';
    body.style.display = 'none';

    if (chatAttachedText) {
        const p = document.createElement('div');
        const strong = document.createElement('strong');
        strong.textContent = '\u539F\u6587\uFF1A';
        p.appendChild(strong);
        p.appendChild(document.createTextNode(chatAttachedText));
        body.appendChild(p);
    }

    if (chatAttachedTranslation) {
        const p = document.createElement('div');
        p.className = 'chat-attached-extra';
        const strong = document.createElement('strong');
        strong.textContent = '\u8BD1\u6587\uFF1A';
        p.appendChild(strong);
        p.appendChild(document.createTextNode(chatAttachedTranslation));
        body.appendChild(p);
    }

    attachedEl.replaceChildren(toggle, body);

    toggle.addEventListener('click', () => {
        const isOpen = body.style.display !== 'none';
        body.style.display = isOpen ? 'none' : 'block';
        arrow.textContent = isOpen ? '\u25B8' : '\u25BE';
    });
}

function bindChatEvents(dialog) {
    const closeBtn = dialog.querySelector('.chat-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => closeChatDialog());
    }

    const sendBtn = dialog.querySelector('.chat-send');
    const input = dialog.querySelector('.chat-input');

    const doSend = () => sendChatMessage(dialog);

    if (sendBtn) {
        sendBtn.addEventListener('click', doSend);
    }
    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                doSend();
            }
        });
    }

    dialog.addEventListener('mousedown', stopPropagation);
    dialog.addEventListener('mouseup', stopPropagation);
    bindChatWheelTrap(dialog);
}

function bindChatWheelTrap(dialog) {
    if (!dialog || dialog.dataset.chatWheelTrapBound === 'true') return;
    dialog.dataset.chatWheelTrapBound = 'true';

    dialog.addEventListener('wheel', (event) => {
        const target = event.target instanceof Element ? event.target : null;
        const scrollable = findChatScrollableElement(target, dialog);

        if (scrollable) {
            scrollable.scrollTop += event.deltaY;
            scrollable.scrollLeft += event.deltaX;
        }

        event.preventDefault();
        event.stopPropagation();
    }, { capture: true, passive: false });
}

function findChatScrollableElement(target, dialog) {
    let element = target;

    while (element && element !== dialog) {
        if (element instanceof HTMLElement && isScrollableElement(element)) {
            return element;
        }
        element = element.parentElement;
    }

    const messagesEl = dialog.querySelector('.chat-messages');
    return messagesEl instanceof HTMLElement && isScrollableElement(messagesEl) ? messagesEl : null;
}

function isScrollableElement(element) {
    const style = window.getComputedStyle(element);
    const canScrollY = /(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight;
    const canScrollX = /(auto|scroll)/.test(style.overflowX) && element.scrollWidth > element.clientWidth;
    return canScrollY || canScrollX;
}

function initResizeHandle(dialog) {
    const handle = dialog.querySelector('.chat-resize-handle');
    if (!handle) return;

    function onMouseDown(e) {
        e.preventDefault();
        e.stopPropagation();

        const startX = e.clientX;
        const startY = e.clientY;
        const startW = dialog.offsetWidth;
        const startH = dialog.offsetHeight;

        function onMouseMove(ev) {
            const w = Math.min(Math.max(startW + (ev.clientX - startX), 320), window.innerWidth * 0.9);
            const h = Math.min(Math.max(startH + (ev.clientY - startY), 240), window.innerHeight * 0.9);
            dialog.style.width = `${w}px`;
            dialog.style.height = `${h}px`;
        }

        function onMouseUp() {
            document.removeEventListener('mousemove', onMouseMove, true);
            document.removeEventListener('mouseup', onMouseUp, true);
        }

        document.addEventListener('mousemove', onMouseMove, true);
        document.addEventListener('mouseup', onMouseUp, true);
    }

    handle.addEventListener('mousedown', onMouseDown);
}

function doAskAutoSend() {
    if (!chatAttachedText && !chatAttachedTranslation) return;
    if (isAskResponding) return;

    const dialog = chatDialog;
    if (!dialog) return;

    let text = askPromptTemplate || '我在网页上看到了以下文本，想请你帮我分析一下：\n\n原文：\n{text}\n\n{translation}\n\n请帮我分析以上文本的主要内容和含义，并提供相关的背景知识或见解。';
    text = text.replace(/\{text\}/g, chatAttachedText || '');
    text = text.replace(/\{translation\}/g, chatAttachedTranslation ? `译文：\n${chatAttachedTranslation}` : '');

    const input = dialog.querySelector('.chat-input');
    if (input) input.value = text;
    sendChatMessage(dialog);
}

async function sendChatMessage(dialog) {
    if (!dialog) return;
    if (isAskResponding) return;

    const input = dialog.querySelector('.chat-input');
    const sendBtn = dialog.querySelector('.chat-send');
    const userMessage = input ? input.value.trim() : '';
    if (!userMessage) return;

    isAskResponding = true;

    if (input) {
        input.value = '';
        input.style.height = 'auto';
    }
    if (sendBtn) sendBtn.disabled = true;

    chatMessages.push({ role: 'user', content: userMessage });
    renderChatMessages(dialog);

    const requestId = `ask-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    activeChatRequestId = requestId;

    chatMessages.push({ role: 'assistant', content: '', loading: true });
    renderChatMessages(dialog);

    try {
        const result = await requestAsk(chatMessages.filter(m => !m.loading).map(m => ({
            role: m.role,
            content: m.content
        })), { stream: true, requestId });

        const lastMsg = chatMessages[chatMessages.length - 1];
        if (lastMsg && lastMsg.loading) {
            lastMsg.content = result.reply;
            lastMsg.loading = false;
            renderChatMessages(dialog);
        }
    } catch (error) {
        const lastMsg = chatMessages[chatMessages.length - 1];
        if (lastMsg && lastMsg.loading) {
            lastMsg.content = `错误：${error.message || '请求失败'}`;
            lastMsg.loading = false;
            lastMsg.error = true;
            renderChatMessages(dialog);
        }
    } finally {
        isAskResponding = false;
        if (sendBtn) sendBtn.disabled = false;
        if (input) input.focus();
    }
}

function renderChatMessages(dialog) {
    const messagesEl = dialog.querySelector('.chat-messages');
    if (!messagesEl) return;

    messagesEl.innerHTML = '';

    chatMessages.forEach(msg => {
        const bubble = document.createElement('div');
        bubble.className = `chat-message ${msg.role}`;
        if (msg.error) bubble.classList.add('chat-message-error');

        if (msg.loading) {
            bubble.innerHTML = '<span class="chat-loading">思考中<span class="chat-dots">...</span></span>';
        } else if (msg.role === 'assistant') {
            bubble.innerHTML = renderMarkdown(msg.content);
        } else {
            bubble.textContent = msg.content;
        }

        messagesEl.appendChild(bubble);
    });

    messagesEl.scrollTop = messagesEl.scrollHeight;
}

function renderMarkdown(text) {
    if (!text) return '';
    let html = text;

    html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
        return `<pre><code>${code.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()}</code></pre>`;
    });

    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/^\+ (.+)$/gm, '<li>$1</li>');
    html = html.replace(/^\* (.+)$/gm, '<li>$1</li>');

    html = html.replace(/^(\d+)\. (.+)$/gm, (_, num, content) => `<li value="${num}">${content}</li>`);

    html = html.replace(/((?:<li>.*?<\/li>\n?)+)/g, '<ul>$1</ul>');

    html = html.replace(/^---+$/gm, '<hr>');

    const paragraphs = html.split(/\n\n+/);
    html = paragraphs.map(p => {
        const trimmed = p.trim();
        if (!trimmed) return '';
        if (trimmed.startsWith('<h') || trimmed.startsWith('<ul') || trimmed.startsWith('<pre') || trimmed.startsWith('<hr')) return trimmed;
        return `<p>${trimmed}</p>`;
    }).join('\n');

    html = html.replace(/\n(?!<\/?(?:p|h[1-3]|ul|ol|li|pre|code))/g, '<br>');

    return html;
}

async function requestAsk(messages, options = {}) {
    const { stream = false, requestId = '' } = options;
    return new Promise((resolve, reject) => {
        try {
            chrome.runtime.sendMessage({
                type: 'ask',
                messages,
                stream,
                requestId
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(toUserErrorMessage(chrome.runtime.lastError)));
                    return;
                }
                if (!response) {
                    reject(new Error('未收到回复'));
                    return;
                }
                if (response.error) {
                    reject(new Error(response.error));
                    return;
                }
                resolve({
                    reply: response.reply || '',
                    model: response.model || ''
                });
            });
        } catch (error) {
            reject(new Error(toUserErrorMessage(error)));
        }
    });
}

function applyAskStreamUpdate(message) {
    if (currentDialogType !== 'chat') return;
    const dialog = chatDialog;
    if (!dialog) return;

    if (message.stage === 'text' && typeof message.text === 'string') {
        const lastMsg = chatMessages[chatMessages.length - 1];
        if (lastMsg && lastMsg.role === 'assistant') {
            lastMsg.content = message.text;
            lastMsg.loading = false;
            renderChatMessages(dialog);
        }
    }

    if (message.stage === 'done') {
        const lastMsg = chatMessages[chatMessages.length - 1];
        if (lastMsg && lastMsg.role === 'assistant') {
            lastMsg.content = message.text || lastMsg.content;
            lastMsg.loading = false;
            renderChatMessages(dialog);
        }
    }
}

function closeChatDialog() {
    if (chatDialog) {
        chatDialog.remove();
        if (chatDialog === resultPopover) resultPopover = null;
        chatDialog = null;
    } else if (resultPopover && currentDialogType === 'chat') {
        resultPopover.remove();
        resultPopover = null;
    }

    currentDialogType = null;
    chatMessages = [];
    chatAttachedText = '';
    chatAttachedTranslation = '';
    activeChatRequestId = null;
}

// ========== 流式状态重置 ==========
function resetTranslationStreamState() {
    activeTranslationRequestId = null;
    if (thinkingAnimationTimer !== null) {
        clearInterval(thinkingAnimationTimer);
        thinkingAnimationTimer = null;
    }
    thinkingDotCount = 0;
    setResultPopoverThinking(false);
}
