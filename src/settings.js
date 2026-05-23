import { exportPrompts, importPrompts } from './importExport.js';
import { setPrompts } from './storage/promptStorage.js';
import { getAllPinnedInputs, removePinnedForHostname } from './storage/pinnedInputStorage.js';
import {
  resolveProviderIconUrl,
  attachProviderIconFallback,
  getFaviconFallbackForUrl,
} from './utils/providerIcons.js';

// COMMENT: Storage key shared with the install page and content-script launcher preference
const DISPLAY_MODE_KEY = 'displayMode';
const DEFAULT_DISPLAY_MODE = 'standard';
const ALLOWED_DISPLAY_MODES = new Set(['standard', 'hotCorner']);

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
    if (info?.urlPattern) {
      providersByPattern.set(info.urlPattern, { name, ...info });
    }
  });

  if (providersByPattern.size === 0) {
    try {
      const response = await fetch(chrome.runtime.getURL('llm_providers.json'));
      const data = await response.json();
      const list = Array.isArray(data?.llm_providers) ? data.llm_providers : [];
      list.forEach((provider) => {
        if (!provider?.pattern) return;
        providersByPattern.set(provider.pattern, {
          name: provider.name,
          urlPattern: provider.pattern,
          url: provider.url,
          iconUrl: resolveProviderIconUrl(provider.icon_url, provider.url),
          hasPermission: 'No',
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
    if (info?.urlPattern === pattern) {
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

/**
 * COMMENT: Wire website permission removal controls on the settings page.
 */
function initWebsitePermissions() {
  renderWebsitePermissions().catch(console.error);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.aiProvidersMap || changes.pinned_inputs_v1) {
      renderWebsitePermissions().catch(console.error);
    }
  });
}

// COMMENT: Guard optional controls — settings.html may not include every legacy button id
document.addEventListener('DOMContentLoaded', () => {
  initDisplayModePicker();
  initWebsitePermissions();

  const exportButton = document.getElementById('export-btn');
  if (exportButton) {
    exportButton.addEventListener('click', () => {
      exportPrompts();
    });
  }

  const importButton = document.getElementById('import-btn');
  const importFile = document.getElementById('import-file');
  if (importButton && importFile) {
    importButton.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      if (file) importPrompts(file);
    });
  }

  const exportSyncButton = document.getElementById('export-sync-prompts');
  if (exportSyncButton) {
    exportSyncButton.addEventListener('click', () => {
      exportPrompts();
    });
  }

  const deleteAllButton = document.getElementById('delete-all-prompts');
  if (deleteAllButton) {
    deleteAllButton.addEventListener('click', deleteAllPrompts);
  }
});

async function deleteAllPrompts() {
  // COMMENT: Use unified prompt storage to clear all prompts (canonical + legacy mirrored)
  if (confirm('Are you sure you want to delete all prompts? This action cannot be undone.')) {
    await setPrompts([]);
    alert('All prompts have been deleted');
  }
}
