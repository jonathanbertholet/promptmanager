## Open Prompt Manager — Architecture and Developer Guide (v2.4.0)

This document explains how the Chrome extension in `src` is structured, how it works end-to-end, and where major logic lives. It covers background/service worker orchestration, content scripts and UI layers, storage/versioning, permissions onboarding, the side panel app, and provider integration.

- Target: Chrome MV3
- Core features: floating prompt manager UI (button or hot-corner), prompt storage with tags/folders, variable replacement, keyboard shortcuts, side panel prompt editor, right-click context menu, per-site permissions.

### Directory overview
- `src/manifest.json`: Extension manifest (MV3).
- `src/service-worker.js`: Background logic; script injection; permissions and context menu.
- `src/content.styles.js`: Global theme variables and injected CSS; exposes `injectGlobalStyles` and constants.
- `src/content.js`: Content script app: UI system, router, keyboard, mediator, dynamic storage import, variable workflow.
- `src/inputBoxHandler.js`: Detects and writes to site-specific input boxes; handles contentEditable and `textarea` editors.
- `src/promptStorage.js`: Unified, versioned storage API (v2: prompts + folders + tags). Dynamic-imported by content.
- `src/llm_providers.json` + `src/llm_providers.js`: Provider registry and loader; used for origin permissions and injection.
- `src/sidepanel/*`: Side panel UI (forms/list, import/export, permissions gate, responsive styles).
- `src/permissions/*`: Permissions manager UI; requests optional origins; writes `aiProvidersMap`.
- `src/info.html` and `src/changelog.html`: In-panel content fetched by content script.
- `src/importExport.js` + `src/utils.js`: Import/export bridge; UUID helper.
- `src/icons/*`: Visual assets referenced across the UI.

## Manifest and lifecycle

### Manifest essentials
The extension uses MV3, a side panel, and an ES-module service worker. Optional host permissions gate injection to supported sites.

