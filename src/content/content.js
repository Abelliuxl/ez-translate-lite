// content.js - 负责划词翻译的 UI 和交互 (v2 - 修复版)

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

// --- 全局变量 ---
let translateIcon = null;
let resultPopover = null;
let isEnabled = true; // 默认启用

// --- 初始化和设置监听 ---
// 首次加载时获取设置
chrome.storage.local.get('isSelectionTranslationEnabled', (result) => {
    // 如果未设置，则默认为 true
    isEnabled = result.isSelectionTranslationEnabled !== false;
});

// 监听设置变化（同时监听 local 和 sync 命名空间）
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (changes.isSelectionTranslationEnabled) {
        isEnabled = changes.isSelectionTranslationEnabled.newValue;
        // 如果禁用了，立即移除现有UI
        if (!isEnabled) {
            removeTranslationUI();
        }
    }
});


// --- 事件监听 ---

// 监听鼠标抬起事件，用于显示翻译图标
document.addEventListener('mouseup', (event) => {
    // 如果功能被禁用，则不执行任何操作
    if (!isEnabled) return;

    // 如果事件的目标是我们的UI，则不处理，避免冲突
    if (event.target.id?.startsWith('llm-translate-')) return;
    
    // 移除已有的UI
    removeTranslationUI();

    const selectedText = window.getSelection().toString().trim();
    if (selectedText.length > 0) {
        // 保存文本以备 popup 使用
        chrome.storage.local.set({ 'lastSelectedText': selectedText });
        // 创建翻译图标
        createTranslateIcon(event.clientX, event.clientY, selectedText);
    }
});

// 监听鼠标按下事件，用于在开始新的操作时移除UI
document.addEventListener('mousedown', (event) => {
    // 如果点击的不是我们的UI，则移除它
    if (!event.target.closest('#llm-translate-icon, #llm-translate-popover')) {
        removeTranslationUI();
    }
});

// 监听键盘事件，ESC 键关闭弹窗
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        const popover = document.querySelector('#llm-translate-popover');
        if (popover) {
            removeTranslationUI();
        }
    }
});


// --- UI 创建与销毁 ---

/**
 * 创建翻译小图标
 * @param {number} x - 鼠标X坐标
 * @param {number} y - 鼠标Y坐标
 * @param {string} text - 选中的文本
 */
function createTranslateIcon(x, y, text) {
    translateIcon = document.createElement('div');
    translateIcon.id = 'llm-translate-icon';
    translateIcon.style.left = `${x + window.scrollX}px`;
    translateIcon.style.top = `${y + window.scrollY + 15}px`;
    
    // 使用 chrome.runtime.getURL() 加载真实的图标文件
    const iconImg = document.createElement('img');
    iconImg.id = 'llm-translate-icon-img';
    iconImg.src = chrome.runtime.getURL('icons/icon48.png');
    // 遵从您的指示，将尺寸设置为 20x20
    iconImg.style.width = '20px';
    iconImg.style.height = '20px';
    translateIcon.appendChild(iconImg);

    // 阻止 mouseup 事件冒泡，避免冲突
    translateIcon.addEventListener('mouseup', (e) => {
        e.stopPropagation();
    });

    translateIcon.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const storage = await getStorage();
        const { targetLanguage, secondTargetLanguage } = await storage.get(['targetLanguage', 'secondTargetLanguage']);
        // 存储中保存的是语言键（如 langEnglish）。但为了兼容历史数据，做健壮处理。
        const storedPrimary = targetLanguage || 'langSimplifiedChinese';
        const storedSecondary = secondTargetLanguage || 'langEnglish';

        // Convert language keys to language names（英文名传给后端提示词使用）
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

        // 兼容三种输入：语言键、英文名、其他（回退 English）
        const normalizeToEnName = (input) => {
            if (!input) return 'English';
            if (langKeyToEnName[input]) return langKeyToEnName[input];
            // 常见本地化/别名归一
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
            if (aliasToEnName[input]) return aliasToEnName[input];
            // 若已是英文名称（来自旧版本或手动写入），直接使用
            const values = Object.values(langKeyToEnName);
            if (values.includes(input)) return input;
            return 'English';
        };

        const targetLanguageName = normalizeToEnName(storedPrimary);
        const secondTargetLanguageName = normalizeToEnName(storedSecondary);
        
        showResultPopover(x, y, chrome.i18n.getMessage('statusTranslating'));
        chrome.runtime.sendMessage({ 
            type: 'translate', 
            text, 
            targetLanguage: targetLanguageName,
            secondTargetLanguage: secondTargetLanguageName
        }, (response) => {
            if (response.error) {
                updateResultPopover(response.error);
            } else {
                updateResultPopover(response.translation);
            }
        });
        translateIcon.remove();
        translateIcon = null;
    });

    document.body.appendChild(translateIcon);
}

