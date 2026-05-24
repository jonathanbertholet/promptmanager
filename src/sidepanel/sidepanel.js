// sidepanel.js

// COMMENT: Use unified prompt storage for all prompt operations
import * as PromptStorage from '../storage/promptStorage.js';
import { getPinnedForHostname, getAllPinnedInputs } from '../storage/pinnedInputStorage.js';
import {
  resolveProviderIconUrl,
  attachProviderIconFallback,
  getFaviconFallbackForUrl,
} from '../utils/providerIcons.js';

// COMMENT: Debounce rapid tab events so switching tabs does not rebuild the whole Assistants section
function debounceSidepanel(fn, wait = 250) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(null, args), wait);
  };
}

let llmsSectionRenderInFlight = null;
let cachedProvidersMap = null;

/**
 * COMMENT: Update only the custom-website button when the active tab changes.
 */
async function refreshActiveTabAssistantsUI() {
  const customWebsiteBtn = document.getElementById('custom-website-btn');
  await refreshCustomWebsiteButton(customWebsiteBtn);
}

const scheduleActiveTabAssistantsRefresh = debounceSidepanel(refreshActiveTabAssistantsUI, 250);

/**
 * COMMENT: Get the currently focused browser tab for pin/status actions.
 * @returns {Promise<chrome.tabs.Tab|null>}
 */
async function getActiveBrowserTab() {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tabs[0] || null;
}

/**
 * COMMENT: Ask the service worker to run a pin-input action in the active tab.
 * @param {'start'|'clear'|'status'} action
 * @returns {Promise<object>}
 */
function sendPinInputAction(action) {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ type: 'OPM_PIN_INPUT', action }, response => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(response || { ok: false, error: 'empty_response' });
    });
  });
}

/**
 * COMMENT: Request host permission for the active tab when pinning on a new site.
 * @param {string} url
 * @returns {Promise<boolean>}
 */
async function requestPermissionForUrl(url) {
  try {
    const { hostname } = new URL(url);
    const pattern = `*://${hostname}/*`;
    return await new Promise(resolve => {
      chrome.permissions.request({ origins: [pattern] }, granted => resolve(Boolean(granted)));
    });
  } catch (_) {
    return false;
  }
}

/**
 * COMMENT: Update the Assistants custom-website button for the active tab.
 * @param {HTMLButtonElement|null} customWebsiteBtn
 */
async function refreshCustomWebsiteButton(customWebsiteBtn) {
  if (!customWebsiteBtn) return;

  const tab = await getActiveBrowserTab();
  if (!tab?.url || !/^https?:/i.test(tab.url)) {
    customWebsiteBtn.disabled = true;
    customWebsiteBtn.classList.remove('is-pinned');
    customWebsiteBtn.setAttribute('aria-pressed', 'false');
    customWebsiteBtn.title = 'Open a website tab, then click to pick its input field';
    return;
  }

  customWebsiteBtn.disabled = false;
  let hostname = '';
  try {
    hostname = new URL(tab.url).hostname;
  } catch (_) {
    hostname = '';
  }

  const stored = hostname ? await getPinnedForHostname(hostname) : null;
  const pinned = Boolean(stored);

  customWebsiteBtn.classList.toggle('is-pinned', pinned);
  customWebsiteBtn.setAttribute('aria-pressed', pinned ? 'true' : 'false');
  customWebsiteBtn.title = pinned
    ? `Unpin custom input on ${hostname}${stored?.label ? ` (${stored.label})` : ''}`
    : `Pick the input field on ${hostname}`;
}

/**
 * COMMENT: Start input picker mode or unpin the active custom website.
 * @param {HTMLButtonElement} customWebsiteBtn
 */
async function handleCustomWebsiteAction(customWebsiteBtn) {
  const tab = await getActiveBrowserTab();
  if (!tab?.url || !/^https?:/i.test(tab.url)) return;

  let hostname = '';
  try {
    hostname = new URL(tab.url).hostname;
  } catch (_) {
    return;
  }

  const currentlyPinned = Boolean(await getPinnedForHostname(hostname));
  if (currentlyPinned) {
    const result = await sendPinInputAction('clear');
    if (!result?.ok) {
      window.alert(result?.error || 'Could not unpin this custom website.');
      return;
    }
    await refreshCustomWebsiteButton(customWebsiteBtn);
    await renderLLMsSection();
    return;
  }

  let result = await sendPinInputAction('start');
  if (result?.error === 'no_permission') {
    const granted = await requestPermissionForUrl(tab.url);
    if (!granted) {
      window.alert('Allow site access for this page to pick its input field.');
      return;
    }
    result = await sendPinInputAction('start');
  }

  if (!result?.ok && result?.error !== 'picker_already_active') {
    window.alert(result?.error || 'Could not start input picker on this page.');
    return;
  }

  await refreshCustomWebsiteButton(customWebsiteBtn);
}