{
    "manifest_version": 3,
    "name": "Open Prompt Manager",
    "version": "2.4.0",
    "permissions": ["sidePanel","storage","tabs","scripting","activeTab","contextMenus"],
    "side_panel": { "default_path": "sidepanel/index.html" },
    "background": { "service_worker": "service-worker.js", "type": "module" },
    // Icons and action omitted
}
```

- **optional_host_permissions**: Wildcard origins for supported LLMs (ChatGPT, Claude, Gemini, etc.). Each origin must be explicitly granted by the user.
- **web_accessible_resources**: Makes specific files importable/fetchable by content scripts (e.g., `promptStorage.js`, `info.html`).

### Background service worker
The service worker coordinates permissions, content-script injection, and context menus.

```121:160:/src/service-worker.js
async function checkProviderPermissions() {
  // Loads llm_providers.json and checks chrome.permissions.contains for each pattern
  // Stores: { aiProvidersMap: { [providerName]: { hasPermission: 'Yes'|'No', urlPattern, url, iconUrl } } }
}
```

```55:94:/src/service-worker.js
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const { patternsArray } = await getProviders();
    for (const originPattern of patternsArray) {
      const hasPermission = await chrome.permissions.contains({ origins: [originPattern] });
      // Convert * wildcards to a simple regex to match URLs
      const urlRegex = new RegExp('^' + originPattern.replace(/\\/g,'\\\\').replace(/[.]/g,'\\.').replace(/[*]/g,'.*'));
      if (hasPermission && urlRegex.test(tab.url)) {
        await chrome.scripting.executeScript({ target: { tabId }, files: [
          'inputBoxHandler.js','content.styles.js','content.js'
        ]});
        break; // stop after the first match
      }
    }
  }
});
```

- On install, it opens the permissions page and precomputes `aiProvidersMap` from `llm_providers.json`.
- On permissions added, it injects all required scripts into any tabs matching the newly granted origin.
- On tab complete, it injects scripts if the tab’s URL matches any permitted provider pattern.
- It also creates and maintains a dynamic context menu for copying any saved prompt:

```168:235://src/service-worker.js
async function createPromptContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'open-prompt-manager', title: 'Open Prompt Manager', contexts: ['all'] });
    getAllPrompts().then(prompts => prompts.forEach((prompt, idx) => {
      chrome.contextMenus.create({ id: 'prompt-' + idx, parentId: 'open-prompt-manager', title: prompt.title || `Prompt ${idx+1}`, contexts: ['all'] });
    }));
  });
}
```

## Provider registry and permissions

- `llm_providers.json` lists supported providers with `name`, `pattern` (origin wildcard), `url`, and `icon_url`.
- `llm_providers.js:getProviders()` fetches JSON at runtime and returns both a name→pattern map and a flat pattern list for matching.

```1:20:/src/llm_providers.js
export async function getProviders() {
  const data = await (await fetch(chrome.runtime.getURL('llm_providers.json'))).json();
  const patternsObject = data.llm_providers.reduce((acc, item) => (acc[item.name] = item.pattern, acc), {});
  const patternsArray = data.llm_providers.map(item => item.pattern);
  return { patternsObject, patternsArray };
}
```

Tip: To add a new provider, add an entry to `llm_providers.json`, add its origin to `optional_host_permissions`, and update `inputBoxHandler.js` selectors if needed.

## Content script application

The content application is split into a small style/bootstrap module and a large UI/runtime module.

### Global styles and constants (`content.styles.js`)
- Defines theme variables, selectors, UI dimensions, and provides `injectGlobalStyles()`.
- Exposes constants on `window` for other injected files to reuse without re-imports.

```56:64:/src/content.styles.js
var injectGlobalStyles = window.injectGlobalStyles || function injectGlobalStyles() {
  const styleEl = document.createElement('style');
  styleEl.textContent = `/* CSS omitted */`;
  document.head.appendChild(styleEl);
};
```

### Main UI, routing, storage, keyboard (`content.js`)
Key subsystems:
- Utilities: `createEl`, `debounce`; theme helpers `getMode`, `Theme.applyAll`.
- Router: `PanelView` + `PanelRouter.mount(view)` for LIST/CREATE/EDIT/SETTINGS/HELP/CHANGELOG.
- Outside-click handler and `KeyboardManager` for open/close and navigation.
- Storage facade: `PromptStorageManager` (dynamic-imports `promptStorage.js` via `chrome.runtime.getURL`).
- Tags: `TagService` (counts/order/suggestions) and `TagUI` (pills + suggestions input).
- UI system: `PromptUI` (State, Elements, Views, Behaviors, Events) and `PromptUIManager` (public UI API).
- Variable flow: `PromptProcessor` + `PromptMediator` glue UI to site input boxes.

Bootstrap happens with a small delay to ensure DOM readiness:

```2115:2116:/src/content.js
setTimeout(() => { new PromptMediator(PromptUIManager, PromptProcessor); }, 50);
```

Dynamic import of the unified storage inside the content script keeps one source of truth and avoids code duplication:

```430:438:/src/content.js
const mod = await import(chrome.runtime.getURL('promptStorage.js'));
this.__ps = { getPrompts: mod.getPrompts, setPrompts: mod.setPrompts, /* others omitted */ };
```

Variable extraction and replacement use `#variable_name#` markers:

