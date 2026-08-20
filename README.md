# Open Prompt Manager

A lightweight, open-source Chrome extension for saving, organizing, and inserting prompts across AI chatbots — ChatGPT, Claude, Gemini, Grok, and 14 other built-in assistants.

**Current version:** 3.0.2 · [Chrome Web Store](https://chromewebstore.google.com/detail/open-prompt-manager/gmhaghdbihgenofhnmdbglbkbplolain) · [Open Prompt Database](https://openpromptdatabase.com/) · [Release notes](https://github.com/jonathanbertholet/promptmanager/releases/tag/3.0.2)

## Features

### Prompt library

- Save, edit, reorder, and delete prompts from the **side panel** or an **in-page panel** on assistant sites
- Click a prompt in the **side panel** to insert it into the chat input on an enabled site
- **Tags** with search and filter — synced between the side panel and in-page list; tag suggestions on create/edit forms
- Drag to reorder tags in Settings → **Tag management**
- **Variables** with `#variable#` syntax — fill in values in the side panel or in-page panel before inserting
- **Import / export** full v2 backups (prompts, folders, tag metadata) as JSON
- **Copy to clipboard** from the side panel or context menu — handy on unsupported sites
- Save selected text to your library via the **context menu**

### On assistant sites

- Three launchers (choose on first run or in Settings): **floating button**, **hot corner**, or **sidebar / shortcut** only
- One-click insert into the chat input, with optional append mode
- **Custom keyboard shortcut** — record your own open/close combo (default: ⌘⇧P on Mac, Ctrl+M on Windows/Linux)
- The in-page launcher hides while the Chrome side panel is open
- **Custom websites** — pin any site’s chat input from the side panel
- Remembers the last successful chat input per site
- Light and dark themes, with optional force-dark mode

### Open Prompt Database

Browse community prompts on the [Open Prompt Database](https://openpromptdatabase.com/) and add them to your library with one click. Share your own prompts from the **side panel**.

- Stable `opd:` ids — re-import updates the same prompt when the catalog entry changes
- Duplicate detection — already in your library? The site shows “Already in library”
- **Share to Open Prompt Database** publishes a prompt you choose (title, content, tags) under your publisher handle
- Sharing an imported community prompt publishes **your copy**, not the original catalog row
- Link from Settings → **Browse the community catalog**

### Settings & permissions

Unified settings in the **side panel** and on **assistant pages** (same storage keys): launcher mode, preferences, tag management, import/export, custom open shortcut, and a **permissions editor** for controlling which sites the extension can access.

Site access is **optional**. The extension does not require host permissions to install or update.

## Supported platforms

| ChatGPT | Claude | Google Gemini |
|---------|--------|---------------|
| NotebookLM | DeepSeek | Microsoft Copilot |
| GitHub Copilot | Grok | Poe |
| Kimi | Mistral Le Chat | OpenRouter |
| Perplexity | Qwen | Google AI Studio |
| OpenAI Playground | ChatLLM (Abacus) | LMArena |

Plus any site you configure as a **custom website**.

## Installation

1. Install from the [Chrome Web Store](https://chromewebstore.google.com/detail/open-prompt-manager/gmhaghdbihgenofhnmdbglbkbplolain)
2. On first run, pick a launcher (floating button, hot corner, or sidebar / shortcut)
3. Click an assistant to grant site access, open that site, and open the side panel

You can add or remove sites later from Settings → **Permissions**.

### Load from source (development)

1. Clone this repository
2. Open `chrome://extensions`, enable **Developer mode**
3. Click **Load unpacked** and select the `src/` folder

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| **⌘ + Shift + P** (Mac) / **Ctrl + M** (Win/Linux) | Open or close the in-page prompt panel |
| **↑ / ↓** | Navigate the prompt list |
| **Enter** | Select a prompt |
| **Esc** | Close the panel |

You can change the open/close shortcut in Settings → **Record shortcut**. The recorded combo is exact — `Ctrl+M` does not also match `Ctrl+Shift+M`.

## Testing

```bash
npm install
npm test
```

Tests use **Jest** (with optional **Puppeteer** helpers). See [TESTING.md](TESTING.md) for details.

## Privacy

- Your prompt library is stored **locally** in the browser (`chrome.storage.local`)
- Catalog **import** pulls a prompt you selected from the [Open Prompt Database](https://openpromptdatabase.com/) into your local library
- Catalog **share / upload** sends a prompt you choose (title, content, tags) to Open Prompt Database under your publisher handle. That only happens when you click **Share to Open Prompt Database**
- No analytics or tracking

## License

MIT

## Attributions

- **Hexodus** — bug reports and fixes
- **Abdallahheidar** — ideas, contributions, and teamwork
- **HideMaru** — extension icon ([Flaticon chatbot icons](https://www.flaticon.com/free-icons/chatbot))