/**
 * COMMENT: Build a pill for a user-pinned custom website hostname.
 * @param {string} hostname
 * @returns {HTMLAnchorElement}
 */
function createCustomSitePill(hostname) {
  const link = document.createElement('a');
  link.className = 'llm-pill icon-only active custom-site-pill';
  link.href = `https://${hostname}`;
  link.target = '_blank';
  link.rel = 'noopener';
  link.title = `Open ${hostname}`;

  const img = document.createElement('img');
  img.src = getFaviconFallbackForUrl(`https://${hostname}`);
  img.alt = `${hostname} icon`;
  img.width = 24;
  img.height = 24;
  img.className = 'llm-pill-icon custom-site-favicon';
  attachProviderIconFallback(img, `https://${hostname}`);
  link.appendChild(img);

  return link;
}

/**
 * COMMENT: Explicit Assistants entry that launches click-to-pick input mode.
 * @returns {HTMLButtonElement}
 */
function createCustomWebsiteButton() {
  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'custom-website-btn';
  button.className = 'llm-pill custom-site-add';
  button.setAttribute('aria-pressed', 'false');

  const icon = document.createElement('span');
  icon.className = 'custom-site-add-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>';

  const label = document.createElement('span');
  label.className = 'llm-pill-label';
  label.textContent = '+ Custom website';

  button.appendChild(icon);
  button.appendChild(label);
  button.addEventListener('click', () => {
    handleCustomWebsiteAction(button).catch(console.error);
  });

  return button;
}

// COMMENT: Helper to check if any provider permissions are granted
async function hasAnyGrantedProviderPermission() {
  return new Promise(resolve => {
    try {
      chrome.storage.local.get(['aiProvidersMap'], async result => {
        if (result?.aiProvidersMap) {
          const providersMap = result.aiProvidersMap;
          const anyGranted = Object.values(providersMap).some(p => p && p.hasPermission === 'Yes');
          if (anyGranted) {
            resolve(true);
            return;
          }
        }

        // COMMENT: Custom pinned websites also unlock the prompt list
        try {
          const pinned = await getAllPinnedInputs();
          resolve(Object.keys(pinned).length > 0);
        } catch (_) {
          resolve(false);
        }
      });
    } catch (err) {
      resolve(false);
    }
  });
}

// COMMENT: Track folded state of the "Available" group (collapsed by default)
let llmsAvailableCollapsed = true;

// COMMENT: Shared storage keys with the in-page panel so search/tag filters stay in sync
const TAG_STORAGE = {
  enableTags: 'enableTags',
  activeTagFilter: 'activeTagFilter',
  tagsOrder: 'tagsOrder',
};

let allPromptsCache = [];
let activeTagFilter = 'all';
let searchTerm = '';
let formTagInput = null;

async function getLocalSetting(key, defaultValue) {
  try {
    const data = await chrome.storage.local.get([key]);
    return data[key] !== undefined ? data[key] : defaultValue;
  } catch (_) {
    return defaultValue;
  }
}

async function setLocalSetting(key, value) {
  try {
    await chrome.storage.local.set({ [key]: value });
  } catch (_) {
    // Ignore storage errors
  }
}

