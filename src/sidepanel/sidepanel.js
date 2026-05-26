// sidepanel.js

// COMMENT: Use unified prompt storage for all prompt operations
import * as PromptStorage from '../storage/promptStorage.js';
import { getPinnedForHostname, getAllPinnedInputs } from '../storage/pinnedInputStorage.js';
import {
  resolveProviderIconUrl,
  attachProviderIconFallback,
  getFaviconFallbackForUrl,
} from '../utils/providerIcons.js';
import { OPD_CATALOG_URL, OPD_MSG } from '../opd/opdConstants.js';
import { mountSidepanelFooter } from './sidepanelFooter.js';

/** @type {ReturnType<typeof collectPromptFormRefs>|null} */
let promptFormEls = null;

/** COMMENT: Detect the full-tab expanded view (?expanded=1) vs the Chrome side panel */
function isExpandedTabView() {
  return new URLSearchParams(window.location.search).get('expanded') === '1';
}

function collectPromptFormRefs() {
  return {
    actionBar: document.getElementById('sidebar-action-bar'),
    composer: document.getElementById('sidebar-composer'),
    form: document.getElementById('prompt-form'),
    titleInput: document.getElementById('prompt-title'),
    contentInput: document.getElementById('prompt-content'),
    uuidInput: document.getElementById('prompt-uuid'),
    submitButton: document.getElementById('submit-button'),
    cancelButton: document.getElementById('cancel-edit-button'),
  };
}

function getPromptFormEls() {
  if (!promptFormEls) promptFormEls = collectPromptFormRefs();
  return promptFormEls;
}

// COMMENT: Expanded tab uses a two-pane layout — form lives in .composer-panel, not the sidebar slot
function setupComposerLayout() {
  const composerPanel = document.getElementById('composer-panel');
  const sidebarComposer = document.getElementById('sidebar-composer');
  const topSlot = document.querySelector('.sidebar-top-slot');
  const form = document.getElementById('prompt-form');
  const expanded = isExpandedTabView();

  if (expanded) {
    if (form && composerPanel && form.parentElement !== composerPanel) {
      composerPanel.appendChild(form);
    }
    if (composerPanel) composerPanel.hidden = false;
    if (topSlot) topSlot.hidden = true;
  } else {
    if (form && sidebarComposer && form.parentElement !== sidebarComposer) {
      sidebarComposer.appendChild(form);
    }
    if (composerPanel) composerPanel.hidden = true;
    if (topSlot) topSlot.hidden = false;
  }

  promptFormEls = null;
}

// COMMENT: Swap the top sidebar slot between action buttons and the inline prompt form
function setComposerOpen(isOpen) {
  if (isExpandedTabView()) return;
  const { actionBar, composer } = getPromptFormEls();
  const showForm = Boolean(isOpen);
  if (actionBar) actionBar.hidden = showForm;
  if (composer) composer.hidden = !showForm;
}

function resetPromptForm({ keepOpen = false } = {}) {
  const {
    titleInput,
    contentInput,
    uuidInput,
    submitButton,
    cancelButton,
  } = getPromptFormEls();

  if (titleInput) titleInput.value = '';
  if (contentInput) contentInput.value = '';
  if (uuidInput) uuidInput.value = '';
  if (formTagInput) formTagInput.setTags([]);
  if (submitButton) submitButton.textContent = 'Save prompt';
  if (cancelButton) cancelButton.textContent = 'Back';

  if (!keepOpen) setComposerOpen(false);
}

function openComposerView({ title = '', content = '', uuid = '', tags = [] } = {}) {
  const {
    titleInput,
    contentInput,
    uuidInput,
    submitButton,
    cancelButton,
  } = getPromptFormEls();

  if (titleInput) titleInput.value = title;
  if (contentInput) contentInput.value = content;
  if (uuidInput) uuidInput.value = uuid;
  if (formTagInput) formTagInput.setTags(tags);

  if (submitButton) {
    submitButton.textContent = uuid ? 'Update' : 'Save prompt';
  }
  if (cancelButton) {
    cancelButton.textContent = uuid ? 'Cancel' : 'Back';
  }

  setComposerOpen(true);
  titleInput?.focus();
}

