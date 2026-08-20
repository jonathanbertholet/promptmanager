import { exportPrompts, importPrompts } from './importExport.js';
import { getPrompts, setPrompts } from './storage/promptStorage.js';
import { getAllPinnedInputs, removePinnedForHostname } from './storage/pinnedInputStorage.js';
import { removeLearnedForHostname } from './storage/learnedInputStorage.js';
import {
  resolveProviderIconUrl,
  attachProviderIconFallback,
  getFaviconFallbackForUrl,
} from './utils/providerIcons.js';
import { expandOriginPatterns } from './utils/originPatterns.js';
import { mountSidepanelFooter } from './sidepanel/sidepanelFooter.js';

// COMMENT: Storage keys shared with the in-page panel and side panel
const DISPLAY_MODE_KEY = 'displayMode';
const DEFAULT_DISPLAY_MODE = 'standard';
const ALLOWED_DISPLAY_MODES = new Set(['standard', 'hotCorner', 'invisible']);
const KEYBOARD_SHORTCUT_KEY = 'keyboardShortcut';
const APPEND_MODE_KEY = 'disableOverwrite';
const ENABLE_TAGS_KEY = 'enableTags';
const FORCE_DARK_KEY = 'forceDarkMode';
const TAGS_ORDER_KEY = 'tagsOrder';

/** COMMENT: Default open-panel shortcut per platform (matches content.js KeyboardManager). */
function getDefaultKeyboardShortcut() {
  const isMac = navigator.platform.toUpperCase().includes('MAC');
  return {
    key: isMac ? 'p' : 'm',
    modifier: isMac ? 'metaKey' : 'ctrlKey',
    requiresShift: isMac,
  };
}

/** COMMENT: Human-readable label for a stored shortcut object. */
function formatKeyboardShortcut(shortcut) {
  const isMac = navigator.platform.toUpperCase().includes('MAC');
  const parts = [];
  if (shortcut.modifier === 'metaKey') parts.push(isMac ? '⌘' : 'Meta');
  else if (shortcut.modifier === 'ctrlKey') parts.push(isMac ? '⌃' : 'Ctrl');
  else if (shortcut.modifier === 'altKey') parts.push(isMac ? '⌥' : 'Alt');
  if (shortcut.requiresShift) parts.push(isMac ? '⇧' : 'Shift');
  parts.push(String(shortcut.key || '').toUpperCase());
  return parts.join(' + ');
}

function storageGet(keys) {
  return new Promise(resolve => chrome.storage.local.get(keys, resolve));
}

function storageSet(obj) {
  return new Promise(resolve => chrome.storage.local.set(obj, resolve));
}

function setImportExportStatus(message, isError = false) {
  const el = document.getElementById('import-export-status');
  if (!el) return;
  el.textContent = message || '';
  el.classList.toggle('settings-status-error', isError);
}

/**
 * COMMENT: Wire launcher mode radios on the dedicated settings page.
 */
function initDisplayModePicker() {
  const section = document.getElementById('display-mode-section');
  if (!section) return;

  const radios = section.querySelectorAll('input[name="displayMode"]');
  const options = section.querySelectorAll('.settings-mode-option');

  const updateSelectedUI = (mode) => {
    options.forEach((option) => {
      const radio = option.querySelector('input[type="radio"]');
      option.classList.toggle('is-selected', radio?.value === mode);
    });
  };

  chrome.storage.local.get([DISPLAY_MODE_KEY], (result) => {
    const storedMode = result[DISPLAY_MODE_KEY];
    const mode = ALLOWED_DISPLAY_MODES.has(storedMode) ? storedMode : DEFAULT_DISPLAY_MODE;
    radios.forEach((radio) => {
      radio.checked = radio.value === mode;
    });
    updateSelectedUI(mode);
  });

  radios.forEach((radio) => {
    radio.addEventListener('change', () => {
      if (!radio.checked || !ALLOWED_DISPLAY_MODES.has(radio.value)) return;
      chrome.storage.local.set({ [DISPLAY_MODE_KEY]: radio.value });
      updateSelectedUI(radio.value);
    });
  });
}