function computeTagCounts(prompts = []) {
  const counts = new Map();
  prompts.forEach(p => {
    (Array.isArray(p.tags) ? p.tags : []).forEach(t => {
      const key = String(t).trim();
      if (!key) return;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
  });
  return counts;
}

async function getOrderedTags(counts) {
  const order = await getLocalSetting(TAG_STORAGE.tagsOrder, []);
  const tags = Array.from(counts.keys());
  const missing = tags.filter(t => !order.includes(t)).sort((a, b) => a.localeCompare(b));
  return [...order.filter(t => counts.has(t)), ...missing];
}

async function getTagSuggestions({ term = '', exclude = new Set() } = {}) {
  const prompts = allPromptsCache.length ? allPromptsCache : await PromptStorage.getPrompts();
  const counts = computeTagCounts(prompts);
  const ordered = await getOrderedTags(counts);
  const lcTerm = term.trim().toLowerCase();
  return ordered.filter(t => !exclude.has(t) && (lcTerm === '' || String(t).toLowerCase().includes(lcTerm)));
}

function promptMatchesFilters(prompt) {
  const value = (searchTerm || '').toLowerCase();
  const activeTag = (activeTagFilter || 'all').toLowerCase();
  const title = (prompt.title || '').toLowerCase();
  const content = (prompt.content || '').toLowerCase();
  const tagsFlat = Array.isArray(prompt.tags) ? prompt.tags.map(t => String(t).toLowerCase()).join(' ') : '';

  const matchesSearch = value === '' || title.includes(value) || content.includes(value) || tagsFlat.includes(value);

  let matchesTag = true;
  if (activeTag !== 'all') {
    const tagList = Array.isArray(prompt.tags) ? prompt.tags.map(t => String(t).toLowerCase()) : [];
    matchesTag = tagList.includes(activeTag);
  }
  return matchesSearch && matchesTag;
}

/** COMMENT: Tag input row for create/edit — mirrors in-page TagUI.createTagInput */
function createSidepanelTagInput({ initialTags = [] } = {}) {
  const tagsSet = new Set(Array.isArray(initialTags) ? initialTags : []);
  const row = document.createElement('div');
  row.className = 'spm-tag-row';

  const pills = document.createElement('div');
  pills.className = 'spm-tags-container';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Enter tags here.';
  input.className = 'spm-tag-input';
  input.autocomplete = 'off';

  const suggestions = document.createElement('div');
  suggestions.className = 'spm-tag-suggestions';
  suggestions.hidden = true;

  let activeIndex = -1;
  let options = [];

  const renderPills = () => {
    pills.innerHTML = '';
    Array.from(tagsSet).forEach(tag => {
      const pill = document.createElement('span');
      pill.className = 'spm-tag-pill';
      pill.textContent = String(tag);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'spm-tag-remove';
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        tagsSet.delete(tag);
        renderPills();
      });
      pill.appendChild(removeBtn);
      pills.appendChild(pill);
    });
  };

  const positionSuggestions = () => {
    const rect = row.getBoundingClientRect();
    suggestions.style.position = 'fixed';
    suggestions.style.zIndex = '10000';
    suggestions.style.left = `${Math.max(0, rect.left)}px`;
    const spaceAbove = rect.top;
    const desiredHeight = Math.min(160, window.innerHeight * 0.4);
    if (spaceAbove > desiredHeight + 8) {
      suggestions.style.top = `${rect.top}px`;
      suggestions.style.transform = 'translateY(-100%)';
    } else {
      suggestions.style.top = `${rect.bottom}px`;
      suggestions.style.transform = 'translateY(2px)';
    }
    suggestions.style.minWidth = `${Math.max(180, rect.width - 12)}px`;
  };

  const addTag = (val) => {
    const tag = (val || '').trim();
    if (!tag || tagsSet.has(tag)) return;
    tagsSet.add(tag);
    renderPills();
    activeIndex = -1;
    suggestions.hidden = true;
  };

  const refreshSuggestions = async () => {
    options = await getTagSuggestions({ term: input.value, exclude: tagsSet });
    suggestions.innerHTML = '';
    options.forEach((t, idx) => {
      const item = document.createElement('div');
      item.className = 'spm-tag-suggestion-item';
      if (idx === activeIndex) item.classList.add('active');
      item.textContent = t;
      item.addEventListener('mousedown', e => {
        e.preventDefault();
        e.stopPropagation();
        addTag(t);
        input.value = '';
        suggestions.hidden = true;
      });
      item.addEventListener('click', e => e.stopPropagation());
      suggestions.appendChild(item);
    });
    if (options.length > 0) {
      if (!document.body.contains(suggestions)) {
        document.body.appendChild(suggestions);
      }
      positionSuggestions();
      suggestions.hidden = false;
    } else {
      suggestions.hidden = true;
    }
  };

  input.addEventListener('input', () => {
    activeIndex = -1;
    const term = input.value.trim();
    if (term.length === 0) {
      suggestions.hidden = true;
      options = [];
      return;
    }
    refreshSuggestions();
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (activeIndex >= 0 && activeIndex < options.length) {
        addTag(options[activeIndex]);
        input.value = '';
      } else {
        addTag(input.value);
        input.value = '';
      }
      suggestions.hidden = true;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      activeIndex = Math.min(activeIndex + 1, options.length - 1);
      refreshSuggestions();
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      activeIndex = Math.max(activeIndex - 1, -1);
      refreshSuggestions();
    }
    if (e.key === 'Escape') {
      e.stopPropagation();
      suggestions.hidden = true;
    }
  });

  input.addEventListener('blur', () => { suggestions.hidden = true; });
  document.addEventListener('click', (evt) => {
    if (!suggestions.contains(evt.target) && evt.target !== input) {
      suggestions.hidden = true;
    }
  });
  window.addEventListener('resize', positionSuggestions);
  window.addEventListener('scroll', positionSuggestions, true);

  renderPills();
  row.append(pills, input);

  return {
    element: row,
    getTags: () => Array.from(tagsSet),
    setTags: (tags) => {
      tagsSet.clear();
      (Array.isArray(tags) ? tags : []).forEach(t => {
        const key = String(t).trim();
        if (key) tagsSet.add(key);
      });
      renderPills();
    },
    destroy: () => {
      if (suggestions.parentElement) suggestions.parentElement.removeChild(suggestions);
    },
  };
}