// COMMENT: Overflow menu + success checkmark for sidebar prompt row actions
const SPM_SHARE_ICON_SVG = '<svg class="spm-prompt-action-icon" viewBox="0 -960 960 960" aria-hidden="true"><path fill="currentColor" d="M440-320v-326L336-542l-56-58 200-200 200 200-56 58-104-104v326h-80ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z"/></svg>';
const SPM_MORE_VERT_ICON_SVG = '<svg class="spm-prompt-action-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>';
const SPM_CHECK_ICON_SVG = '<svg class="spm-prompt-action-icon spm-prompt-action-icon-success" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
const SPM_ACTION_FEEDBACK_MS = 1200;

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
// COMMENT: Cache permission gate result so init does not repeat storage reads
let cachedPermissionAllowed = null;

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
function sendPinInputAction(action, tabId) {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ type: 'OPM_PIN_INPUT', action, tabId }, response => {
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
    const result = await sendPinInputAction('clear', tab.id);
    if (!result?.ok) {
      window.alert(result?.error || 'Could not unpin this custom website.');
      return;
    }
    await refreshCustomWebsiteButton(customWebsiteBtn);
    await renderLLMsSection();
    return;
  }

  let result = await sendPinInputAction('start', tab.id);
  if (result?.error === 'no_permission') {
    const granted = await requestPermissionForUrl(tab.url);
    if (!granted) {
      window.alert('Allow site access for this page to pick its input field.');
      return;
    }
    // COMMENT: Permission just granted — inject scripts then open the picker immediately
    result = await sendPinInputAction('start', tab.id);
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

// COMMENT: Shared storage keys with the in-page panel so search/tag filters stay in sync
const TAG_STORAGE = {
  enableTags: 'enableTags',
  activeTagFilter: 'activeTagFilter',
  tagsOrder: 'tagsOrder',
};

// COMMENT: Derive permission gate from already-loaded storage data
function computePermissionFromData(providersMap, pinnedInputs) {
  if (providersMap && typeof providersMap === 'object') {
    const anyGranted = Object.values(providersMap).some(p => p && p.hasPermission === 'Yes');
    if (anyGranted) return true;
  }
  return Object.keys(pinnedInputs || {}).length > 0;
}

// COMMENT: Helper to check if any provider permissions are granted
async function hasAnyGrantedProviderPermission() {
  if (cachedPermissionAllowed !== null) {
    return cachedPermissionAllowed;
  }

  try {
    const [stored, pinnedInputs] = await Promise.all([
      new Promise(resolve => {
        try {
          chrome.storage.local.get(['aiProvidersMap'], resolve);
        } catch (_) {
          resolve({});
        }
      }),
      getAllPinnedInputs().catch(() => ({})),
    ]);

    if (stored?.aiProvidersMap) {
      cachedProvidersMap = stored.aiProvidersMap;
    }
    cachedPermissionAllowed = computePermissionFromData(stored?.aiProvidersMap, pinnedInputs);
    return cachedPermissionAllowed;
  } catch (_) {
    cachedPermissionAllowed = false;
    return false;
  }
}

// COMMENT: Load prompts, provider map, pinned inputs, and tag settings in one parallel pass
async function loadInitSnapshot() {
  const settingsKeys = [
    'aiProvidersMap',
    TAG_STORAGE.activeTagFilter,
    TAG_STORAGE.enableTags,
    TAG_STORAGE.tagsOrder,
  ];
  const [prompts, storageData, pinnedInputs] = await Promise.all([
    PromptStorage.getPrompts(),
    new Promise(resolve => {
      try {
        chrome.storage.local.get(settingsKeys, resolve);
      } catch (_) {
        resolve({});
      }
    }),
    getAllPinnedInputs().catch(() => ({})),
  ]);

  return {
    prompts,
    providersMap: storageData?.aiProvidersMap || null,
    pinnedInputs,
    activeTagFilter: storageData?.[TAG_STORAGE.activeTagFilter] ?? 'all',
    enableTags: Boolean(storageData?.[TAG_STORAGE.enableTags]),
    tagsOrder: Array.isArray(storageData?.[TAG_STORAGE.tagsOrder])
      ? storageData[TAG_STORAGE.tagsOrder]
      : [],
  };
}

// COMMENT: Coordinated first paint — prompt list first, tag bar and Assistants deferred
async function initSidepanelContent() {
  const snapshot = await loadInitSnapshot();
  allPromptsCache = snapshot.prompts;
  activeTagFilter = snapshot.activeTagFilter || 'all';
  cachedEnableTags = snapshot.enableTags;
  cachedTagsOrder = snapshot.tagsOrder;

  if (snapshot.providersMap) {
    cachedProvidersMap = snapshot.providersMap;
  }
  cachedPermissionAllowed = computePermissionFromData(cachedProvidersMap, snapshot.pinnedInputs);
  await refreshOpdPublishStatus();

  // COMMENT: Paint the prompt list before tag filters or Assistants build
  displayPrompts(
    allPromptsCache.filter(promptMatchesFilters),
    allPromptsCache.length
  );
  lastPromptListDisplaySig = promptListDisplaySignature(allPromptsCache);
  await renderPermissionsGate(cachedPermissionAllowed, { skipControls: true });

  const controls = document.getElementById('prompt-list-controls');
  if (controls && cachedPermissionAllowed) {
    controls.hidden = false;
  }

  const renderSecondaryUi = () => {
    renderPromptListControls(allPromptsCache, cachedPermissionAllowed).catch(console.error);
    initFormTags(cachedEnableTags).catch(console.error);
    renderLLMsSection({ pinnedInputs: snapshot.pinnedInputs }).catch(console.error);
  };
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(renderSecondaryUi, { timeout: 300 });
  } else {
    setTimeout(renderSecondaryUi, 0);
  }
}

