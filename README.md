# Open Prompt Manager

A lightweight, open-source Chrome extension for saving, organizing, and inserting prompts across AI chatbots — ChatGPT, Claude, Gemini, Grok, and [17+ more platforms](#supported-platforms).

**Current version:** 2.9 · [Chrome Web Store](https://chromewebstore.google.com/detail/open-prompt-manager/gmhaghdbihgenofhnmdbglbkbplolain) · [Open Prompt Database](https://open-prompt-database.jonathanbertholet.workers.dev/)

## Features

### Prompt library

- Save, edit, reorder, and delete prompts from the **side panel** or an **in-page panel** on assistant sites
- **Tags** with search and filter — synced between the side panel and in-page list; tag suggestions on create/edit forms
- Drag to reorder tags in Settings → **Tag management**
- **Variables** with `#variable#` syntax — fill in values before inserting
- **Import / export** full v2 backups (prompts, folders, tag order) as JSON
- **Copy to clipboard** from the side panel or context menu — handy on unsupported sites
- Save selected text to your library via the **context menu**

### On assistant sites

- **Floating button** or **hot corner** launcher (choose in Settings)
- One-click insert into the chat input, with optional append mode
- **Custom keyboard shortcut** — record your own open/close combo (default: ⌘⇧P on Mac, Ctrl+M on Windows/Linux)
- **Custom websites** — pin any site's chat input from the side panel
- Light and dark themes, with optional force-dark mode

### Open Prompt Database

Browse community prompts on the [Open Prompt Database](https://open-prompt-database.jonathanbertholet.workers.dev/) and add them to your library with one click.

- Stable `opd:` ids — re-import updates the same prompt when the catalog entry changes
- Duplicate detection — already in your library? The site shows “Already in library”
- Link from Settings → **Browse the community catalog**

### Settings & permissions

Unified settings in the **side panel** and on **assistant pages** (same storage keys): launcher mode, preferences, tag management, import/export, custom open shortcut, and a **permissions editor** for controlling which sites the extension can access.

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
2. Open the side panel and grant access to the assistants you use (Settings → Permissions editor)

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

You can change the open/close shortcut in Settings → **Record shortcut**.

## Testing

Automated tests use **Puppeteer** and **Jest**. See the [Testing Guide](TESTING.md) for setup and commands.

## Privacy

- Your prompt library is stored **locally** in the browser (`chrome.storage.local`)
- Nothing is sent to external servers unless **you** choose to import from the [Open Prompt Database](https://open-prompt-database.jonathanbertholet.workers.dev/) — that flow only pulls the prompt you selected into your local library
- No analytics or tracking

## License

MIT License — see [LICENSE](LICENSE) if present in the repository.

## Attributions

- **Hexodus** — bug reports and fixes
- **Abdallahheidar** — ideas, contributions, and teamwork
- **HideMaru** — extension icon ([Flaticon chatbot icons](https://www.flaticon.com/free-icons/chatbot))