async function renderTagsFilterBar(prompts) {
  const barHost = document.getElementById('prompt-tags-filter');
  if (!barHost) return;

  const enableTags = await getLocalSetting(TAG_STORAGE.enableTags, false);
  if (!enableTags) {
    barHost.hidden = true;
    barHost.innerHTML = '';
    return;
  }

  const counts = computeTagCounts(prompts);
  if (counts.size === 0) {
    barHost.hidden = true;
    barHost.innerHTML = '';
    return;
  }

  const orderedTags = await getOrderedTags(counts);
  barHost.hidden = false;
  barHost.innerHTML = '';

  const bar = document.createElement('div');
  bar.className = 'spm-tags-filter-bar';

  const makePill = (label, tag, isSelected) => {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'spm-tag-pill-filter';
    pill.textContent = label;
    pill.dataset.tag = tag;
    pill.setAttribute('aria-pressed', String(!!isSelected));
    pill.addEventListener('click', async (e) => {
      e.stopPropagation();
      activeTagFilter = tag;
      await setLocalSetting(TAG_STORAGE.activeTagFilter, tag);
      refreshPromptListView();
    });
    return pill;
  };

  const selected = (activeTagFilter || 'all').toLowerCase();
  bar.appendChild(makePill('All', 'all', selected === 'all'));
  orderedTags.forEach(tag => {
    const isSelected = selected === String(tag).toLowerCase();
    bar.appendChild(makePill(String(tag), tag, isSelected));
  });

  barHost.appendChild(bar);
}

async function renderPromptListControls(prompts) {
  const controls = document.getElementById('prompt-list-controls');
  if (!controls) return;

  const allowed = await hasAnyGrantedProviderPermission();
  controls.hidden = !allowed;

  if (allowed) {
    await renderTagsFilterBar(prompts);
  }
}

async function initFormTags() {
  const host = document.getElementById('prompt-tags-host');
  if (!host) return;

  const enabled = await getLocalSetting(TAG_STORAGE.enableTags, false);
  if (formTagInput?.destroy) {
    formTagInput.destroy();
    formTagInput = null;
  }

  if (!enabled) {
    host.hidden = true;
    host.innerHTML = '';
    return;
  }

  host.hidden = false;
  host.innerHTML = '';
  formTagInput = createSidepanelTagInput();
  host.appendChild(formTagInput.element);
}

const debouncedSearchRefresh = debounceSidepanel(() => {
  refreshPromptListView();
}, 120);

/** COMMENT: Detect the full-tab expanded view (?expanded=1) vs the Chrome side panel */
function isExpandedTabView() {
  return new URLSearchParams(window.location.search).get('expanded') === '1';
}

/** COMMENT: Close the expanded tab via the service worker (sender.tab.id) */
async function closeExpandedView() {
  const closedViaWorker = await new Promise(resolve => {
    chrome.runtime.sendMessage({ type: 'OPM_CLOSE_EXPANDED_TAB' }, (response) => {
      if (chrome.runtime.lastError) {
        resolve(false);
        return;
      }
      resolve(Boolean(response?.ok));
    });
  });
  if (closedViaWorker) return;

  // COMMENT: Fallback — getCurrent uses callbacks in MV3, not bare await
  const tab = await new Promise(resolve => {
    try {
      chrome.tabs.getCurrent(currentTab => resolve(currentTab || null));
    } catch (_) {
      resolve(null);
    }
  });
  if (tab?.id) {
    await chrome.tabs.remove(tab.id);
    return;
  }
  window.close();
}

// COMMENT: Smoothly open/close a collapsible element without auto-scrolling the view
function setCollapsibleOpen(collapsibleEl, open) {
  if (!collapsibleEl) return;
  const scrollEl = document.scrollingElement || document.documentElement || document.body;
  const prevScrollTop = scrollEl.scrollTop;
  const targetHeight = collapsibleEl.scrollHeight;
  if (open) {
    // Ensure transition starts from 0 -> height
    collapsibleEl.classList.add('open');
    collapsibleEl.style.maxHeight = '0px';
    // COMMENT: Force reflow so the expand transition starts from zero height
    void collapsibleEl.offsetHeight;
    collapsibleEl.style.maxHeight = `${targetHeight}px`;
  } else {
    // Collapse from current height -> 0
    const currentMax = getComputedStyle(collapsibleEl).maxHeight;
    if (currentMax === 'none') {
      collapsibleEl.style.maxHeight = `${targetHeight}px`;
      // COMMENT: Force reflow before collapsing to the target height
      void collapsibleEl.offsetHeight;
    }
    collapsibleEl.style.maxHeight = '0px';
    collapsibleEl.classList.remove('open');
  }
  // Restore scroll so view does not auto-shift
  queueMicrotask(() => {
    try {
      scrollEl.scrollTop = prevScrollTop;
    } catch (e) {
      window.scrollTo({ top: prevScrollTop, behavior: 'auto' });
    }
  });
  // After transition ends and panel is open, set to 'none' so dynamic content is accommodated
  const onEnd = (e) => {
    if (e.propertyName !== 'max-height') return;
    collapsibleEl.removeEventListener('transitionend', onEnd);
    if (collapsibleEl.classList.contains('open')) {
      collapsibleEl.style.maxHeight = 'none';
    }
  };
  collapsibleEl.addEventListener('transitionend', onEnd);
}