// COMMENT: Track folded state of the "Available" group (collapsed by default)
let llmsAvailableCollapsed = true;

let allPromptsCache = [];
let activeTagFilter = 'all';
let searchTerm = '';
let formTagInput = null;
// COMMENT: Cached tag settings from the init snapshot to avoid repeat storage reads
let cachedEnableTags = false;
let cachedTagsOrder = [];
// COMMENT: True when OPD publishing is enabled and the user has a registered handle
let cachedOpdPublishEnabled = false;
// COMMENT: Skip list re-renders when only OPD metadata changes (share feedback + less flicker)
let lastPromptListDisplaySig = '';

function promptListDisplaySignature(prompts = []) {
  return prompts.map((p) => [
    p.uuid,
    p.title,
    p.content,
    (Array.isArray(p.tags) ? p.tags.join('\u001f') : ''),
  ].join('\u001e')).join('\u001d');
}

async function refreshOpdPublishStatus() {
  try {
    const settings = await chrome.storage.sync.get(['opdPublishEnabled']);
    // COMMENT: Default publish on for new users (key absent) — registration happens on first share
    cachedOpdPublishEnabled = settings.opdPublishEnabled !== false;
  } catch (_) {
    cachedOpdPublishEnabled = false;
  }
}

// COMMENT: Publish immediately and copy the catalog URL — no confirmation UI
async function publishPromptToOpd(localUuid) {
  try {
    const res = await chrome.runtime.sendMessage({
      type: OPD_MSG.PUBLISH_PROMPT,
      localUuid,
    });
    if (res?.ok && res.url) {
      try {
        await navigator.clipboard.writeText(res.url);
      } catch (_) {
        // COMMENT: Publish succeeded even if clipboard write fails in the side panel
      }
      return true;
    }
  } catch (_) {
    // Ignore publish failures silently in the sidebar
  }
  return false;
}