/** COMMENT: Sync checkbox toggles with chrome.storage.local preference keys. */
function initPreferenceToggles() {
  const appendToggle = document.getElementById('toggle-append-mode');
  const tagsToggle = document.getElementById('toggle-enable-tags');
  const darkToggle = document.getElementById('toggle-force-dark');
  if (!appendToggle || !tagsToggle || !darkToggle) return;

  storageGet([APPEND_MODE_KEY, ENABLE_TAGS_KEY, FORCE_DARK_KEY]).then((result) => {
    appendToggle.checked = !!result[APPEND_MODE_KEY];
    tagsToggle.checked = !!result[ENABLE_TAGS_KEY];
    darkToggle.checked = !!result[FORCE_DARK_KEY];
    updateTagManagementVisibility(tagsToggle.checked);
    // COMMENT: Render after toggles load — checkbox defaults are false before storage resolves
    renderTagManagement().catch(console.error);
  });

  appendToggle.addEventListener('change', () => {
    storageSet({ [APPEND_MODE_KEY]: appendToggle.checked });
  });

  tagsToggle.addEventListener('change', () => {
    storageSet({ [ENABLE_TAGS_KEY]: tagsToggle.checked });
    updateTagManagementVisibility(tagsToggle.checked);
    renderTagManagement().catch(console.error);
  });

  darkToggle.addEventListener('change', () => {
    storageSet({ [FORCE_DARK_KEY]: darkToggle.checked });
  });
}

function updateTagManagementVisibility(enabled) {
  const section = document.getElementById('tag-management-section');
  if (section) section.hidden = !enabled;
}

/** COMMENT: Load and display the current open-panel keyboard shortcut. */
async function refreshShortcutDisplay() {
  const display = document.getElementById('open-shortcut-display');
  if (!display) return;
  const stored = await storageGet([KEYBOARD_SHORTCUT_KEY]);
  const shortcut = stored[KEYBOARD_SHORTCUT_KEY] || getDefaultKeyboardShortcut();
  display.textContent = formatKeyboardShortcut(shortcut);
}

/** COMMENT: Capture the next keydown as the custom open-panel shortcut. */
function initKeyboardShortcutRecorder() {
  const recordBtn = document.getElementById('open-shortcut-record');
  const display = document.getElementById('open-shortcut-display');
  if (!recordBtn || !display) return;

  let recording = false;
  let handler = null;

  const stopRecording = () => {
    recording = false;
    recordBtn.textContent = 'Record shortcut';
    recordBtn.classList.remove('is-recording');
    if (handler) {
      document.removeEventListener('keydown', handler, true);
      handler = null;
    }
  };

  recordBtn.addEventListener('click', () => {
    if (recording) {
      stopRecording();
      return;
    }

    recording = true;
    recordBtn.textContent = 'Press keys… (Esc to cancel)';
    recordBtn.classList.add('is-recording');
    display.textContent = 'Listening…';

    handler = async (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (event.key === 'Escape') {
        stopRecording();
        await refreshShortcutDisplay();
        return;
      }

      // COMMENT: Ignore lone modifier keys — wait for a real key combo
      if (['Control', 'Meta', 'Alt', 'Shift'].includes(event.key)) return;

      let modifier = 'ctrlKey';
      if (event.metaKey) modifier = 'metaKey';
      else if (event.altKey) modifier = 'altKey';

      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key.toLowerCase();
      const shortcut = {
        modifier,
        requiresShift: event.shiftKey,
        key,
      };

      await storageSet({ [KEYBOARD_SHORTCUT_KEY]: shortcut });
      stopRecording();
      display.textContent = formatKeyboardShortcut(shortcut);
    };

    document.addEventListener('keydown', handler, true);
  });
}