```2022:2030:/src/content.js
class PromptProcessor {
  static extractVariables(content) { return [...new Set([...content.matchAll(/#([a-zA-Z0-9_]+)#/g)].map(m => m[1]))]; }
  static replaceVariables(content, values) { return Object.entries(values)
    .reduce((res, [k, v]) => res.replace(new RegExp(`#${k}#`, 'g'), v), content); }
}
```

UI injection supports two modes:
- Standard: a draggable circular button opens the panel.
- Hot-corner: hover over bottom-right to open. Both use the same panel and views.

Keyboard shortcuts (default): macOS `⌘ + ⇧ + P`, Windows/Linux `Ctrl + M`. Press `Esc` to close; arrow keys navigate items.

## Site input detection and insertion (`inputBoxHandler.js`)

`InputBoxHandler` unifies detection and writing across many sites. It supports contentEditable editors (including Lexical/Perplexity) and plain `textarea`s. It respects the “Append prompts to text” setting (`disableOverwrite`).

```276:299:/src/inputBoxHandler.js
// Read append/overwrite preference from storage, default overwrite
const disableOverwrite = await new Promise(resolve => {
  chrome.storage.local.get('disableOverwrite', data => resolve(Boolean(data?.disableOverwrite)));
});
```

For Lexical editors, it uses `execCommand('insertText')` with fallbacks and keeps the caret at the end. For `textarea`s, it writes `value` and re-dispatches `input`/`change` events to ensure the app detects changes.

```445:456:/src/inputBoxHandler.js
} else if (inputBox.tagName.toLowerCase() === 'textarea') {
  if (disableOverwrite) { inputBox.value = (inputBox.value || '') + (/(\s)$/.test(inputBox.value)?'':' ') + content + '  '; }
  else { inputBox.value = content + '  '; }
  inputBox.dispatchEvent(new Event('input', { bubbles: true }));
  inputBox.dispatchEvent(new Event('change', { bubbles: true }));
}
```

## Unified storage (versioned) — `promptStorage.js`

Storage is centralized, versioned (v2), and mirrored for legacy compatibility. Schema:
- Store object: `{ version, prompts: Prompt[], folders: Folder[] }`
- Prompt: `{ uuid, title, content, tags: string[], folderId: string|null, createdAt, updatedAt? }`
- Folder: `{ id, name, parentId: string|null, createdAt, updatedAt? }`

```15:23:/src/promptStorage.js
export const PROMPT_STORAGE_VERSION = 2;
const STORAGE_KEY = 'prompts_storage';
const LEGACY_KEY  = 'prompts'; // mirrored for old code paths
```

Key APIs (Promise-based):
- `getPrompts()`, `setPrompts(prompts)`
- `savePrompt({ title, content, tags, folderId })`, `updatePrompt(uuid, partial)`, `deletePrompt(uuid)`
- `mergePrompts(importedArray)` (by `uuid` + timestamp freshness)
- Folders: `getFolders()`, `saveFolder()`, `updateFolder()`, `deleteFolder()`, `movePromptToFolder()`
- Tags: `addTagToPrompt()`, `removeTagFromPrompt()`, `setTagsForPrompt()`
- Import/export helpers and `onPromptsChanged(callback)`

```168:186:/src/promptStorage.js
export async function mergePrompts(imported) {
  // Merge by uuid keeping the newer updatedAt/createdAt
}
```

Notes:
- Content scripts import this module dynamically using `chrome.runtime.getURL`, so it must be listed in `web_accessible_resources`.
- Legacy array-only storage is migrated forward automatically.

## Side panel application (`sidepanel/*`)

The side panel is a small app for managing prompts. It lists prompts, supports add/update/delete, and offers import/export. It also shows a “Permissions Manager” shortcut when no providers are granted.

```26:46:/src/sidepanel/sidepanel.js
async function renderPermissionsGate() {
  const allowed = await hasAnyGrantedProviderPermission();
  // Show a shortcut to permissions manager if no providers are granted yet
}
```

- Live updates: listens to both prompt storage changes and `aiProvidersMap` changes to refresh UI automatically.
- The info banner can be toggled via a storage flag and is dismissible.
- Footer links to GitHub, Chrome Web Store, and a dedicated permissions page.

## Permissions Manager (`permissions/*`)

Allows per-provider origin permissions management using MV3 optional host permissions.

```116:135:/src/permissions/permissions.js
const element = document.getElementById(`perm-${key}`);
const handleProviderClick = function (event) {
  event.preventDefault();
  const originPattern = this.dataset.urlPattern;
  chrome.permissions.request({ origins: [originPattern] }, (granted) => {
    if (granted) {
      providersMap[providerKey].hasPermission = "Yes";
      chrome.storage.local.set({ aiProvidersMap: providersMap }); // triggers UI refresh
    }
  });
};
```

- The page reads `aiProvidersMap` (written by the service worker on install) and builds two lists: Allowed vs Available.
- On first granted provider, it renders a “Get Started” button linking to the provider URL.

## Theming and UI system

- `content.styles.js` injects all CSS into the page under a single root (`#opm-root`), with light/dark variants.
- The content UI and side panel share a consistent color system.
- Icons are tinted via theme-aware CSS filters.

## Keyboard, hot-corner, and onboarding

- Global shortcut toggles the list: macOS `⌘ + ⇧ + P`, Windows/Linux `Ctrl + M`. Escape closes; arrows navigate.
- Two display modes:
  - `standard`: draggable button + anchored panel.
  - `hotCorner`: hover bottom-right to reveal the panel; indicator animates.
- Onboarding popup (“Hover to Start”) is shown until first use and then auto-dismissed/persisted.

## Context menu and clipboard

- The service worker creates a context menu with one entry per prompt; clicking copies the prompt to clipboard and optionally shows a notification.
- Clipboard fallback uses `scripting.executeScript` injection if the direct clipboard API fails.

## Data and versioning

- Data lives in `chrome.storage.local` under a canonical store object and a legacy mirror.
- Upgrades are performed in-place when schema version changes.
- Import/export preserves `uuid` and merges by freshness to prevent duplicates.

## Extending the extension

- Add a provider: update `llm_providers.json`, manifest `optional_host_permissions`, and `inputBoxHandler.js` selectors if needed.
- Add a new site editor: implement detection in `InputBoxHandler.getInputBox()` and adjust insertion logic if it’s a special editor.
- Extend storage: bump `PROMPT_STORAGE_VERSION`, update normalizers, perform safe migration.
- Add UI features: use `PromptUIManager` to inject/refresh without assuming a specific site structure.

## Notable details and small caveats

- The background injection path checks URL patterns and permissions but does not strictly guard against double-injection in all edge cases. The code attempts a small “probe” via `executeScript(func: ...)` first; consider a stronger idempotence guard if needed.
- `settings.js` references `exportSyncPrompts()` which doesn’t exist in `importExport.js`. The main import/export controls live in the content UI settings and side panel. Consider removing or aligning this page to the unified import/export functions.
- `llm_providers.json` contains two entries named “Google AI Studio”; harmless but could be deduplicated by name if you plan to render unique-name lists elsewhere.

## File-by-file quick map

- `manifest.json`: MV3 config, side panel, optional origins, WARs.
- `service-worker.js`: install/onboarding, permissions scan and updates, script injection, context menus.
- `content.styles.js`: theme tokens, selectors, panel and list CSS, exported `injectGlobalStyles`.
- `content.js`: UI framework, router, keyboard, tag system, manager, mediator, variable form.
- `inputBoxHandler.js`: robust site detection, insertion for contentEditable and `textarea`, append vs overwrite.
- `promptStorage.js`: versioned store, normalize/migrate, CRUD, tags, folders, import/export, change events.
- `llm_providers.json` / `llm_providers.js`: provider registry and runtime loader.
- `sidepanel/index.html|sidepanel.js|styles.css`: standalone prompt manager panel.
- `permissions/permissions.html|permissions.js|permissions_custom.css`: permissions management UI.
- `importExport.js`: thin bridge to `promptStorage` import/export.
- `utils.js`: `generateUUID` helper.
- `info.html`, `changelog.html`: fetched into the content panel Views (HELP/CHANGELOG).

---

### Key flows (at a glance)
- Install: open permissions page → compute and store `aiProvidersMap` → side panel enabled by action.
- Permissions added: update storage → inject scripts into matching tabs.
- Tab complete: if URL matches a granted provider → inject `inputBoxHandler.js`, `content.styles.js`, `content.js`.
- Content bootstrap: inject global CSS → build UI → attach keyboard + observers → dynamic-import storage → render list or creation form.
- Selecting a prompt: detect site input → if variables present, show variable form → replace placeholders → insert into site input.
- Storage changes: list refreshes only when list view is active (avoids disrupting edit/settings views).

If you need a deeper dive into any module, see the code references above for starting points in the respective files.