// COMMENT: Build a providers map from storage or compute a fallback by reading llm_providers.json
async function getProvidersMapOrFallback() {
  if (cachedProvidersMap && Object.keys(cachedProvidersMap).length > 0) {
    return cachedProvidersMap;
  }

  try {
    const stored = await new Promise(resolve => {
      chrome.storage.local.get(['aiProvidersMap'], resolve);
    });
    if (stored?.aiProvidersMap && Object.keys(stored.aiProvidersMap).length > 0) {
      cachedProvidersMap = stored.aiProvidersMap;
      return cachedProvidersMap;
    }
  } catch (_) {
    // Fall through to computed map
  }

  try {
    const response = await fetch(chrome.runtime.getURL('llm_providers.json'));
    const data = await response.json();
    const list = Array.isArray(data?.llm_providers) ? data.llm_providers : [];
    const computedEntries = await Promise.all(list.map(async (p) => {
      let permitted = false;
      try {
        permitted = await chrome.permissions.contains({ origins: [p.pattern] });
      } catch (_) {
        permitted = false;
      }
      return [p.name, {
        hasPermission: permitted ? 'Yes' : 'No',
        urlPattern: p.pattern,
        url: p.url,
        iconUrl: resolveProviderIconUrl(p.icon_url, p.url),
      }];
    }));
    cachedProvidersMap = Object.fromEntries(computedEntries);
    return cachedProvidersMap;
  } catch (_) {
    return {};
  }
}

// COMMENT: Render the LLMs section with "Activated" and "Available" pills, reflecting storage status and permissions behavior
async function renderLLMsSectionBody() {
  const section = document.getElementById('llms-section');
  const activeWrap = document.getElementById('llms-activated');
  const availableWrap = document.getElementById('llms-available');
  const availableToggle = document.getElementById('llms-available-toggle');
  // COMMENT: Group wrappers for conditional display logic
  const shortcutsGroup = activeWrap ? activeWrap.closest('.llms-group') : null;
  const availableGroup = availableWrap ? availableWrap.closest('.llms-group') : null;
  if (!section || !activeWrap || !availableWrap) return;

  // Clear previous contents
  activeWrap.innerHTML = '';
  availableWrap.innerHTML = '';

  const providersMap = await getProvidersMapOrFallback();
  const pinnedInputs = await getAllPinnedInputs();
  const customSites = Object.keys(pinnedInputs).sort();

  // Split into active vs available
  const entries = Object.entries(providersMap || {});
  const active = entries.filter(([, v]) => v && v.hasPermission === 'Yes');
  const inactive = entries.filter(([, v]) => !v || v.hasPermission !== 'Yes');

  // Helper to create an icon-only element (anchor) with favicon only
  const createPill = ({ name, iconUrl, url, urlPattern, active }) => {
    const a = document.createElement('a');
    a.className = `llm-pill icon-only ${active ? 'active' : 'inactive'}`;
    a.setAttribute('data-provider', name);
    a.setAttribute('data-url-pattern', urlPattern || '');
    a.setAttribute('title', active ? `Open ${name}` : `Activate ${name}`);
    // Active pills open their provider page
    if (active && url) {
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener';
    } else {
      a.href = '#';
    }

    // Icon
    const img = document.createElement('img');
    img.src = resolveProviderIconUrl(iconUrl, url);
    img.alt = `${name} icon`;
    img.width = 24;
    img.height = 24;
    img.className = 'llm-pill-icon';
    attachProviderIconFallback(img, url);
    a.appendChild(img);

    if (!active) {
      // Request permission on click for inactive pills
      a.addEventListener('click', (ev) => {
        ev.preventDefault();
        const pattern = a.getAttribute('data-url-pattern');
        if (!pattern) return;
        chrome.permissions.request({ origins: [pattern] }, (granted) => {
          if (granted) {
            // Update storage map so both this UI and the permissions page stay in sync
            // Read, mutate, and write the aiProvidersMap
            chrome.storage.local.get(['aiProvidersMap'], (res) => {
              const map = res && res.aiProvidersMap ? res.aiProvidersMap : providersMap;
              if (!map[name]) {
                map[name] = { hasPermission: 'Yes', urlPattern: pattern, url, iconUrl };
              } else {
                map[name].hasPermission = 'Yes';
                map[name].urlPattern = pattern || map[name].urlPattern;
                map[name].url = url || map[name].url;
                map[name].iconUrl = iconUrl || map[name].iconUrl;
              }
              chrome.storage.local.set({ aiProvidersMap: map });
            });
          }
        });
      });
    }

    return a;
  };

  // Render active
  active
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([name, info]) => {
      activeWrap.appendChild(createPill({
        name,
        iconUrl: info.iconUrl,
        url: info.url,
        urlPattern: info.urlPattern,
        active: true
      }));
    });

  // COMMENT: Show pinned custom websites alongside built-in assistants
  customSites.forEach((hostname) => {
    activeWrap.appendChild(createCustomSitePill(hostname));
  });

  const customWebsiteBtn = createCustomWebsiteButton();
  activeWrap.appendChild(customWebsiteBtn);
  refreshCustomWebsiteButton(customWebsiteBtn);

  // Render inactive
  inactive
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([name, info]) => {
      availableWrap.appendChild(createPill({
        name,
        iconUrl: info?.iconUrl,
        url: info?.url,
        urlPattern: info?.urlPattern,
        active: false
      }));
    });

  // COMMENT: Apply folded state to Available group; collapsed by default
  // Special rule: if Shortcuts is empty, hide it and force Available open
  const hasKnownActive = active.length > 0 || customSites.length > 0;
  if (shortcutsGroup) shortcutsGroup.style.display = '';
  if (!hasKnownActive) {
    if (availableGroup) availableGroup.style.display = '';
    llmsAvailableCollapsed = false;
    setCollapsibleOpen(availableWrap, true);
    if (availableToggle) availableToggle.setAttribute('aria-expanded', 'true');
  } else {
    if (availableGroup) availableGroup.style.display = '';
    setCollapsibleOpen(availableWrap, !llmsAvailableCollapsed);
    if (availableToggle) {
      availableToggle.setAttribute('aria-expanded', llmsAvailableCollapsed ? 'false' : 'true');
    }
  }
}

