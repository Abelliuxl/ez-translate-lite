> 🌐 **Homepage**: <https://liuxl.com.cn/ez-translate-lite/>

<div align="center">
  <img src="icons/icon128.png" alt="EZ Translate Lite Logo" width="128" height="128">
  <h1>EZ Translate Lite: Lightweight Browser Translation Plugin</h1>
  <p><em>Forked from <a href="https://github.com/licon/ez-translate">licon/ez-translate</a> with significant simplifications and improvements</em></p>
</div>

EZ Translate Lite is a lightweight browser translation plugin that leverages Large Language Models (LLMs) to provide accurate and context-aware translation experience. This version is a fork of the original EZ Translate project, simplified and optimized for better usability.

**Note: This is a simplified fork** - We've removed several complex features to create a more focused, lightweight translation tool while maintaining core functionality.

## About This Fork

This project is forked from [licon/ez-translate](https://github.com/licon/ez-translate) with the following major changes:

### 🗑️ **Removed Features (Simplification)**
- **Fixed provider restrictions**: Removed hardcoded support for specific providers (Gemini, SiliconFlow, OpenRouter)
- **Voice/speech functionality**: Removed text-to-speech features
- **Right-click context menu translation**: Simplified the translation flow
- **Screenshot/Image translation**: Removed image-based translation capabilities
- **Complex provider-specific configurations**: Streamlined settings

### ✅ **Enhanced Features**
- **Flexible provider support**: Built-in mainstream providers plus customizable OpenAI/Anthropic-compatible endpoints
- **Draggable translation popup**: Translation window can be moved around the screen
- **Direct text copying**: Text in translation results can be selected and copied directly
- **Simplified UI**: Cleaner, more focused user interface
- **Lightweight design**: Reduced extension size and complexity

### 🎯 **Core Philosophy**
This fork prioritizes simplicity and usability over feature completeness. The goal is to provide a fast, reliable translation tool that works with practical provider choices and minimal setup complexity.

[查看中文版本 (View Chinese Version)](README_zh.md)

## Installation

### Manual Installation (Recommended)
This method is recommended if you cannot access browser extension stores.

1. Download the latest release `.zip` from GitHub Releases: [Latest Release](https://github.com/Abelliuxl/ez-translate-lite/releases/latest)
2. Unzip the downloaded file
3. **Chrome/Edge/Brave (Chromium-based)**:
   - Open `chrome://extensions` (Edge: `edge://extensions`, Brave: `brave://extensions`)
   - Enable "Developer mode"
   - Click "Load unpacked" and select the unzipped folder containing `manifest.json`
4. **Firefox**:
   - Open `about:debugging#/runtime/this-firefox`
   - Click "Load Temporary Add-on..." and select `manifest.json` inside the unzipped folder
5. **To update**: Re-download the latest `.zip`, unzip, and click "Reload" on the extension page

## Core Features

*   **Flexible Provider Support:** Built-in support for multiple mainstream providers, plus custom OpenAI/Anthropic-compatible endpoints.
*   **Hover Translation:** Select text on any webpage, and a translation icon appears. Click to see translation results in place.
*   **Popup Translation:** Click the browser toolbar icon to open a translation popup. Enter or paste text for instant translation.
*   **Draggable Popup:** The translation popup window can be dragged and repositioned anywhere on screen.
*   **Direct Text Selection:** Translation results can be selected and copied directly without additional buttons.
*   **Smart Auto-fill:** Selected text automatically fills the popup input when opened.
*   **One-Click Copy:** Built-in copy button for quick copying of translation results.
*   **Browser Storage:** Settings are stored in browser storage (local by default, with optional browser-account sync).
*   **Smart Language Detection:** Automatically detects source language and switches target language when needed.
*   **Multiple Language Support:** Supports 100+ languages for translation.

## Translation Methods

### 📍 **Hover Translation**
1. **Select text** on any webpage
2. **Translation icon appears** near your selection
3. **Click the icon** to see translation results
4. **Copy or interact** with the result as needed

### 🔲 **Popup Translation**
1. **Click the extension icon** in your browser toolbar
2. **Enter or paste text** in the input field
3. **Click translate** to get results
4. **Drag the popup** to reposition it anywhere on screen
5. **Select and copy** text directly from the results

### ⚡ **Smart Features**
- **Auto-fill**: Selected text automatically fills popup input
- **Language detection**: Automatically switches between target languages
- **Draggable interface**: Move translation popup anywhere on screen
- **Direct text access**: Select and copy translation results directly

## Configuration

### Provider Setup
This fork supports provider configuration through built-in and custom-compatible options:

1. Open extension settings
2. Choose your preferred LLM provider type
3. Enter your API key (and Base URL when using custom provider mode)
4. Fetch/select a model and save settings

### Built-in Provider Options
- OpenRouter
- SiliconFlow
- Longcat AI
- MiniMax
- Zhipu AI
- Moonshot Kimi
- DeepSeek
- Qwen (Tongyi)
- Doubao
- Custom OpenAI-compatible endpoint
- Custom Anthropic-compatible endpoint

For additional providers, use custom OpenAI-compatible or Anthropic-compatible endpoint mode.

## Tech Stack

*   **Frontend:** `HTML`, `CSS`, `JavaScript`
*   **Browser API:** `WebExtensions API` (compatible with Chrome, Firefox, Edge, etc.)
*   **Storage:** `chrome.storage.local` (default) and optional `chrome.storage.sync`

## Comparison with Original

| Feature | Original EZ Translate | This Fork |
|---------|----------------------|-----------|
| Provider Support | Fixed providers (Gemini, SiliconFlow, etc.) | **Built-in multi-provider + custom-compatible endpoints** |
| Translation Methods | Hover, Popup, Right-click, Screenshot | **Hover, Popup only** (simplified) |
| UI Complexity | Multiple features and options | **Simplified, focused interface** |
| Popup Behavior | Fixed position | **Draggable, repositionable** |
| Text Copying | Copy button only | **Direct selection + copy button** |
| Voice Features | Text-to-speech support | **Removed for simplicity** |
| Image Translation | Screenshot translation | **Removed for simplicity** |

## Why This Fork?

The original EZ Translate is a feature-rich extension, but some users prefer a simpler, more focused tool. This fork:

1. **Reduces complexity** by removing rarely-used features
2. **Increases flexibility** with built-in providers plus custom-compatible endpoint support
3. **Improves usability** with draggable popups and direct text copying
4. **Maintains core functionality** for daily translation needs
5. **Lightweight design** for faster performance

## Contributing

Contributions are welcome! Since this is a simplified fork, please focus on:
- Bug fixes and stability improvements
- Usability enhancements
- Performance optimizations
- Documentation improvements

Please note that we generally avoid adding back the removed complex features to maintain the lightweight philosophy.

## License

This project is licensed under the same license as the original EZ Translate project. See the [LICENSE](LICENSE) file for details.

## Privacy Policy

See [PRIVACY_POLICY.md](PRIVACY_POLICY.md).

## Acknowledgments

- Original project: [licon/ez-translate](https://github.com/licon/ez-translate)
- All contributors to the original project
- The open-source LLM community

---

*Last updated: March 2026*