/** COMMENT: Count tag usage across all prompts for management UI labels. */
function computeTagCounts(prompts = []) {
  const counts = new Map();
  prompts.forEach((prompt) => {
    (Array.isArray(prompt.tags) ? prompt.tags : []).forEach((tag) => {
      const key = String(tag).trim();
      if (!key) return;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
  });
  return counts;
}

/** COMMENT: Merge stored tag order with tags found on prompts. */
async function getOrderedTags(counts) {
  const stored = await storageGet([TAGS_ORDER_KEY]);
  const order = Array.isArray(stored[TAGS_ORDER_KEY]) ? stored[TAGS_ORDER_KEY] : [];
  const tags = Array.from(counts.keys());
  const missing = tags.filter(t => !order.includes(t)).sort((a, b) => a.localeCompare(b));
  return [...order.filter(t => counts.has(t)), ...missing];
}

// COMMENT: Shared drag state so one-time list listeners always target the latest render
let tagManagementDragReady = false;
let tagMgmtState = null;

/** COMMENT: Render draggable tag pills with remove actions (mirrors in-page tag management). */
async function renderTagManagement() {
  const listEl = document.getElementById('tag-management-list');
  const emptyEl = document.getElementById('tag-management-empty');
  if (!listEl || !emptyEl) return;

  const stored = await storageGet([ENABLE_TAGS_KEY]);
  const enabled = !!stored[ENABLE_TAGS_KEY];
  updateTagManagementVisibility(enabled);
  if (!enabled) {
    listEl.innerHTML = '';
    emptyEl.hidden = true;
    tagMgmtState = null;
    return;
  }

  const prompts = await getPrompts();
  let counts = computeTagCounts(prompts);
  let finalOrder = await getOrderedTags(counts);
  listEl.innerHTML = '';

  const hasTags = finalOrder.length > 0;
  emptyEl.hidden = hasTags;

  let dragFromIndex = null;

  const persistOrder = async () => {
    await storageSet({ [TAGS_ORDER_KEY]: finalOrder });
  };

  const render = () => {
    listEl.innerHTML = '';
    finalOrder.forEach((tag, idx) => {
      const count = counts.get(tag) || 0;
      const pill = document.createElement('div');
      pill.className = 'settings-tag-pill';
      pill.dataset.tag = tag;

      const handle = document.createElement('button');
      handle.type = 'button';
      handle.className = 'settings-tag-drag';
      handle.setAttribute('draggable', 'true');
      handle.setAttribute('aria-label', `Reorder tag ${tag}`);
      handle.innerHTML = `<img src="${chrome.runtime.getURL('icons/drag_indicator.svg')}" width="14" height="14" alt="">`;

      handle.addEventListener('dragstart', (event) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(idx));
        dragFromIndex = idx;
        if (tagMgmtState) tagMgmtState.dragFromIndex = idx;
        pill.classList.add('is-dragging');
      });
      handle.addEventListener('dragend', () => {
        dragFromIndex = null;
        if (tagMgmtState) tagMgmtState.dragFromIndex = null;
        pill.classList.remove('is-dragging');
      });

      const label = document.createElement('span');
      label.className = 'settings-tag-label';
      label.textContent = `${tag} (${count})`;

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'settings-tag-remove';
      removeBtn.setAttribute('aria-label', `Remove tag ${tag} from all prompts`);
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', async () => {
        if (!confirm(`Remove tag "${tag}" from all prompts?`)) return;
        const currentPrompts = await getPrompts();
        const nextPrompts = currentPrompts.map((prompt) => ({
          ...prompt,
          tags: Array.isArray(prompt.tags) ? prompt.tags.filter(t => t !== tag) : [],
        }));
        await setPrompts(nextPrompts);
        counts = computeTagCounts(nextPrompts);
        finalOrder = finalOrder.filter(t => t !== tag);
        if (tagMgmtState) {
          tagMgmtState.counts = counts;
          tagMgmtState.finalOrder = finalOrder;
        }
        await persistOrder();
        render();
        emptyEl.hidden = finalOrder.length > 0;
      });

      pill.append(handle, label, removeBtn);
      listEl.appendChild(pill);
    });
  };

  tagMgmtState = {
    counts,
    finalOrder,
    dragFromIndex,
    persistOrder,
    render,
  };

  if (!tagManagementDragReady) {
    tagManagementDragReady = true;
    listEl.addEventListener('dragover', (event) => {
      event.preventDefault();
      const state = tagMgmtState;
      if (!state) return;
      const target = event.target.closest('.settings-tag-pill');
      if (!target || state.dragFromIndex === null) return;
      const targetIndex = state.finalOrder.indexOf(target.dataset.tag);
      if (targetIndex === -1 || targetIndex === state.dragFromIndex) return;
      const moved = state.finalOrder.splice(state.dragFromIndex, 1)[0];
      state.finalOrder.splice(targetIndex, 0, moved);
      state.dragFromIndex = targetIndex;
      state.render();
    });

    listEl.addEventListener('drop', async (event) => {
      event.preventDefault();
      const state = tagMgmtState;
      if (!state) return;
      state.dragFromIndex = null;
      await state.persistOrder();
    });
  }

  render();
}

