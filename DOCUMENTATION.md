## Open Prompt Manager — Architecture and Developer Guide (v3.0.6)

This document explains how the Chrome extension in `src` is structured and how the main flows work.

- Target: Chrome MV3
- Core features: side-panel prompt library, in-page launcher (button / hot-corner / invisible), insert into chat composers, `#variable#` fill-in, optional Open Prompt Database catalog, per-site optional host permissions.

### Directory overview
- `src/manifest.json`: MV3 manifest (side panel, optional host permissions, no static `content_scripts`).
- `src/service-worker.js`: permissions, registered content scripts, insert/pin messaging, context menu.
- `src/content.boot.js`: sets the injection lock before the rest of the bundle runs.
- `src/content.styles.js`: theme tokens, selectors, injected CSS.
- `src/content.shared.js`: TagService, TagUI, PromptUI helpers.
- `src/content.js`: in-page UI, router, keyboard, mediator, insert message listener.
- `src/handlers/inputBoxHandler.js`: composer detection and insert for textarea / contenteditable / Lexical / ProseMirror / Quill.
- `src/utils/promptInsertUtils.js`: duplicate-collapse helpers shared with tests.
- `src/storage/promptStorage.js`: versioned prompts + folders + tags. Dynamic-imported by content scripts.
- `src/storage/pinnedInputStorage.js` / `learnedInputStorage.js`: per-host composer pins and learned selectors.
- `src/llm_providers.json` + `src/llm_providers.js`: assistant registry (origins, icons, selectors).
- `src/sidepanel/*`: side panel library, composer, Assistants, insert-into-active-tab.
- `src/permissions/*`: first-run onboarding and per-assistant grant.
- `src/opd/*`: Open Prompt Database import / publish / catalog bridge.
- `src/changelog.html`: in-page changelog view.

## Manifest and injection

Host access is **optional**. `optional_host_permissions` includes `<all_urls>` plus catalog origins. There is no `content_scripts` key; scripts are registered at runtime for granted origins.

Injection path:

1. On permission grant / worker start, `chrome.scripting.registerContentScripts` registers the bundle (`content.boot.js` → `promptInsertUtils.js` → `inputBoxHandler.js` → `content.styles.js` → `content.shared.js` → `content.js`) for granted http(s) origins, excluding the catalog site.
2. New navigations then get the bundle at `document_idle` without waking the service worker on every tab.
3. Existing tabs (already open when the extension was installed or when access was granted) are injected with `chrome.scripting.executeScript`. Chrome often **cannot** script those tabs until they reload — insert/pin will reload that tab once and retry.
4. `__openPromptManagerInjected` means injection is in progress. `__OPM_CONTENT_READY__` means the insert listener is registered. The worker waits for ready; it does not treat the lock as success.

`web_accessible_resources` lists storage/utils files so content scripts can `import(chrome.runtime.getURL(...))`.

## Side-panel insert

Clicking a prompt in the side panel sends `OPM_INSERT_PROMPT` to the worker with the active tab from `currentWindow` (the window the side panel is attached to).

The worker activates the tab, ensures the content script is present (reload fallback for preexisting tabs), then sends `OPM_INSERT_PROMPT_CONTENT`. The content script waits up to 8s for a composer. Insert is verified by whether the prompt text is in the field (overwrite of the same prompt counts as success). A failed write is `insert_failed`, not a silent success.

Known assistants that have no composer yet get a toast with an optional **Pick field** action. Custom sites still open the pin picker on `no_input`.

Right-clicking a saved prompt in the page context menu inserts it into that tab (same path), it does not copy to the clipboard.

## Provider registry

`llm_providers.json` entries have `name`, `pattern` (comma-separated Chrome match patterns), `url`, `icon_url`, and `element_selector`.

ChatGPT includes `chatgpt.com` and `chat.openai.com`. Grok includes `grok.com`, `x.com/i/grok`, and `twitter.com` grok paths. Perplexity lists both `www.perplexity.ai` and `perplexity.ai`.

To add a provider: add a JSON entry (origins are covered by optional `<all_urls>`), and extend `inputBoxHandler.js` selectors if the composer is unusual.

## Content script application

- `PromptUIManager` mounts the in-page launcher. While the side panel is open, that launcher is removed and the page mutation observer is disconnected.
- `PromptMediator` wires list clicks and `OPM_INSERT_PROMPT_CONTENT` to `InputBoxHandler.insertPrompt`.
- Variables use `#name#`. The side panel and in-page panel both collect values before insert.
- Display modes: `standard` (floating button), `hotCorner` (default on install), `invisible` (keyboard / side panel only).

## Site input detection (`inputBoxHandler.js`)

Detection order: user pin → learned selector → provider `element_selector` → heuristics (including Gemini shadow DOM).

Rich editors use `beforeinput` / `execCommand('insertText')` and skip synthetic paste on ChatGPT / Perplexity (those hosts turn paste into a quote card). Perplexity's Lexical `#ask-input` ignores untrusted `beforeinput` and commits `execCommand` asynchronously, so the insert path writes once, waits for the text to appear before retrying, and collapses 3+ copies. ChatGPT multiline prompts use one `insertHTML` transaction so line breaks are not flattened. Textareas set `value` and dispatch `input` / `change`. Append vs overwrite is `disableOverwrite` in `chrome.storage.local`.

## Storage (`storage/promptStorage.js`)

Canonical key `prompts_storage`, schema v2: `{ version, prompts, folders }`. Prompt shape: `{ uuid, title, content, tags, folderId, createdAt, updatedAt? }` plus optional OPD metadata. Legacy `prompts` array is mirrored and migrated.

## Permissions and onboarding

First install opens `permissions/permissions.html`. Clicking an assistant requests its origins on that click (required for `sidePanel.open` + `permissions.request` user-gesture rules), then the worker opens the assistant URL and the side panel.

`aiProvidersMap` in `chrome.storage.local` drives Assistants pills in the side panel.

## Extending

- New assistant: `llm_providers.json` + selectors in `inputBoxHandler.js` if needed.
- New editor type: detection in `getInputBox()`, write path in `insertPrompt`.
- Storage changes: bump `PROMPT_STORAGE_VERSION` and migrate in `readRawStorage`.
