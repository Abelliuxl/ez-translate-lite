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

// --- I18n Helper ---
function setupI18n() {
    document.querySelectorAll('[data-i18n]').forEach(elem => {
        const key = elem.getAttribute('data-i18n');
        elem.textContent = chrome.i18n.getMessage(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(elem => {
        const key = elem.getAttribute('data-i18n-placeholder');
        elem.placeholder = chrome.i18n.getMessage(key);
    });
    document.title = chrome.i18n.getMessage('popupTitle');
}

// --- Language Data ---
const languageKeys = [
    "langEnglish", "langSimplifiedChinese", "langTraditionalChinese", "langFrench", "langSpanish", "langArabic", "langRussian", "langPortuguese", "langGerman", "langItalian", "langDutch", "langDanish", "langIrish", "langWelsh", "langFinnish", "langIcelandic", "langSwedish", "langNorwegianNynorsk", "langNorwegianBokmal", "langJapanese", "langKorean", "langVietnamese", "langThai", "langIndonesian", "langMalay", "langBurmese", "langTagalog", "langKhmer", "langLao", "langHindi", "langBengali", "langUrdu", "langNepali", "langHebrew", "langTurkish", "langPersian", "langPolish", "langUkrainian", "langCzech", "langRomanian", "langBulgarian", "langSlovak", "langHungarian", "langSlovenian", "langLatvian", "langEstonian", "langLithuanian", "langBelarusian", "langGreek", "langCroatian", "langMacedonian", "langMaltese", "langSerbian", "langBosnian", "langGeorgian", "langArmenian", "langNorthAzerbaijani", "langKazakh", "langNorthernUzbek", "langTajik", "langSwahili", "langAfrikaans", "langCantonese", "langLuxembourgish", "langLimburgish", "langCatalan", "langGalician", "langAsturian", "langBasque", "langOccitan", "langVenetian", "langSardinian", "langSicilian", "langFriulian", "langLombard", "langLigurian", "langFaroese", "langToskAlbanian", "langSilesian", "langBashkir", "langTatar", "langMesopotamianArabic", "langNajdiArabic", "langEgyptianArabic", "langLevantineArabic", "langTaizziAdeniArabic", "langDari", "langTunisianArabic", "langMoroccanArabic", "langKabuverdianu", "langTokPisin", "langEasternYiddish", "langSindhi", "langSinhala", "langTelugu", "langPunjabi", "langTamil", "langGujarati", "langMalayalam", "langMarathi", "langKannada", "langMagahi", "langOriya", "langAwadhi", "langMaithili", "langAssamese", "langChhattisgarhi", "langBhojpuri", "langMinangkabau", "langBalinese", "langJavanese", "langBanjar", "langSundanese", "langCebuano", "langPangasinan", "langIloko", "langWarayPhilippines", "langHaitian", "langPapiamento"
];

function populateLanguages() {
    const targetLanguageSelect = document.getElementById('target-language');
    targetLanguageSelect.innerHTML = '';

    languageKeys.forEach(key => {
        const option = document.createElement('option');
        const message = chrome.i18n.getMessage(key);
        option.value = key; // Use the message key as the value
        option.textContent = message;
        targetLanguageSelect.appendChild(option);
    });
    
    // Set default language after populating options
    setDefaultLanguage();
}

async function setDefaultLanguage() {
    const storage = await getStorage();
    storage.get(['targetLanguage'], (result) => {
        if (result.targetLanguage) {
            targetLanguageSelect.value = result.targetLanguage;
        } else {
            // If no language is saved, set it based on the browser's language
            const browserLang = chrome.i18n.getUILanguage();
            const langCode = browserLang.split('-')[0];
            const defaultLangKey = browserLangToMsgKey[browserLang] || browserLangToMsgKey[langCode];

            if (defaultLangKey) {
                targetLanguageSelect.value = defaultLangKey;
                storage.set({ targetLanguage: defaultLangKey });
            } else {
                // Fallback to English if no match found
                targetLanguageSelect.value = 'langEnglish';
                storage.set({ targetLanguage: 'langEnglish' });
            }
        }
    });
}

const langKeyToEnName = {
    "langEnglish": "English", "langSimplifiedChinese": "Simplified Chinese", "langTraditionalChinese": "Traditional Chinese", "langFrench": "French", "langSpanish": "Spanish", "langArabic": "Arabic", "langRussian": "Russian", "langPortuguese": "Portuguese", "langGerman": "German", "langItalian": "Italian", "langDutch": "Dutch", "langDanish": "Danish", "langIrish": "Irish", "langWelsh": "Welsh", "langFinnish": "Finnish", "langIcelandic": "Icelandic", "langSwedish": "Swedish", "langNorwegianNynorsk": "Norwegian Nynorsk", "langNorwegianBokmal": "Norwegian Bokmål", "langJapanese": "Japanese", "langKorean": "Korean", "langVietnamese": "Vietnamese", "langThai": "Thai", "langIndonesian": "Indonesian", "langMalay": "Malay", "langBurmese": "Burmese", "langTagalog": "Tagalog", "langKhmer": "Khmer", "langLao": "Lao", "langHindi": "Hindi", "langBengali": "Bengali", "langUrdu": "Urdu", "langNepali": "Nepali", "langHebrew": "Hebrew", "langTurkish": "Turkish", "langPersian": "Persian", "langPolish": "Polish", "langUkrainian": "Ukrainian", "langCzech": "Czech", "langRomanian": "Romanian", "langBulgarian": "Bulgarian", "langSlovak": "Slovak", "langHungarian": "Hungarian", "langSlovenian": "Slovenian", "langLatvian": "Latvian", "langEstonian": "Estonian", "langLithuanian": "Lithuanian", "langBelarusian": "Belarusian", "langGreek": "Greek", "langCroatian": "Croatian", "langMacedonian": "Macedonian", "langMaltese": "Maltese", "langSerbian": "Serbian", "langBosnian": "Bosnian", "langGeorgian": "Georgian", "langArmenian": "Armenian", "langNorthAzerbaijani": "North Azerbaijani", "langKazakh": "Kazakh", "langNorthernUzbek": "Northern Uzbek", "langTajik": "Tajik", "langSwahili": "Swahili", "langAfrikaans": "Afrikaans", "langCantonese": "Cantonese", "langLuxembourgish": "Luxembourgish", "langLimburgish": "Limburgish", "langCatalan": "Catalan", "langGalician": "Galician", "langAsturian": "Asturian", "langBasque": "Basque", "langOccitan": "Occitan", "langVenetian": "Venetian", "langSardinian": "Sardinian", "langSicilian": "Sicilian", "langFriulian": "Friulian", "langLombard": "Lombard", "langLigurian": "Ligurian", "langFaroese": "Faroese", "langToskAlbanian": "Tosk Albanian", "langSilesian": "Silesian", "langBashkir": "Bashkir", "langTatar": "Tatar", "langMesopotamianArabic": "Mesopotamian Arabic", "langNajdiArabic": "Najdi Arabic", "langEgyptianArabic": "Egyptian Arabic", "langLevantineArabic": "Levantine Arabic", "langTaizziAdeniArabic": "Ta'izzi-Adeni Arabic", "langDari": "Dari", "langTunisianArabic": "Tunisian Arabic", "langMoroccanArabic": "Moroccan Arabic", "langKabuverdianu": "Kabuverdianu", "langTokPisin": "Tok Pisin", "langEasternYiddish": "Eastern Yiddish", "langSindhi": "Sindhi", "langSinhala": "Sinhala", "langTelugu": "Telugu", "langPunjabi": "Punjabi", "langTamil": "Tamil", "langGujarati": "Gujarati", "langMalayalam": "Malayalam", "langMarathi": "Marathi", "langKannada": "Kannada", "langMagahi": "Magahi", "langOriya": "Oriya", "langAwadhi": "Awadhi", "langMaithili": "Maithili", "langAssamese": "Assamese", "langChhattisgarhi": "Chhattisgarhi", "langBhojpuri": "Bhojpuri", "langMinangkabau": "Minangkabau", "langBalinese": "Balinese", "langJavanese": "Javanese", "langBanjar": "Banjar", "langSundanese": "Sundanese", "langCebuano": "Cebuano", "langPangasinan": "Pangasinan", "langIloko": "Iloko", "langWarayPhilippines": "Waray (Philippines)", "langHaitian": "Haitian", "langPapiamento": "Papiamento"
};

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

// --- Main Logic ---
const translateButton = document.getElementById('translate-button');
const textInput = document.getElementById('text-input');
const resultContainer = document.getElementById('translation-result');
const targetLanguageSelect = document.getElementById('target-language');
const copyButton = document.getElementById('copy-button');
const selectionTranslateToggle = document.getElementById('selection-translate-toggle');
const settingsIconButton = document.getElementById('settings-icon-button');

translateButton.addEventListener('click', async () => {
    const text = textInput.value;
    const targetLanguageKey = targetLanguageSelect.value;
    const targetLanguage = langKeyToEnName[targetLanguageKey] || 'English';

    if (text.trim()) {
        resultContainer.innerText = chrome.i18n.getMessage('statusTranslating');
        copyButton.style.display = 'none';

        // Get second target language from settings
        const storage = await getStorage();
        storage.get(['secondTargetLanguage'], (result) => {
            const secondTargetLanguageKey = result.secondTargetLanguage || 'langEnglish';
            const secondTargetLanguage = langKeyToEnName[secondTargetLanguageKey] || 'English';
            
            chrome.runtime.sendMessage({ 
                type: 'translate', 
                text, 
                targetLanguage, 
                secondTargetLanguage 
            }, (response) => {
                if (response.error) {
                    resultContainer.innerText = chrome.i18n.getMessage('statusError', [response.error]);
                    copyButton.style.display = 'none';
                } else {
                    resultContainer.innerText = response.translation;
                    copyButton.style.display = 'block';
                }
            });
        });
    }
});

copyButton.addEventListener('click', () => {
    const text = resultContainer.innerText;
    navigator.clipboard.writeText(text).then(() => {
        // Optional: Add visual feedback
        copyButton.textContent = '✓';
        setTimeout(() => {
            copyButton.innerHTML = '&#x1f4cb;';
        }, 1000);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
    });
});

targetLanguageSelect.addEventListener('change', async () => {
    const storage = await getStorage();
    storage.set({ targetLanguage: targetLanguageSelect.value });
});

selectionTranslateToggle.addEventListener('change', async () => {
    const storage = await getStorage();
    storage.set({ isSelectionTranslationEnabled: selectionTranslateToggle.checked });
});

async function loadSettings() {
    const storage = await getStorage();
    storage.get(['isSelectionTranslationEnabled'], (result) => {
        selectionTranslateToggle.checked = result.isSelectionTranslationEnabled !== false; // Default to true
    });
}

async function loadSelectedText() {
    chrome.storage.local.get('lastSelectedText', (result) => {
        if (result.lastSelectedText) {
            textInput.value = result.lastSelectedText;
            chrome.storage.local.set({ 'lastSelectedText': '' });
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    setupI18n();
    populateLanguages(); // This now also sets the default language
    loadSettings(); // This now only handles other settings
    loadSelectedText();
    
    // Auto-focus the input field when popup opens
    textInput.focus();
});

// Listen for messages from the background script (e.g., from context menu)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'SET_TEXT_AND_TRANSLATE') {
        textInput.value = request.text;
        translateButton.click();
    }
});


settingsIconButton.addEventListener('click', () => {
    // open options page in new tab
    chrome.runtime.openOptionsPage();
});