/**
 * COMMENT: Extract a hostname from a Chrome origin permission pattern.
 * @param {string} pattern
 * @returns {string|null}
 */
function patternToHostname(pattern) {
  if (!pattern || pattern === '<all_urls>') return null;
  const match = pattern.match(/^\*:\/\/([^/]+)\/\*$/);
  return match ? match[1] : null;
}

/**
 * COMMENT: Load provider metadata used to label granted website permissions.
 * @returns {Promise<{ providersMap: object, providersByPattern: Map<string, object> }>}
 */
async function loadProviderMetadata() {
  const stored = await new Promise(resolve => {
    chrome.storage.local.get(['aiProvidersMap'], resolve);
  });

  let providersMap = stored?.aiProvidersMap || {};
  const providersByPattern = new Map();

  Object.entries(providersMap).forEach(([name, info]) => {
    if (!info?.urlPattern) return;
    expandOriginPatterns(info.urlPattern).forEach((origin) => {
      providersByPattern.set(origin, { name, ...info, urlPattern: origin });
    });
  });

  if (providersByPattern.size === 0) {
    try {
      const response = await fetch(chrome.runtime.getURL('llm_providers.json'));
      const data = await response.json();
      const list = Array.isArray(data?.llm_providers) ? data.llm_providers : [];
      list.forEach((provider) => {
        if (!provider?.pattern) return;
        expandOriginPatterns(provider.pattern).forEach((origin) => {
          providersByPattern.set(origin, {
            name: provider.name,
            urlPattern: origin,
            url: provider.url,
            iconUrl: resolveProviderIconUrl(provider.icon_url, provider.url),
            hasPermission: 'No',
          });
        });
      });
    } catch (_) {
      // COMMENT: Fall back to storage-only metadata when JSON cannot be loaded
    }
  }

  return { providersMap, providersByPattern };
}

/**
 * COMMENT: Build display rows for currently granted optional host permissions.
 * @returns {Promise<Array<{ pattern: string, label: string, url: string, iconUrl: string }>>}
 */
