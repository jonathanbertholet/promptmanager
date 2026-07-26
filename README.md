# Open Prompt Manager (Cross-Browser Edition)

A lightweight, open-source **Cross-Browser WebExtension (Manifest V3)** for saving, organizing, and inserting prompts across AI chatbots — ChatGPT, Claude, Gemini, Grok, and [17+ more platforms](#supported-platforms).

**Branch:** `combined` (Chrome & Firefox Combined Build Target) · [Open Prompt Database](https://openpromptdatabase.com/)

---

## Overview & Architecture

This branch contains the **unified cross-browser codebase** for Open Prompt Manager, featuring automated build tools, dual manifest targets, and defensive runtime abstractions to run seamlessly on both **Google Chrome** and **Mozilla Firefox**.

### Cross-Browser Architecture Highlights

- **Dual Target Manifests**:
  - `src/manifest.chrome.json`: Clean Chrome Manifest V3 specification (`service_worker`, `side_panel`, 0 developer warnings in Chrome).
  - `src/manifest.firefox.json`: Firefox WebExtension specification (`browser_specific_settings`, `sidebar_action`, `background.scripts`).
- **Unified WebExtensions API Abstraction**: Standardized namespace access via `globalThis.browser ?? globalThis.chrome`.
- **Defensive API Guarding**: Programmatic checks for engine-specific APIs (`chrome.sidePanel.setPanelBehavior`, `chrome.dom.openOrClosedShadowRoot`).
- **Content Script Storage Adapters**: Fallback adapters handling content script JS Sandbox storage access across Gecko and Chromium engines.

---

## Build Commands & Manifest Switching

Easily switch the active `src/manifest.json` file for local development or automated packaging:

```bash
# Configure manifest for Mozilla Firefox (about:debugging / AMO)
npm run build:firefox

# Configure manifest for Google Chrome (chrome://extensions / Web Store)
npm run build:chrome

# Build production bundle
npm run build:prod
```

---

## Features

### Prompt Library

- Save, edit, reorder, and delete prompts from the **side panel / sidebar** or an **in-page panel** on assistant sites
- **Tags** with search and filter — synced between the side panel and in-page list; tag suggestions on create/edit forms
- Drag to reorder tags in Settings → **Tag management**
- **Variables** with `#variable#` syntax — fill in values before inserting
- **Import / export** full v2 backups (prompts, folders, tag order) as JSON
- **Copy to clipboard** from the side panel or context menu — handy on unsupported sites
- Save selected text to your library via the **context menu**

### On Assistant Sites

- **Floating button** or **hot corner** launcher (choose in Settings)
- One-click insert into the chat input, with optional append mode
- **Custom keyboard shortcut** — record your own open/close combo (default: ⌘⇧P on Mac, Ctrl+M on Windows/Linux)
- **Custom websites** — pin any site's chat input from the side panel
- Light and dark themes, with optional force-dark mode

### Open Prompt Database

Browse community prompts on the [Open Prompt Database](https://openpromptdatabase.com/) and add them to your library with one click.

- Stable `opd:` ids — re-import updates the same prompt when the catalog entry changes
- Duplicate detection — already in your library? The site shows “Already in library”
- Link from Settings → **Browse the community catalog**

---

## Supported Platforms

| ChatGPT | Claude | Google Gemini |
| :--- | :--- | :--- |
| **NotebookLM** | **DeepSeek** | **Microsoft Copilot** |
| **GitHub Copilot** | **Grok** | **Poe** |
| **Kimi** | **Mistral Le Chat** | **OpenRouter** |
| **Perplexity** | **Qwen** | **Google AI Studio** |
| **OpenAI Playground** | **ChatLLM (Abacus)** | **LMArena** |

Plus any site you configure as a **custom website**.

---

## Installation & Local Development

### 1. Development for Google Chrome

```bash
# Ensure manifest is configured for Chrome
npm run build:chrome
```
1. Open Google Chrome and go to `chrome://extensions`.
2. Enable **Developer mode** (top right toggle).
3. Click **Load unpacked** and select the `src/` folder.

### 2. Development for Mozilla Firefox

```bash
# Ensure manifest is configured for Firefox
npm run build:firefox
```
1. Open Firefox and go to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...**.
3. Select `src/manifest.json` (or `src/manifest.firefox.json`).

---

## Repository Branch Directory

| Branch | Description | Primary Target | Manifest Configuration |
| :--- | :--- | :--- | :--- |
| **`main`** | **Firefox Version** | Mozilla Firefox (AMO) | `manifest.firefox.json` (`sidebar_action`, `background.scripts`) |
| **`combined`** *(current)* | **Cross-Browser Version** | Chrome & Firefox | Build tools (`npm run build:chrome`, `npm run build:firefox`) |
| **`chrome-only`** | **Original Chrome Version** | Google Chrome | Chrome MV3 (`service_worker`, `side_panel`) |

To switch branches:
```bash
# Switch to Firefox Main branch
git checkout main

# Switch to Original Chrome branch
git checkout chrome-only
```

---

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| **⌘ + Shift + P** (Mac) / **Ctrl + M** (Win/Linux) | Open or close the in-page prompt panel |
| **↑ / ↓** | Navigate the prompt list |
| **Enter** | Select a prompt |
| **Esc** | Close the panel |

You can change the open/close shortcut in Settings → **Record shortcut**.

---

## Testing

Automated tests use **Puppeteer** and **Jest**. See [TESTING.md](TESTING.md) for setup and execution commands.

---

## Privacy

- Your prompt library is stored **locally** in the browser (`chrome.storage.local` / `browser.storage.local`)
- Nothing is sent to external servers unless **you** choose to import from the [Open Prompt Database](https://openpromptdatabase.com/) — that flow only pulls the prompt you selected into your local library
- Zero analytics or tracking

---

## License

MIT License — see [LICENSE](LICENSE) if present in the repository.

---

## Attributions

- **Hexodus** — bug reports and fixes
- **Abdallahheidar** — ideas, contributions, and teamwork
- **HideMaru** — extension icon ([Flaticon chatbot icons](https://www.flaticon.com/free-icons/chatbot))