// COMMENT: Share publish re-renders the list before feedback can paint — replay after rebuild
const pendingActionFeedback = new Map();

function findPromptActionButton(uuid, kind) {
  const li = document.querySelector(`#prompt-list li[data-uuid="${uuid}"]`);
  if (!li) return null;
  const label = kind === 'share'
    ? 'Share to Open Prompt Database'
    : 'Copy to clipboard';
  return li.querySelector(`.spm-prompt-action-btn[aria-label="${label}"]`);
}

function schedulePromptActionFeedback(uuid, kind, btn) {
  pendingActionFeedback.set(uuid, kind);
  if (kind === 'copy' && btn?.isConnected) {
    flashPromptActionSuccess(btn);
    pendingActionFeedback.delete(uuid);
    return;
  }
  applyPendingActionFeedback();
}

function applyPendingActionFeedback() {
  if (!pendingActionFeedback.size) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      for (const [uuid, kind] of [...pendingActionFeedback.entries()]) {
        const li = document.querySelector(`#prompt-list li[data-uuid="${uuid}"]`);
        const btn = findPromptActionButton(uuid, kind);
        if (!btn || !li) continue;
        li.classList.add('spm-action-feedback-visible');
        flashPromptActionSuccess(btn);
        pendingActionFeedback.delete(uuid);
        window.setTimeout(() => {
          li.classList.remove('spm-action-feedback-visible');
        }, SPM_ACTION_FEEDBACK_MS);
      }
    });
  });
}

// COMMENT: Briefly swap a row action icon to a checkmark after success
function flashPromptActionSuccess(btn) {
  if (!btn || btn.dataset.spmFeedbackActive === '1') return;
  const original = btn.innerHTML;
  btn.dataset.spmFeedbackActive = '1';
  btn.classList.add('spm-prompt-action-success');
  btn.innerHTML = SPM_CHECK_ICON_SVG;
  window.setTimeout(() => {
    btn.innerHTML = original;
    btn.classList.remove('spm-prompt-action-success');
    delete btn.dataset.spmFeedbackActive;
  }, SPM_ACTION_FEEDBACK_MS);
}

function wrapPromptActionWithFeedback(btn, action, feedbackKey) {
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const ok = await action(e);
    if (ok !== false) {
      if (feedbackKey) {
        schedulePromptActionFeedback(feedbackKey.uuid, feedbackKey.kind, btn);
      } else {
        flashPromptActionSuccess(btn);
      }
    }
  });
  return btn;
}

function createPromptSvgActionButton(label, svgHtml, onClick, { withFeedback = false, feedbackKey = null } = {}) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'spm-prompt-action-btn';
  btn.title = label;
  btn.setAttribute('aria-label', label);
  btn.innerHTML = svgHtml;
  if (withFeedback) {
    wrapPromptActionWithFeedback(btn, onClick, feedbackKey);
  } else {
    btn.addEventListener('click', onClick);
  }
  return btn;
}

function createPromptImgActionButton(label, src, size, onClick, { withFeedback = false, feedbackKey = null } = {}) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'spm-prompt-action-btn';
  btn.title = label;
  btn.setAttribute('aria-label', label);
  const img = document.createElement('img');
  img.src = src;
  img.alt = '';
  img.width = size;
  img.height = size;
  btn.appendChild(img);
  if (withFeedback) {
    wrapPromptActionWithFeedback(btn, onClick, feedbackKey);
  } else {
    btn.addEventListener('click', onClick);
  }
  return btn;
}