async function renderLLMsSection() {
  if (llmsSectionRenderInFlight) {
    return llmsSectionRenderInFlight;
  }

  llmsSectionRenderInFlight = renderLLMsSectionBody();
  try {
    await llmsSectionRenderInFlight;
  } finally {
    llmsSectionRenderInFlight = null;
  }
}

// COMMENT: Toggle visibility between permissions shortcut and prompt list based on granted permissions
async function renderPermissionsGate() {
  const shortcut = document.getElementById('permissions-shortcut');
  const promptList = document.getElementById('prompt-list');
  const listControls = document.getElementById('prompt-list-controls');
  const emptyState = document.getElementById('empty-state');
  if (!shortcut || !promptList) return;
  const allowed = await hasAnyGrantedProviderPermission();
  if (allowed) {
    // Hide shortcut, show list normally
    shortcut.style.display = 'none';
    promptList.style.display = 'block';
    if (listControls) listControls.hidden = false;
    await renderPromptListControls(allPromptsCache);
    if (emptyState && promptList.children.length === 0) {
      const hasAnyPrompts = allPromptsCache.length > 0;
      emptyState.style.display = hasAnyPrompts ? 'none' : 'block';
    }
  } else {
    // Show shortcut, hide list and empty state
    shortcut.style.display = 'block';
    promptList.style.display = 'none';
    if (listControls) listControls.hidden = true;
    if (emptyState) emptyState.style.display = 'none';
  }
}