async function getGrantedSiteEntries() {
  const permissions = await chrome.permissions.getAll();
  const origins = Array.isArray(permissions?.origins) ? permissions.origins : [];
  if (origins.length === 0) return [];

  const [{ providersByPattern }, pinned] = await Promise.all([
    loadProviderMetadata(),
    getAllPinnedInputs(),
  ]);

  return origins.map((pattern) => {
    if (pattern === '<all_urls>') {
      return {
        pattern,
        label: 'All websites',
        url: 'https://example.com',
        iconUrl: chrome.runtime.getURL('icons/language.svg'),
      };
    }

    const provider = providersByPattern.get(pattern);
    const hostname = patternToHostname(pattern);
    const pinnedEntry = hostname ? pinned[hostname] : null;

    if (provider) {
      return {
        pattern,
        label: provider.name,
        url: provider.url || `https://${hostname || 'example.com'}`,
        iconUrl: resolveProviderIconUrl(provider.iconUrl, provider.url),
      };
    }

    if (pinnedEntry && hostname) {
      return {
        pattern,
        label: pinnedEntry.label ? `${hostname} (${pinnedEntry.label})` : hostname,
        url: `https://${hostname}`,
        iconUrl: getFaviconFallbackForUrl(`https://${hostname}`),
      };
    }

    return {
      pattern,
      label: hostname || pattern,
      url: hostname ? `https://${hostname}` : 'https://example.com',
      iconUrl: getFaviconFallbackForUrl(hostname ? `https://${hostname}` : undefined),
    };
  }).sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * COMMENT: Mark one provider entry as revoked in storage after Chrome removes the origin.
 * @param {object} providersMap
 * @param {string} pattern
 * @returns {object}
 */
function markProviderRevoked(providersMap, pattern) {
  const updated = { ...providersMap };
  Object.entries(updated).forEach(([name, info]) => {
    if (info?.urlPattern === pattern || expandOriginPatterns(info?.urlPattern).includes(pattern)) {
      updated[name] = { ...info, hasPermission: 'No' };
    }
  });
  return updated;
}

/**
 * COMMENT: Persist provider permission state after revoking one or more origins.
 * @param {string[]} patterns
 */
async function syncStorageAfterRevoke(patterns) {
  const stored = await new Promise(resolve => {
    chrome.storage.local.get(['aiProvidersMap'], resolve);
  });
  let providersMap = stored?.aiProvidersMap || {};

  patterns.forEach((pattern) => {
    providersMap = markProviderRevoked(providersMap, pattern);
    const hostname = patternToHostname(pattern);
    if (hostname) {
      removePinnedForHostname(hostname).catch(() => {});
      removeLearnedForHostname(hostname).catch(() => {});
    }
  });

  await new Promise(resolve => {
    chrome.storage.local.set({ aiProvidersMap: providersMap }, resolve);
  });
}

/**
 * COMMENT: Render granted website permissions with per-site remove actions.
 */
async function renderWebsitePermissions() {
  const listEl = document.getElementById('permissions-list');
  const emptyEl = document.getElementById('permissions-empty');
  if (!listEl || !emptyEl) return;

  const entries = await getGrantedSiteEntries();
  listEl.innerHTML = '';

  const hasEntries = entries.length > 0;
  emptyEl.hidden = hasEntries;

  entries.forEach((entry) => {
    const item = document.createElement('li');
    item.className = 'settings-permission-item';

    const icon = document.createElement('img');
    icon.className = 'settings-permission-icon';
    icon.src = entry.iconUrl;
    icon.alt = '';
    icon.width = 24;
    icon.height = 24;
    attachProviderIconFallback(icon, entry.url);

    const label = document.createElement('span');
    label.className = 'settings-permission-label';
    label.textContent = entry.label;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'settings-permission-remove';
    removeBtn.setAttribute('aria-label', `Remove access to ${entry.label}`);
    removeBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12l-4.89 4.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.89a1 1 0 0 0 1.41-1.41L13.41 12l4.89-4.89a1 1 0 0 0 0-1.4z"/></svg>';
    removeBtn.addEventListener('click', async () => {
      const confirmed = confirm(`Remove access to ${entry.label}?`);
      if (!confirmed) return;

      await new Promise(resolve => {
        chrome.permissions.remove({ origins: [entry.pattern] }, resolve);
      });
      await syncStorageAfterRevoke([entry.pattern]);
      await renderWebsitePermissions();
    });

    item.append(icon, label, removeBtn);
    listEl.appendChild(item);
  });
}

/** COMMENT: Wire website permission removal controls on the settings page. */
function initWebsitePermissions() {
  renderWebsitePermissions().catch(console.error);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.aiProvidersMap || changes.pinned_inputs_v1) {
      renderWebsitePermissions().catch(console.error);
    }
    if (changes.prompts_storage || changes.prompts || changes.tagsOrder || changes.enableTags) {
      renderTagManagement().catch(console.error);
    }
  });
}

async function deleteAllPrompts() {
  if (confirm('Are you sure you want to delete all prompts? This action cannot be undone.')) {
    await setPrompts([]);
    setImportExportStatus('All prompts deleted.');
    renderTagManagement().catch(console.error);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const shell = document.querySelector('.settings-page-shell');
  mountSidepanelFooter({ active: 'settings', root: shell || document.body });

  initDisplayModePicker();
  initPreferenceToggles();
  initKeyboardShortcutRecorder();
  initWebsitePermissions();
  refreshShortcutDisplay().catch(console.error);

  const exportButton = document.getElementById('export-btn');
  if (exportButton) {
    exportButton.addEventListener('click', async () => {
      try {
        await exportPrompts();
        setImportExportStatus('Export started — check your downloads folder.');
      } catch (err) {
        console.error(err);
        setImportExportStatus('Export failed.', true);
      }
    });
  }

  const importButton = document.getElementById('import-btn');
  const importFile = document.getElementById('import-file');
  if (importButton && importFile) {
    importButton.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      importFile.value = '';
      if (!file) return;
      try {
        await importPrompts(file);
        setImportExportStatus('Import successful — prompts merged.');
        renderTagManagement().catch(console.error);
      } catch (err) {
        console.error(err);
        setImportExportStatus(err?.message || 'Import failed — invalid JSON file.', true);
      }
    });
  }

  const deleteAllButton = document.getElementById('delete-all-prompts');
  if (deleteAllButton) {
    deleteAllButton.addEventListener('click', () => {
      deleteAllPrompts().catch(console.error);
    });
  }
});