function buildPromptListItemActions(prompt) {
  const actions = document.createElement('div');
  actions.className = 'spm-prompt-actions';

  const primary = document.createElement('div');
  primary.className = 'spm-prompt-actions-primary';

  primary.appendChild(createPromptImgActionButton(
    'Copy to clipboard',
    '../icons/copy.png',
    14,
    async () => {
      await navigator.clipboard.writeText(prompt.content);
    },
    { withFeedback: true, feedbackKey: { uuid: prompt.uuid, kind: 'copy' } },
  ));

  if (cachedOpdPublishEnabled) {
    primary.appendChild(createPromptSvgActionButton(
      'Share to Open Prompt Database',
      SPM_SHARE_ICON_SVG,
      async () => publishPromptToOpd(prompt.uuid),
      { withFeedback: true, feedbackKey: { uuid: prompt.uuid, kind: 'share' } },
    ));
  }

  const menu = document.createElement('div');
  menu.className = 'spm-prompt-actions-menu';

  const overflow = document.createElement('div');
  overflow.className = 'spm-prompt-actions-overflow';

  overflow.appendChild(createPromptImgActionButton(
    'Edit',
    '../icons/edit-icon.png',
    14,
    (e) => {
      e.stopPropagation();
      openComposerView({
        title: prompt.title,
        content: prompt.content,
        uuid: prompt.uuid,
        tags: prompt.tags || [],
      });
    },
  ));

  overflow.appendChild(createPromptImgActionButton(
    'Delete',
    '../icons/delete.svg',
    18,
    async (e) => {
      e.stopPropagation();
      if (!window.confirm('Are you sure you want to delete this prompt?')) return;
      await PromptStorage.deletePrompt(prompt.uuid);
    },
  ));

  const moreBtn = createPromptSvgActionButton(
    'More actions',
    SPM_MORE_VERT_ICON_SVG,
    (e) => {
      e.stopPropagation();
      e.currentTarget.closest('li')?.classList.toggle('spm-actions-menu-open');
    },
  );
  moreBtn.classList.add('spm-prompt-action-more');

  menu.append(overflow, moreBtn);
  actions.append(primary, menu);
  return actions;
}

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

async function getOrderedTags(counts, orderOverride) {
  const order = Array.isArray(orderOverride)
    ? orderOverride
    : (cachedTagsOrder.length ? cachedTagsOrder : await getLocalSetting(TAG_STORAGE.tagsOrder, []));
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

async function renderTagsFilterBar(prompts, enableTagsOverride) {
  const barHost = document.getElementById('prompt-tags-filter');
  if (!barHost) return;

  const enableTags = enableTagsOverride !== undefined
    ? enableTagsOverride
    : await getLocalSetting(TAG_STORAGE.enableTags, false);
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

  const orderedTags = await getOrderedTags(counts, cachedTagsOrder);
  barHost.hidden = false;

  // COMMENT: Preserve horizontal scroll when the bar is rebuilt (new tags, reorder, etc.)
  const existingBar = barHost.querySelector('.spm-tags-filter-bar');
  const savedScrollLeft = existingBar?.scrollLeft ?? 0;

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
      updateTagsFilterSelection();
      refreshFilteredPromptList();
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
  bar.scrollLeft = savedScrollLeft;
}

// COMMENT: Update selected pill state without rebuilding the tags bar (keeps scroll position)
function updateTagsFilterSelection() {
  const bar = document.querySelector('.spm-tags-filter-bar');
  if (!bar) return;
  const selected = (activeTagFilter || 'all').toLowerCase();
  bar.querySelectorAll('.spm-tag-pill-filter').forEach((pill) => {
    const tag = String(pill.dataset.tag || 'all').toLowerCase();
    pill.setAttribute('aria-pressed', String(tag === selected));
  });
}

// COMMENT: Re-filter and repaint the prompt list without touching the tags bar
function refreshFilteredPromptList() {
  const filtered = allPromptsCache.filter(promptMatchesFilters);
  displayPrompts(filtered, allPromptsCache.length);
}

async function renderPromptListControls(prompts, allowedOverride) {
  const controls = document.getElementById('prompt-list-controls');
  if (!controls) return;

  const allowed = allowedOverride !== undefined
    ? allowedOverride
    : await hasAnyGrantedProviderPermission();
  controls.hidden = !allowed;

  if (allowed) {
    await renderTagsFilterBar(prompts, cachedEnableTags);
  }
}

async function initFormTags(enableTagsOverride) {
  const host = document.getElementById('prompt-tags-host');
  if (!host) return;

  const enabled = enableTagsOverride !== undefined
    ? enableTagsOverride
    : await getLocalSetting(TAG_STORAGE.enableTags, false);
  cachedEnableTags = enabled;
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
  refreshFilteredPromptList();
}, 120);

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
function setCollapsibleOpen(collapsibleEl, open, { animate = true } = {}) {
  if (!collapsibleEl) return;
  if (!animate) {
    if (open) {
      collapsibleEl.classList.add('open');
      collapsibleEl.style.maxHeight = 'none';
    } else {
      collapsibleEl.classList.remove('open');
      collapsibleEl.style.maxHeight = '0px';
    }
    return;
  }
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
async function renderLLMsSectionBody({ pinnedInputs: pinnedInputsOverride } = {}) {
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
  const pinnedInputs = pinnedInputsOverride ?? await getAllPinnedInputs();
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
    setCollapsibleOpen(availableWrap, true, { animate: false });
    if (availableToggle) availableToggle.setAttribute('aria-expanded', 'true');
  } else {
    if (availableGroup) availableGroup.style.display = '';
    setCollapsibleOpen(availableWrap, !llmsAvailableCollapsed, { animate: false });
    if (availableToggle) {
      availableToggle.setAttribute('aria-expanded', llmsAvailableCollapsed ? 'false' : 'true');
    }
  }
}