// COMMENT: Render the list of prompts in the sidepanel UI
function displayPrompts(prompts, totalCount = prompts.length) {
  const promptList = document.getElementById('prompt-list');
  const emptyState = document.getElementById('empty-state');
  const shortcut = document.getElementById('permissions-shortcut');
  promptList.innerHTML = '';
  if (!Array.isArray(prompts) || prompts.length === 0) {
    // If permissions shortcut is visible, prefer it over empty-state
    const shortcutVisible = shortcut && shortcut.style.display !== 'none';
    // COMMENT: Hide empty-state when filters exclude all items but prompts still exist
    if (emptyState) emptyState.style.display = (shortcutVisible || totalCount > 0) ? 'none' : 'block';
    return;
  }
  if (emptyState) emptyState.style.display = 'none';
  prompts.forEach((prompt) => {
    const li = document.createElement('li');
    li.dataset.uuid = prompt.uuid;
    const titleSpan = document.createElement('span');
    titleSpan.textContent = prompt.title;
    titleSpan.style.margin = '2px';
    titleSpan.style.padding = '3px';
    titleSpan.style.verticalAlign = 'middle';
    titleSpan.style.display = 'inline-block';
    li.appendChild(titleSpan);

    // COMMENT: Copy button (revealed on hover)
    const copyBtn = document.createElement('button');
    const copyImg = document.createElement('img');
    copyImg.src = '../icons/copy.png';
    copyImg.alt = 'Copy';
    copyImg.title = 'Copy to clipboard';
    copyImg.width = 14;
    copyImg.height = 14;
    copyImg.style.verticalAlign = 'middle';
    copyBtn.style.display = 'none';
    copyBtn.style.backgroundColor = '#ffffff00';
    copyBtn.appendChild(copyImg);
    copyBtn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(prompt.content);
    });
    li.appendChild(copyBtn);

    // COMMENT: Edit button (revealed on hover)
    const editBtn = document.createElement('button');
    const editImg = document.createElement('img');
    editImg.src = '../icons/edit-icon.png';
    editImg.alt = 'Edit';
    editImg.title = 'Edit';
    editImg.width = 14;
    editImg.height = 14;
    editImg.style.verticalAlign = 'middle';
    editBtn.style.display = 'none';
    editBtn.style.backgroundColor = '#ffffff00';
    editBtn.appendChild(editImg);
    editBtn.addEventListener('click', () => {
      // COMMENT: Track by stable uuid so reordering elsewhere cannot corrupt edits
      document.getElementById('prompt-title').value = prompt.title;
      document.getElementById('prompt-content').value = prompt.content;
      document.getElementById('prompt-uuid').value = prompt.uuid;
      if (formTagInput) formTagInput.setTags(prompt.tags || []);
      document.getElementById('submit-button').textContent = 'Update';
      document.getElementById('cancel-edit-button').style.display = 'inline';
    });
    li.appendChild(editBtn);

    // COMMENT: Delete button (revealed on hover)
    const delBtn = document.createElement('button');
    const delImg = document.createElement('img');
    delImg.src = '../icons/delete.svg';
    delImg.alt = 'Delete';
    delImg.title = 'Delete';
    delImg.width = 18;
    delImg.height = 18;
    delImg.style.verticalAlign = 'middle';
    delBtn.style.display = 'none';
    delBtn.style.backgroundColor = '#ffffff00';
    delBtn.appendChild(delImg);
    delBtn.addEventListener('click', async () => {
      if (!window.confirm('Are you sure you want to delete this prompt?')) return;
      await PromptStorage.deletePrompt(prompt.uuid);
    });
    li.appendChild(delBtn);

    // COMMENT: Hover interactions for action buttons
    li.addEventListener('mouseenter', () => {
      copyBtn.style.display = 'inline-block';
      editBtn.style.display = 'inline-block';
      delBtn.style.display = 'inline-block';
    });
    li.addEventListener('mouseleave', () => {
      copyBtn.style.display = 'none';
      editBtn.style.display = 'none';
      delBtn.style.display = 'none';
    });

    document.getElementById('prompt-list').appendChild(li);
  });
}

