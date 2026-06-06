// content.js - 负责划词翻译的 UI 和交互

// --- 存储辅助函数 ---
async function getStorage() {
    return new Promise((resolve) => {
        if (!isExtensionContextValid()) {
            resolve(null);
            return;
        }

        try {
            chrome.storage.local.get(['syncEnabled'], (result) => {
                const syncEnabled = result.syncEnabled || false;
                resolve(syncEnabled ? chrome.storage.sync : chrome.storage.local);
            });
        } catch (error) {
            handleExtensionError(error);
            resolve(null);
        }
    });
}

const TRANSLATE_UI_SELECTOR = '#llm-translate-toolbar, #llm-translate-popover, #llm-translate-replace-confirm';
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
let replaceConfirmPopover = null;
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
const EDITABLE_SELECTION_CACHE_TTL = 1200;
const THINKING_PLACEHOLDER_BASE = '思考中';

// --- 初始化和设置监听 ---
initializeExtensionState();

function initializeExtensionState() {
    if (!isExtensionContextValid()) return;

    bindRuntimeMessageListener();

    try {
        chrome.storage.local.get('isSelectionTranslationEnabled', (result) => {
            isEnabled = result.isSelectionTranslationEnabled !== false;
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
    if (!message || message.type !== 'translation_stream') {
        return;
    }

    if (!activeTranslationRequestId || message.requestId !== activeTranslationRequestId) {
        return;
    }

    applyTranslationStreamUpdate(message);
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
    if (isTranslateUiTarget(event.target)) return;
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
        showResultPopover(x, y, getMessage('statusTranslating', 'Translating...'), true);
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

    if (
        editableContext &&
        editableContext.fullText.trim() &&
        (editableContext.type === 'text-control' || !isLikelyManagedContentEditable(editableContext.element))
    ) {
        const replaceButton = document.createElement('button');
        replaceButton.type = 'button';
        replaceButton.id = 'llm-translate-replace-icon';
        replaceButton.className = 'llm-translate-action-btn';
        replaceButton.title = getMessage('replaceInputButtonTitle', 'Translate and append to end of text');
        replaceButton.textContent = 'T';
        replaceButton.addEventListener('mousedown', preventFocusSteal);

        replaceButton.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            showReplaceConfirmPopover(event.clientX, event.clientY, editableContext);
        });

        actionToolbar.appendChild(replaceButton);
    }

    document.body.appendChild(actionToolbar);
    positionFloatingElement(actionToolbar, x, y);
}

function showReplaceConfirmPopover(x, y, editableContext) {
    removeReplaceConfirmPopover();

    replaceConfirmPopover = document.createElement('div');
    replaceConfirmPopover.id = 'llm-translate-replace-confirm';
    replaceConfirmPopover.innerHTML = `
        <div class="llm-translate-confirm-message"></div>
        <div class="llm-translate-confirm-actions">
            <button type="button" class="llm-translate-confirm-btn" data-action="cancel"></button>
            <button type="button" class="llm-translate-confirm-btn primary" data-action="confirm"></button>
        </div>
    `;

    replaceConfirmPopover.addEventListener('mousedown', stopPropagation);
    replaceConfirmPopover.addEventListener('mouseup', stopPropagation);

    const message = replaceConfirmPopover.querySelector('.llm-translate-confirm-message');
    const cancelButton = replaceConfirmPopover.querySelector('[data-action="cancel"]');
    const confirmButton = replaceConfirmPopover.querySelector('[data-action="confirm"]');
    cancelButton.addEventListener('mousedown', preventFocusSteal);
    confirmButton.addEventListener('mousedown', preventFocusSteal);

    renderStatusContent(
        message,
        getMessage('replaceInputConfirmMessage', 'Append the translation result to the end of the text?'),
        false
    );
    cancelButton.textContent = getMessage('cancelButton', 'Cancel');
    confirmButton.textContent = getMessage('confirmButton', 'Confirm');

    cancelButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        removeReplaceConfirmPopover();
    });

    confirmButton.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        setReplaceConfirmState({
            message: getMessage('statusTranslating', 'Translating...'),
            loading: true
        });

        try {
            const requestId = createTranslationRequestId();
            const { translation } = await requestTranslation(editableContext.selectedText, {
                stream: true,
                requestId
            });
            if (!translation.trim()) {
                throw new Error('翻译结果为空，未执行替换');
            }
            replaceEditableSelection(editableContext, translation);
            removeTranslationUI();
        } catch (error) {
            setReplaceConfirmState({
                message: toUserErrorMessage(error),
                loading: false
            });
        }
    });

    document.body.appendChild(replaceConfirmPopover);
    positionFloatingElement(replaceConfirmPopover, x, y, 14);
}

function setReplaceConfirmState({ message, loading }) {
    if (!replaceConfirmPopover) return;

    const messageElement = replaceConfirmPopover.querySelector('.llm-translate-confirm-message');
    const buttons = replaceConfirmPopover.querySelectorAll('.llm-translate-confirm-btn');

    renderStatusContent(messageElement, message, loading);

    buttons.forEach((button) => {
        button.disabled = loading;
    });
}