/**
 * 显示或创建结果浮窗
 */
function showResultPopover(x, y, content) {
    if (!resultPopover) {
        resultPopover = document.createElement('div');
        resultPopover.id = 'llm-translate-popover';
        resultPopover.innerHTML = `
            <button class="llm-translate-copy-btn small" id="llm-translate-popover-copy" title="复制翻译">📋</button>
            <div id="llm-translate-popover-content"></div>
        `;
        document.body.appendChild(resultPopover);
        
        // 使普通浮窗可拖拽
        makeDraggable(resultPopover);

        // 阻止 mousedown 冒泡，防止触发全局关闭逻辑
        resultPopover.addEventListener('mousedown', (e) => {
            e.stopPropagation();
        });

        // 添加复制按钮事件
        const copyBtn = resultPopover.querySelector('#llm-translate-popover-copy');
        copyBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const contentDiv = resultPopover.querySelector('#llm-translate-popover-content');
            const textToCopy = contentDiv.textContent;
            
            try {
                await navigator.clipboard.writeText(textToCopy);
                const originalText = copyBtn.textContent;
                copyBtn.textContent = '✅';
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                }, 1500);
            } catch (err) {
                console.error('复制失败:', err);
            }
        });
    }
    resultPopover.style.left = `${x + window.scrollX}px`;
    resultPopover.style.top = `${y + window.scrollY + 15}px`;
    resultPopover.querySelector('#llm-translate-popover-content').textContent = content;
    resultPopover.style.display = 'block';
}

/**
 * 更新结果浮窗的内容
 */
function updateResultPopover(content) {
    if (resultPopover) {
        const contentDiv = resultPopover.querySelector('#llm-translate-popover-content');
        if (contentDiv) {
            contentDiv.textContent = content;
        }
    }
}

/**
 * 使元素可拖拽
 */
function makeDraggable(element, handle) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    handle = handle || element;

    handle.addEventListener('mousedown', dragMouseDown);

    function dragMouseDown(e) {
        // 如果点击的是按钮、输入框或链接，不触发拖拽
        if (e.target.tagName === 'BUTTON' || 
            e.target.tagName === 'INPUT' || 
            e.target.tagName === 'A' || 
            e.target.classList.contains('llm-translate-close') ||
            e.target.classList.contains('llm-translate-copy-btn')) {
            return;
        }

        // 如果点击的是内容区域且不是 handle，则允许文本选择，不触发拖拽
        if (handle !== element && !e.target.closest('.llm-translate-header') && !e.target.closest('.llm-translate-popover-header')) {
            return;
        }
        
        // 对于没有 handle 的情况（普通浮窗），我们只在点击非文本区域时触发拖拽
        if (handle === element && e.target.id === 'llm-translate-popover-content') {
            return;
        }
        
        e.preventDefault();
        e.stopPropagation(); // 阻止冒泡，防止触发全局关闭逻辑
        
        // 获取鼠标初始位置
        pos3 = e.clientX;
        pos4 = e.clientY;
        
        document.addEventListener('mouseup', closeDragElement);
        document.addEventListener('mousemove', elementDrag);
        
        element.classList.add('llm-translate-dragging');
        
        // 如果是 fixed 布局且有 transform，在开始拖拽时将其转换为具体的 top/left
        const style = window.getComputedStyle(element);
        if (style.position === 'fixed' && style.transform !== 'none') {
            const rect = element.getBoundingClientRect();
            element.style.transform = 'none';
            element.style.top = rect.top + 'px';
            element.style.left = rect.left + 'px';
            element.style.margin = '0'; // 移除可能存在的 margin
        }
    }

    function elementDrag(e) {
        e.preventDefault();
        // 计算偏移量
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        
        // 设置元素新位置
        element.style.top = (element.offsetTop - pos2) + "px";
        element.style.left = (element.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
        document.removeEventListener('mouseup', closeDragElement);
        document.removeEventListener('mousemove', elementDrag);
        element.classList.remove('llm-translate-dragging');
    }
}

/**
 * 移除所有翻译相关的UI元素
 */
function removeTranslationUI() {
    if (translateIcon) {
        translateIcon.remove();
        translateIcon = null;
    }
    if (resultPopover) {
        resultPopover.remove();
        resultPopover = null;
    }
}