// COMMENT: Load prompts from storage, apply search/tag filters, and render
async function refreshPromptListView() {
  allPromptsCache = await PromptStorage.getPrompts();
  await renderPromptListControls(allPromptsCache);
  const filtered = allPromptsCache.filter(promptMatchesFilters);
  displayPrompts(filtered, allPromptsCache.length);
}

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('prompt-form');
  const titleInput = document.getElementById('prompt-title');
  const contentInput = document.getElementById('prompt-content');
  const promptUuidInput = document.getElementById('prompt-uuid');
  const submitButton = document.getElementById('submit-button');
  const cancelEditButton = document.getElementById('cancel-edit-button');
  // COMMENT: Info banner elements for close/dismiss behavior
  const infoBanner = document.getElementById('info-banner');
  const infoBannerClose = document.getElementById('info-banner-close');
  const searchInput = document.getElementById('prompt-search-input');
  const closeExpandedBtn = document.getElementById('close-expanded-view');

  // COMMENT: Mark expanded tab view so the header close button is shown
  if (isExpandedTabView()) {
    document.body.classList.add('is-expanded-tab');
  }
  if (closeExpandedBtn) {
    closeExpandedBtn.addEventListener('click', () => {
      closeExpandedView().catch(console.error);
    });
  }

  // COMMENT: Restore shared tag filter + form tag row from storage
  activeTagFilter = await getLocalSetting(TAG_STORAGE.activeTagFilter, 'all');
  await initFormTags();

  // Load prompts and display
  refreshPromptListView();
  // COMMENT: Evaluate permissions gate on load
  renderPermissionsGate();
  // COMMENT: Render LLMs section on load
  renderLLMsSection();

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchTerm = e.target.value || '';
      debouncedSearchRefresh();
    });
  }

  try {
    chrome.tabs.onActivated.addListener(() => {
      scheduleActiveTabAssistantsRefresh();
    });
    chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
      if (changeInfo.status === 'complete' || changeInfo.url) {
        scheduleActiveTabAssistantsRefresh();
      }
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.pinned_inputs_v1) {
        renderPermissionsGate();
        renderLLMsSection();
      }
      if (area === 'local') {
        if (changes.activeTagFilter?.newValue !== undefined) {
          activeTagFilter = changes.activeTagFilter.newValue || 'all';
        }
        if (changes.enableTags || changes.activeTagFilter || changes.tagsOrder) {
          initFormTags();
          refreshPromptListView();
        }
      }
    });
  } catch (_) {
    // Ignore if tabs API is unavailable in this context
  }

  // COMMENT: Wire Available subheading toggle (fold/unfold)
  const availableToggle = document.getElementById('llms-available-toggle');
  const availableWrap = document.getElementById('llms-available');
  if (availableToggle && availableWrap) {
    const toggle = (ev) => {
      if (ev && ev.type === 'keydown') {
        if (ev.key !== 'Enter' && ev.key !== ' ') return;
        ev.preventDefault();
      }
      llmsAvailableCollapsed = !llmsAvailableCollapsed;
      setCollapsibleOpen(availableWrap, !llmsAvailableCollapsed);
      availableToggle.setAttribute('aria-expanded', llmsAvailableCollapsed ? 'false' : 'true');
    };
    availableToggle.addEventListener('click', toggle);
    availableToggle.addEventListener('keydown', toggle);
    // Ensure default collapsed state reflected in DOM
    setCollapsibleOpen(availableWrap, false);
    availableToggle.setAttribute('aria-expanded', 'false');
  }

  // COMMENT: Refresh UI whenever prompts change in storage
  PromptStorage.onPromptsChanged(refreshPromptListView);

  // COMMENT: React to permissions updates live (permissions page writes aiProvidersMap)
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.aiProvidersMap) {
        cachedProvidersMap = changes.aiProvidersMap.newValue || null;
        renderPermissionsGate();
        // COMMENT: Also refresh the LLMs section so pills reflect new activation status
        renderLLMsSection();
      }
    });
  } catch (err) {
    // Ignore if not available
  }

  // Decide whether to show the info banner based on a storage-backed toggle.
  // Default is hidden unless `spm_show_info_banner` is true and the user has not dismissed it.
  if (infoBanner) {
    infoBanner.style.display = 'none'; // default: hidden
  }
  try {
    chrome.storage?.local?.get(['spm_show_info_banner'], (res) => {
      const shouldShow = res && res.spm_show_info_banner === true;
      // Respect prior dismissal stored in localStorage
      const dismissed = (() => {
        try { return localStorage.getItem('spm_info_banner_dismissed') === 'true'; } catch (e) { return false; }
      })();
      if (shouldShow && !dismissed && infoBanner) {
        infoBanner.style.display = '';
      }
    });
  } catch (err) {
    // If storage read fails, keep banner hidden unless already visible by markup
    try {
      const dismissed = localStorage.getItem('spm_info_banner_dismissed') === 'true';
      if (dismissed && infoBanner) infoBanner.style.display = 'none';
    } catch (e) {}
  }

  // Close banner and persist choice
  if (infoBannerClose) {
    infoBannerClose.addEventListener('click', () => {
      if (infoBanner) infoBanner.style.display = 'none';
      try {
        localStorage.setItem('spm_info_banner_dismissed', 'true');
        // Turning off the storage toggle ensures it will not show again
        // until explicitly re-enabled by setting `spm_show_info_banner` to true.
        chrome.storage?.local?.set({ spm_show_info_banner: false });
      } catch (err) {
        // Ignore storage errors
      }
    });
  }

  // Add or update prompt
  form.addEventListener('submit', event => {
    event.preventDefault();
    const title = titleInput.value.trim();
    const content = contentInput.value;
    const tags = formTagInput ? formTagInput.getTags() : [];

    if (promptUuidInput.value === '') {
      // COMMENT: Add new prompt via unified manager
      PromptStorage.savePrompt({ title, content, tags }).catch(console.error);
    } else {
      // COMMENT: Update existing prompt by uuid via unified manager
      PromptStorage.updatePrompt(promptUuidInput.value, { title, content, tags }).catch(console.error);
    }

    // Reset form
    titleInput.value = '';
    contentInput.value = '';
    promptUuidInput.value = '';
    if (formTagInput) formTagInput.setTags([]);
    submitButton.textContent = 'Save prompt';
    cancelEditButton.style.display = 'none';
  });

  // Cancel edit
  cancelEditButton.addEventListener('click', () => {
    // Reset form
    titleInput.value = '';
    contentInput.value = '';
    promptUuidInput.value = '';
    if (formTagInput) formTagInput.setTags([]);
    submitButton.textContent = 'Add Prompt';
    cancelEditButton.style.display = 'none';
  });
});