async function renderLLMsSection(options = {}) {
  if (llmsSectionRenderInFlight) {
    return llmsSectionRenderInFlight;
  }

  llmsSectionRenderInFlight = renderLLMsSectionBody(options);
  try {
    await llmsSectionRenderInFlight;
  } finally {
    llmsSectionRenderInFlight = null;
  }
}

// COMMENT: Toggle visibility between permissions shortcut and prompt list based on granted permissions
async function renderPermissionsGate(allowedOverride, { skipControls = false } = {}) {
  const shortcut = document.getElementById('permissions-shortcut');
  const promptList = document.getElementById('prompt-list');
  const listControls = document.getElementById('prompt-list-controls');
  const emptyState = document.getElementById('empty-state');
  if (!shortcut || !promptList) return;
  const allowed = allowedOverride !== undefined
    ? allowedOverride
    : await hasAnyGrantedProviderPermission();
  if (allowed) {
    // Hide shortcut, show list normally
    shortcut.style.display = 'none';
    promptList.style.display = 'block';
    if (listControls) listControls.hidden = false;
    if (!skipControls) {
      await renderPromptListControls(allPromptsCache, allowed);
    }
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
  const fragment = document.createDocumentFragment();
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
    li.appendChild(buildPromptListItemActions(prompt));

    // COMMENT: Collapse the overflow menu when the pointer leaves the row
    li.addEventListener('mouseleave', () => {
      li.classList.remove('spm-actions-menu-open');
    });

    fragment.appendChild(li);
  });
  promptList.appendChild(fragment);
  applyPendingActionFeedback();
}

// COMMENT: Load prompts from storage, apply search/tag filters, and render
async function refreshPromptListView(force = false) {
  const nextPrompts = await PromptStorage.getPrompts();
  const nextSig = promptListDisplaySignature(nextPrompts);
  if (!force && nextSig === lastPromptListDisplaySig) {
    allPromptsCache = nextPrompts;
    applyPendingActionFeedback();
    return;
  }
  lastPromptListDisplaySig = nextSig;
  allPromptsCache = nextPrompts;
  await renderPromptListControls(allPromptsCache);
  const filtered = allPromptsCache.filter(promptMatchesFilters);
  displayPrompts(filtered, allPromptsCache.length);
}