function showResultPopover(x, y, content, loading = false) {
    if (!resultPopover) {
        resultPopover = document.createElement('div');
        resultPopover.id = 'llm-translate-popover';
        resultPopover.innerHTML = `
            <div id="llm-translate-popover-meta">
                <div id="llm-translate-popover-meta-left">
                    <span id="llm-translate-popover-model">模型：--</span>
                    <span id="llm-translate-popover-thinking" style="display: none;"></span>
                </div>
                <button class="llm-translate-copy-btn small" id="llm-translate-popover-copy" title="${getMessage('copyTranslation', 'Copy translation')}">📋</button>
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
        updateResultPopover(message.text);
        if (message.text.trim()) {
            setResultPopoverThinking(false);
        }
        return;
    }

    if (message.stage === 'done') {
        if (typeof message.translation === 'string' && message.translation) {
            updateResultPopover(message.translation);
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

// --- 输入内容替换 ---
function replaceEditableSelection(editableContext, text) {
    if (!editableContext || !editableContext.element) {
        return;
    }

    if (editableContext.type === 'text-control') {
        appendToTextControl(editableContext, text);
        clearEditableSelectionContextCache();
        return;
    }

    if (editableContext.type === 'contenteditable') {
        appendToContentEditable(editableContext, text);
        clearEditableSelectionContextCache();
    }
}

function appendToTextControl(editableContext, text) {
    const element = editableContext.element;
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
        return;
    }

    element.focus();
    const previousValue = element.value;
    const expectedValue = previousValue + text;
    const nextCaret = expectedValue.length;

    // 直接赋值，保留浏览器内部输入状态管理，避免破坏选区能力
    element.value = expectedValue;

    if (typeof element.setSelectionRange === 'function') {
        element.setSelectionRange(nextCaret, nextCaret);
    }

    notifyTextControlMutation(element, {
        previousValue,
        inputType: 'insertText',
        data: text
    });
}

function appendToContentEditable(editableContext, text) {
    const element = editableContext.element;
    if (!(element instanceof HTMLElement) || !element.isContentEditable) {
        return;
    }

    if (isLikelyManagedContentEditable(element)) {
        throw new Error('当前输入框由页面脚本托管，自动插入可能导致编辑器异常。请手动粘贴翻译结果。');
    }

    element.focus();
    const selection = window.getSelection();
    if (!selection) {
        return;
    }

    // 将光标移到内容末尾，而非替换选区
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);

    let inserted = false;
    try {
        inserted = document.execCommand('insertText', false, text);
    } catch (error) {
        inserted = false;
    }

    if (!inserted) {
        const textNode = document.createTextNode(text);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
}

function setTextControlValueWithSetter(element, text) {
    const prototype = element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const valueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

    if (valueSetter) {
        valueSetter.call(element, text);
        return;
    }

    element.value = text;
}

function notifyTextControlMutation(element, details = {}) {
    const { previousValue = '', inputType = 'insertText', data = null } = details;
    syncReactValueTracker(element, previousValue);
    dispatchEditableInputEvent(element, { inputType, data });
    // 一些站点只监听普通 Event('input') 或在 change 时才刷新布局。
    element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    element.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
}

function syncReactValueTracker(element, previousValue) {
    const tracker = element && element._valueTracker;
    if (!tracker || typeof tracker.setValue !== 'function') {
        return;
    }

    try {
        tracker.setValue(String(previousValue));
    } catch (error) {
        // 忽略 tracker 同步失败，继续派发事件
    }
}

function isLikelyManagedContentEditable(element) {
    if (!(element instanceof HTMLElement)) {
        return false;
    }

    if (
        element.matches('[data-slate-editor="true"]') ||
        element.matches('[data-lexical-editor="true"]')
    ) {
        return true;
    }

    return Boolean(
        element.closest('.ProseMirror, .ql-editor, .ck-content, [data-slate-editor="true"], [data-lexical-editor="true"]')
    );
}

function dispatchEditableInputEvent(element, details = {}) {
    const { inputType = 'insertText', data = null } = details;

    if (typeof InputEvent === 'function') {
        try {
            element.dispatchEvent(new InputEvent('input', {
                bubbles: true,
                composed: true,
                data,
                inputType
            }));
            return;
        } catch (error) {
            // 回退到普通 Event
        }
    }

    element.dispatchEvent(new Event('input', { bubbles: true }));
}

function preventFocusSteal(event) {
    event.preventDefault();
}

// --- 拖拽 ---
function makeDraggable(element, handle) {
    let pos1 = 0;
    let pos2 = 0;
    let pos3 = 0;
    let pos4 = 0;
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
            (!target || !(target instanceof Element) || (!target.closest('.llm-translate-header') && !target.closest('.llm-translate-popover-header')))
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

        document.addEventListener('mouseup', closeDragElement, true);
        document.addEventListener('mousemove', elementDrag);
        window.addEventListener('blur', closeDragElement);
        element.classList.add('llm-translate-dragging');

        const style = window.getComputedStyle(element);
        if (style.position === 'fixed' && style.transform !== 'none') {
            const rect = element.getBoundingClientRect();
            element.style.transform = 'none';
            element.style.top = `${rect.top}px`;
            element.style.left = `${rect.left}px`;
            element.style.margin = '0';
        }
    }

    function elementDrag(event) {
        event.preventDefault();
        pos1 = pos3 - event.clientX;
        pos2 = pos4 - event.clientY;
        pos3 = event.clientX;
        pos4 = event.clientY;

        element.style.top = `${element.offsetTop - pos2}px`;
        element.style.left = `${element.offsetLeft - pos1}px`;
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

    removeReplaceConfirmPopover();
}

function removeReplaceConfirmPopover() {
    if (replaceConfirmPopover) {
        replaceConfirmPopover.remove();
        replaceConfirmPopover = null;
    }
}

function removeTranslationUI() {
    cancelPendingSelectionToolbar();
    resetTranslationStreamState();
    removeSelectionActionUI();

    if (resultPopover) {
        resultPopover.remove();
        resultPopover = null;
    }
}

function stopPropagation(event) {
    event.stopPropagation();
}

function resetTranslationStreamState() {
    activeTranslationRequestId = null;
    if (thinkingAnimationTimer !== null) {
        clearInterval(thinkingAnimationTimer);
        thinkingAnimationTimer = null;
    }
    thinkingDotCount = 0;
    setResultPopoverThinking(false);
}