document.addEventListener('DOMContentLoaded', async () => {
  if (isExpandedTabView()) {
    document.body.classList.add('is-expanded-tab');
  }
  setupComposerLayout();
  promptFormEls = collectPromptFormRefs();
  const {
    form,
    titleInput,
    contentInput,
    uuidInput,
    cancelButton,
  } = getPromptFormEls();

  const sidebarPanel = document.querySelector('.sidebar-panel');
  mountSidepanelFooter({ root: sidebarPanel || document.body });

  const searchInput = document.getElementById('prompt-search-input');
  const closeExpandedBtn = document.getElementById('close-expanded-view');
  const createPromptBtn = document.getElementById('create-prompt-btn');
  const communityPromptsBtn = document.getElementById('community-prompts-btn');

  if (communityPromptsBtn) {
    communityPromptsBtn.href = `${OPD_CATALOG_URL}/`;
  }
  if (createPromptBtn) {
    createPromptBtn.addEventListener('click', () => {
      openComposerView();
    });
  }

  if (!isExpandedTabView()) {
    setComposerOpen(false);
  }

  if (closeExpandedBtn) {
    closeExpandedBtn.addEventListener('click', () => {
      closeExpandedView().catch(console.error);
    });
  }

  // COMMENT: Single coordinated init — prompt list paints before form tags / filters
  await initSidepanelContent();

  // COMMENT: Escape in the side panel should also dismiss an active page pin-picker overlay
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    getActiveBrowserTab()
      .then((tab) => {
        if (tab?.id) sendPinInputAction('cancel', tab.id);
      })
      .catch(() => {});
  });

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
      if (area === 'sync' && (changes.opdPublishEnabled || changes.opdUsername || changes.opdPublishToken)) {
        refreshOpdPublishStatus()
          .then(() => refreshPromptListView())
          .catch(console.error);
      }
      if (area === 'local' && changes.pinned_inputs_v1) {
        cachedPermissionAllowed = null;
        renderPermissionsGate();
        renderLLMsSection();
      }
      if (area === 'local') {
        if (changes.activeTagFilter?.newValue !== undefined) {
          activeTagFilter = changes.activeTagFilter.newValue || 'all';
        }
        if (changes.enableTags?.newValue !== undefined) {
          cachedEnableTags = Boolean(changes.enableTags.newValue);
        }
        if (changes.tagsOrder?.newValue !== undefined) {
          cachedTagsOrder = Array.isArray(changes.tagsOrder.newValue)
            ? changes.tagsOrder.newValue
            : [];
        }
        if (changes.enableTags || changes.tagsOrder) {
          initFormTags();
          refreshPromptListView();
        } else if (changes.activeTagFilter) {
          updateTagsFilterSelection();
          refreshFilteredPromptList();
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
  }

  // COMMENT: Refresh UI whenever prompts change in storage
  PromptStorage.onPromptsChanged(refreshPromptListView);

  // COMMENT: React to permissions updates live (permissions page writes aiProvidersMap)
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.aiProvidersMap) {
        cachedProvidersMap = changes.aiProvidersMap.newValue || null;
        cachedPermissionAllowed = null;
        renderPermissionsGate();
        // COMMENT: Also refresh the LLMs section so pills reflect new activation status
        renderLLMsSection();
      }
    });
  } catch (err) {
    // Ignore if not available
  }

  // Add or update prompt
  form.addEventListener('submit', event => {
    event.preventDefault();
    const title = titleInput.value.trim();
    const content = contentInput.value;
    const tags = formTagInput ? formTagInput.getTags() : [];

    if (uuidInput.value === '') {
      // COMMENT: Add new prompt via unified manager
      PromptStorage.savePrompt({ title, content, tags }).catch(console.error);
    } else {
      // COMMENT: Update existing prompt by uuid via unified manager
      PromptStorage.updatePrompt(uuidInput.value, { title, content, tags }).catch(console.error);
    }

    // Reset form and return to the prompt list
    resetPromptForm();
  });

  // Back / cancel from composer
  cancelButton.addEventListener('click', () => {
    resetPromptForm();
  });
});
