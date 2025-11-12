/* ============================================================================
   Prompt Manager Content Script (content.js)

   Table of Contents
   [01] Global styles injection
   [02] Utilities (createEl, debounce)
   [03] Theme helpers (getMode, getIconFilter, showEl, hideEl, Theme)
   [04] Selector helpers ($root, qs)
   [05] Panel routing (PanelView, PanelRouter)
   [06] Outside click closer
   [07] Keyboard manager
   [08] Dark mode state
   [09] Event bus
   [10] Storage manager
   [11] Icon SVGs
   [12] PromptUI internal modules
   [13] PromptUIManager (public UI API)
   [14] PromptProcessor (variables)
   [15] PromptMediator (event wiring)
   [16] Bootstrapping
   ============================================================================ */

/* ============================================================================
   [01] Global Styles Injection
   COMMENT: Ensure base CSS is present before any UI is mounted.
   ============================================================================ */
injectGlobalStyles();

/* ---------------------------------------------------------------------------
 * [02] Config & Constants
 * COMMENT: Centralized timings and reusable constants.
 * -------------------------------------------------------------------------*/
const HIDE_ANIMATION_MS = 200;
const MUTATION_DEBOUNCE_MS = 300;
const SEARCH_FOCUS_DELAY_MS = 50;
const ONBOARDING_AUTO_HIDE_MS = 10000;
const ONBOARDING_FADE_OUT_MS = 300;
const IMPORT_SUCCESS_RESET_MS = 2000;
// Hot corner indicator sizes (px)
const HOT_CORNER_INDICATOR_SMALL_PX = 20;
const HOT_CORNER_INDICATOR_LARGE_PX = 30;

/* ---------------------------------------------------------------------------
 * [02] Types (JSDoc typedefs)
 * COMMENT: Shapes used across UI/Storage operations.
 * -------------------------------------------------------------------------*/
/**
 * @typedef {Object} Prompt
 * @property {string} uuid
 * @property {string} title
 * @property {string} content
 */
/**
 * @typedef {Object} ButtonPosition
 * @property {number} x
 * @property {number} y
 */
/**
 * @typedef {Object} KeyboardShortcut
 * @property {string} key
 * @property {'metaKey'|'ctrlKey'} modifier
 * @property {boolean} requiresShift
 */
/**
 * @callback OnReorder
 * @param {Prompt[]} newPrompts
 * @returns {void}
 */
/**
 * @callback OnToggle
 * @param {boolean} active
 * @returns {void|Promise<void>}
 */

// [01] Utilities — generic helpers
// Helper function for creating DOM elements
/**
 * Create a DOM element with common options applied.
 * COMMENT: Centralizes element creation to keep callers concise and consistent.
 * @param {string} tag
 * @param {Object} [options]
 * @param {string} [options.id]
 * @param {string} [options.className]
 * @param {Object<string,string>} [options.styles]
 * @param {Object<string,string>} [options.attributes]
 * @param {string} [options.innerHTML]
 * @param {Object<string,Function>} [options.eventListeners]
 * @returns {HTMLElement}
 */
const createEl = (tag, { id, className, styles, attributes, innerHTML, eventListeners } = {}) => {
  const el = document.createElement(tag);
  if (id) el.id = id;
  if (className) el.className = className;
  if (styles) Object.assign(el.style, styles);
  if (attributes) Object.entries(attributes).forEach(([k, v]) => el.setAttribute(k, v));
  if (innerHTML) el.innerHTML = innerHTML;
  if (eventListeners) Object.entries(eventListeners).forEach(([evt, handler]) => el.addEventListener(evt, handler));
  return el;
};

/* ---------------------------------------------------------------------------
 * [01] Utility: debounce
 * Provides a simple debounce wrapper to coalesce rapid successive calls.
 * Example: const debouncedFn = debounce(() => console.log('run'), 300);
 * -------------------------------------------------------------------------*/
/**
 * Debounce a function so it runs after a quiet period.
 * COMMENT: Prevents excessive executions during rapid events.
 * @template T
 * @param {(...args: any[]) => T} fn
 * @param {number} [wait=100]
 * @returns {(...args: any[]) => void}
 */
const debounce = (fn, wait = 100) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(null, args), wait);
  };
};

// [02] Theme helpers — centralize theme and basic UI show/hide behavior
// Helper functions for theme and UI manipulation
const getMode = () => (isDarkMode() ? 'dark' : 'light');
// Centralize the computed CSS filter used for icons based on theme
const getIconFilter = () => (
  isDarkMode()
    ? 'invert(93%) sepia(0%) saturate(0%) hue-rotate(213deg) brightness(107%) contrast(87%)'
    : 'invert(37%) sepia(74%) saturate(380%) hue-rotate(175deg) brightness(93%) contrast(88%)'
);
/**
 * Show an element with Prompt Manager visibility semantics.
 * COMMENT: Uses CSS class toggles and respectful display values.
 * @param {HTMLElement} el
 */
const showEl = el => {
  // Respect intended display for our panel
  const isPromptList = el.classList && el.classList.contains('opm-prompt-list');
  el.style.display = isPromptList ? 'flex' : 'block';
  void el.offsetHeight;
  el.classList.add('opm-visible');
};
/**
 * Hide an element with a short delay for transitions.
 * COMMENT: Resets list item displays to avoid sticky filters on next open.
 * @param {HTMLElement} el
 */
const hideEl = el => {
  el.classList.remove('opm-visible');
  setTimeout(() => {
    el.style.display = 'none';
    const items = el.querySelector(`.${SELECTORS.PROMPT_ITEMS_CONTAINER}`);
    if (items) Array.from(items.children).forEach(i => i.style.display = 'flex');
  }, HIDE_ANIMATION_MS);
};

/* ---------------------------------------------------------------------------
 * [02] Theme helper, centralize applying light/dark class across our subtree
 * -------------------------------------------------------------------------*/
const Theme = {
  // Apply current mode class to a single node
  applyNode(node) {
    if (!node) return;
    node.classList?.remove('opm-light', 'opm-dark');
    node.classList?.add(`opm-${getMode()}`);
  },
  // Apply to all nodes that opt into theming within our root
  applyAll() {
    const root = document.getElementById(SELECTORS.ROOT);
    if (!root) return;
    // Root carries mode for global styles
    root.classList.toggle('opm-dark', isDarkMode());
    root.classList.toggle('opm-light', !isDarkMode());
    // Update all nodes that have any opm-* class
    const themedNodes = root.querySelectorAll('[class*="opm-"]');
    themedNodes.forEach(el => this.applyNode(el));
  }
};

/* ---------------------------------------------------------------------------
 * [03] Selector helpers (scoped under our root)
 * COMMENT: Small helpers to reduce query noise and keep scope consistent.
 * -------------------------------------------------------------------------*/
const $root = () => document.getElementById(SELECTORS.ROOT);
const qs = (sel, root = $root()) => (root ? root.querySelector(sel) : null);

/* ---------------------------------------------------------------------------
 * [04] Panel view states and tiny router
 * COMMENT: Centralizes view switching and search visibility.
 * -------------------------------------------------------------------------*/
const PanelView = Object.freeze({
  LIST: 'LIST',
  CREATE: 'CREATE',
  EDIT: 'EDIT',
  SETTINGS: 'SETTINGS',
  HELP: 'HELP',
  CHANGELOG: 'CHANGELOG'
});

const PanelRouter = (() => {
  let currentView = null;

  // Build nodes for non-list views; list view uses refresh to rebuild the panel
  const buildView = async (view) => {
    if (view === PanelView.CREATE) {
      return PromptUIManager.createPromptCreationForm('');
    }
    if (view === PanelView.EDIT) {
      return await PromptUIManager.createEditView();
    }
    if (view === PanelView.SETTINGS) {
      return PromptUIManager.createSettingsForm();
    }
    if (view === PanelView.HELP) {
      // Build Help container and populate asynchronously
      const dark = isDarkMode();
      const container = createEl('div', { className: `opm-form-container opm-${getMode()}`, styles: { padding: '0', display: 'flex', flexDirection: 'column', gap: '4px' } });
      const title = createEl('div', { styles: { fontWeight: 'bold', fontSize: '16px', marginBottom: '6px' }, innerHTML: 'Navigation & Features' });
      const info = createEl('div', { id: SELECTORS.INFO_CONTENT, styles: { maxHeight: '410px', overflowY: 'auto', padding: '4px', borderRadius: '6px', color: dark ? THEME_COLORS.inputDarkText : THEME_COLORS.inputLightText } });
      container.append(title, info);
      fetch(chrome.runtime.getURL('info.html')).then(r => r.text()).then(html => { info.innerHTML = html; });
      return container;
    }
    if (view === PanelView.CHANGELOG) {
      // Build Changelog container and populate asynchronously
      const dark = isDarkMode();
      const container = createEl('div', { className: `opm-form-container opm-${getMode()}`, styles: { padding: '0', display: 'flex', flexDirection: 'column', gap: '6px' } });
      const title = createEl('div', { styles: { fontWeight: 'bold', fontSize: '16px', marginBottom: '6px' }, innerHTML: 'Changelog' });
      const info = createEl('div', { id: SELECTORS.CHANGELOG_CONTENT, styles: { maxHeight: '410px', overflowY: 'auto', padding: '4px', borderRadius: '6px', color: dark ? THEME_COLORS.inputDarkText : THEME_COLORS.inputLightText } });
      container.append(title, info);
      fetch(chrome.runtime.getURL('changelog.html')).then(r => r.text()).then(html => { info.innerHTML = html; });
      return container;
    }
    return null;
  };

    const mount = async (view) => {
    // Always rebuild EDIT to reflect latest prompt order; keep other views cached
    if (currentView === view && ![PanelView.LIST, PanelView.EDIT].includes(view)) {
      const listEl = qs(`#${SELECTORS.PROMPT_LIST}`);
      if (listEl) PromptUIManager.showPromptList(listEl);
      return;
    }
    currentView = view;

    const listEl = qs(`#${SELECTORS.PROMPT_LIST}`);
    if (!listEl) return;

    if (view === PanelView.LIST) {
      // COMMENT: Variable height for list view (grow up to 400px)
      PromptUIManager.setPanelHeightMode('variable');
      const prompts = await PromptStorageManager.getPrompts();
      // COMMENT: Restore persisted tag (fall back to 'all') when entering LIST view
      try {
        const savedTag = await PromptStorageManager.getActiveTagFilter();
        PromptUIManager.activeTagFilter = savedTag || 'all';
      } catch (_) {
        PromptUIManager.activeTagFilter = 'all';
      }
      PromptUIManager.refreshPromptList(prompts);
      // COMMENT: Apply the persisted tag so tags bar and items align immediately
      PromptUIManager.filterByTag(PromptUIManager.activeTagFilter);
      // Search visible only on list view
      PromptUIManager.setSearchVisibility(true);
      PromptUIManager.showPromptList(listEl);
      Theme.applyAll();
      return;
    }

    // Non-list views build a node and replace panel content
    const node = await buildView(view);
    if (node) {
      PromptUIManager.resetPromptListContainer();
      PromptUIManager.replacePanelMainContent(node);
    }
      // COMMENT: Fixed height for non-list views (400px)
      PromptUIManager.setPanelHeightMode('fixed');
    // Ensure list is visible first, then set search visibility so it isn't overridden
    PromptUIManager.showPromptList(listEl);
    // Show search for EDIT view as well; hide for others
    if (view === PanelView.EDIT) PromptUIManager.setSearchVisibility(true); else PromptUIManager.setSearchVisibility(false);
    Theme.applyAll();
  };

  return { mount };
})();

/* ---------------------------------------------------------------------------
 * [05] Centralized outside-click closer
 * COMMENT: Single document-level handler that works for both modes.
 * -------------------------------------------------------------------------*/
const OutsideClickCloser = (() => {
  let attached = false;
  const handler = e => {
    const listEl = qs(`#${SELECTORS.PROMPT_LIST}`);
    if (!listEl || !listEl.classList.contains('opm-visible')) return;
    const isMenu = e.target.closest(`#${SELECTORS.PROMPT_LIST}`)
      || e.target.closest(`.${SELECTORS.PROMPT_ITEMS_CONTAINER}`)
      || e.target.closest('.opm-icon-button')
      || e.target.closest('.opm-form-container')
      || e.target.closest('.opm-button');
    if (!isMenu) PromptUIManager.hidePromptList(listEl);
  };
  return {
    ensure() {
      if (attached) return;
      document.addEventListener('click', handler);
      attached = true;
    }
  };
})();

/* [07] Keyboard Manager (moved here for logical proximity to global handlers) */
class KeyboardManager {
  static initialized = false;
  static shortcutCache = null;

  static initialize() {
    if (KeyboardManager.initialized) return;
    KeyboardManager.initialized = true;
    document.addEventListener('keydown', KeyboardManager._onKeyDown);
    // COMMENT: Load shortcut once and keep it synced on storage changes
    KeyboardManager._loadShortcut();
    KeyboardManager._attachShortcutWatcher();
  }

  static async _onKeyDown(e) {
    // 1) Global toggle shortcut (use cached value; fall back to one-time fetch)
    const shortcut = KeyboardManager.shortcutCache || await PromptStorageManager.getKeyboardShortcut();
    if (!KeyboardManager.shortcutCache && shortcut) KeyboardManager.shortcutCache = shortcut;
    if (e[shortcut.modifier] && (shortcut.requiresShift ? e.shiftKey : true) && e.key.toLowerCase() === shortcut.key.toLowerCase()) {
      e.preventDefault();
      KeyboardManager._togglePromptList();
      return;
    }

    // 2) Escape to close if open
    if (e.key === 'Escape') {
      PromptUIManager.handleGlobalEscape(e);
      return;
    }

    // 3) Navigation when list is open (context-aware)
    const searchEl = document.getElementById(SELECTORS.PROMPT_SEARCH_INPUT);
    const isSearchActive = document.activeElement === searchEl;
    if (['ArrowUp', 'ArrowDown', 'Enter'].includes(e.key)) {
      PromptUIManager.handleKeyboardNavigation(e, isSearchActive ? 'search' : 'list');
    }
  }

  static async _togglePromptList() {
    const listEl = qs(`#${SELECTORS.PROMPT_LIST}`);
    if (!listEl) return;
    if (listEl.classList.contains('opm-visible')) {
      PromptUIManager.hidePromptList(listEl);
    } else { // Mark as manually opened
      PromptUIManager.manuallyOpened = true;
      await PromptUIManager.mountListOrCreateBasedOnPrompts();
    }
  }

  // COMMENT: Load current keyboard shortcut into cache
  static async _loadShortcut() {
    try {
      KeyboardManager.shortcutCache = await PromptStorageManager.getKeyboardShortcut();
    } catch (_) { /* COMMENT: ignore */ }
  }

  // COMMENT: Watch storage for keyboard shortcut changes and update cache
  static _attachShortcutWatcher() {
    if (!chrome || !chrome.storage || !chrome.storage.onChanged) return;
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes && changes.keyboardShortcut && changes.keyboardShortcut.newValue) {
        KeyboardManager.shortcutCache = changes.keyboardShortcut.newValue;
      }
    });
  }
}

/* =========================================================================
   Inject Global Styles (
   ============================================================================ */
injectGlobalStyles();

// Dark Mode Handling
/* ---------------------------------------------------------------------------
 * Theme handling (dark / light) with subscription hook
 * -------------------------------------------------------------------------*/
let isDarkModeActive = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
let isDarkModeForced = false; // when true, override to dark regardless of OS

/* Read current mode */
const isDarkMode = () => (isDarkModeForced ? true : isDarkModeActive);

/* Listen to OS-level preference changes */
if (window.matchMedia) {
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  mql.addEventListener('change', e => {
    isDarkModeActive = e.matches;
    PromptUIManager.updateThemeForUI();
  });
}

/* [08] Simple Event Bus */
class EventBus {
  constructor() { this.events = {}; }
  on(evt, listener) { (this.events[evt] = this.events[evt] || []).push(listener); }
  emit(evt, ...args) { (this.events[evt] || []).forEach(fn => fn(...args)); }
}

/* [09] Storage Manager */
class PromptStorageManager {
  // Generic local-storage helpers (still used by non-prompt features)
  static getData(key, def) {
    return new Promise(resolve => {
      try {
        chrome.storage.local.get(key, data => {
          if (chrome.runtime.lastError) { console.warn(chrome.runtime.lastError.message); resolve(def); return; }
          resolve(data[key] !== undefined && data[key] !== null ? data[key] : def);
        });
      } catch (err) { console.error(err); resolve(def); }
    });
  }

  static setData(key, value) {
    return new Promise(resolve => {
      try {
        if (!chrome.runtime || !chrome.storage) { console.warn('Invalid extension context'); resolve(false); return; }
        chrome.storage.local.set({ [key]: value }, () => {
          if (chrome.runtime.lastError) { console.warn(chrome.runtime.lastError.message); resolve(false); return; }
          resolve(true);
        });
      } catch (err) { console.error(err); resolve(false); }
    });
  }
  // ---- Unified prompt operations ----
  static async _ps() {
    // COMMENT: Use the unified module in `src/promptStorage.js` via a dynamic import
    if (this.__ps) return this.__ps;

    // COMMENT: Dynamically import the web-accessible module so content-scripts can use it
    const mod = await import(chrome.runtime.getURL('promptStorage.js'));

    // COMMENT: Build a thin adapter to keep current call-sites unchanged
    this.__ps = {
      getPrompts: mod.getPrompts,
      setPrompts: mod.setPrompts,
      savePrompt: mod.savePrompt,
      updatePrompt: mod.updatePrompt,
      deletePrompt: mod.deletePrompt,
      importPrompts: mod.importPrompts
    };
    return this.__ps;
  }

  static async getPrompts() {
    const ps = await this._ps();
    return await ps.getPrompts();
  }

  static async savePrompt(prompt) {
    const ps = await this._ps();
    return await ps.savePrompt(prompt);
  }

  static async setPrompts(prompts) {
    // COMMENT: Expose bulk set for reorder use-cases via the unified module
    const ps = await this._ps();
    return await ps.setPrompts(prompts);
  }

  static async mergeImportedPrompts(imported) {
    const ps = await this._ps();
    // imported may be array or JSON string
    return await ps.importPrompts(imported);
  }
  
  static async getButtonPosition() { return await PromptStorageManager.getData('buttonPosition', { x: 75, y: 100 }); }
  static async saveButtonPosition(pos) {
    const current = await PromptStorageManager.getButtonPosition();
    if (current.x === pos.x && current.y === pos.y) return true;
    return await PromptStorageManager.setData('buttonPosition', pos);
  }
  static async getKeyboardShortcut() {
    const isMac = navigator.platform.toUpperCase().includes('MAC');
    return await PromptStorageManager.getData('keyboardShortcut', {
      key: isMac ? 'p' : 'm',
      modifier: isMac ? 'metaKey' : 'ctrlKey',
      requiresShift: isMac
    });
  }
  static async saveKeyboardShortcut(shortcut) { return await PromptStorageManager.setData('keyboardShortcut', shortcut); }
  static async getOnboardingCompleted() { return await PromptStorageManager.getData('onboardingCompleted', false); }
  static async setOnboardingCompleted() { return await PromptStorageManager.setData('onboardingCompleted', true); }
  static async getDisplayMode() { return await PromptStorageManager.getData('displayMode', 'standard'); }
  static async saveDisplayMode(mode) { return await PromptStorageManager.setData('displayMode', mode); }
  static async getForceDarkMode() { return await PromptStorageManager.getData('forceDarkMode', false); }
  static async saveForceDarkMode(enabled) { return await PromptStorageManager.setData('forceDarkMode', !!enabled); }

  // COMMENT: Preference to append prompts instead of overwriting the input area
  static async getDisableOverwrite() {
    // COMMENT: Default is false (overwrite existing content as before)
    return await PromptStorageManager.getData('disableOverwrite', false);
  }
  static async saveDisableOverwrite(value) {
    // COMMENT: Persist the user's preference for append vs overwrite
    return await PromptStorageManager.setData('disableOverwrite', !!value);
  }

  // COMMENT: Feature flag for tags in prompt creation UI (off by default)
  static async getEnableTags() {
    return await PromptStorageManager.getData('enableTags', false);
  }
  static async saveEnableTags(value) {
    return await PromptStorageManager.setData('enableTags', !!value);
  }

  // COMMENT: Persist the active tag filter across sessions (LIST view)
  static async getActiveTagFilter() {
    return await PromptStorageManager.getData('activeTagFilter', 'all');
  }
  static async saveActiveTagFilter(tag) {
    const clean = (tag || 'all');
    return await PromptStorageManager.setData('activeTagFilter', clean);
  }

  // COMMENT: Persistent custom display order for tags in settings (array of tag names)
  static async getTagsOrder() {
    return await PromptStorageManager.getData('tagsOrder', []);
  }
  static async saveTagsOrder(order) {
    if (!Array.isArray(order)) return false;
    return await PromptStorageManager.setData('tagsOrder', order);
  }
}

/* [03b] Icon SVGs (depends on theme helpers for getIconFilter) */
const ICON_SVGS = {
  // COMMENT: Use centralized filter generator for consistency and easier maintenance
  list: `<img src="${chrome.runtime.getURL('icons/list.svg')}" width="16" height="16" alt="List Prompts" title="List Prompts" style="filter: ${getIconFilter()}">`,
  add: `<img src="${chrome.runtime.getURL('icons/new.svg')}" width="16" height="16" alt="Add Prompt" title="Add Prompt" style="filter: ${getIconFilter()}">`,
  delete: `<img src="${chrome.runtime.getURL('icons/delete.svg')}" width="16" height="16" alt="Delete" title="Delete" style="filter: ${getIconFilter()}">`,
  edit: `<img src="${chrome.runtime.getURL('icons/edit.svg')}" width="16" height="16" alt="Edit" title="Edit" style="filter: ${getIconFilter()}">`,
  settings: `<img src="${chrome.runtime.getURL('icons/settings.svg')}" width="16" height="16" alt="Settings" title="Settings" style="filter: ${getIconFilter()}">`,
  help: `<img src="${chrome.runtime.getURL('icons/help.svg')}" width="16" height="16" alt="Help" title="Help" style="filter: ${getIconFilter()}">`,
  changelog: `<img src="${chrome.runtime.getURL('icons/notes.svg')}" width="16" height="16" alt="Changelog" title="Changelog" style="filter: ${getIconFilter()}">`,
};

/* ---------------------------------------------------------------------------
 * Tags: Service + UI
 * COMMENT: Centralize tag counts/order/suggestions and a reusable tag input.
 * -------------------------------------------------------------------------*/
const TagService = (() => {
  // COMMENT: Compute tag counts from provided prompts or storage
  const computeCounts = (prompts = []) => {
    const counts = new Map();
    prompts.forEach(p => (Array.isArray(p.tags) ? p.tags : []).forEach(t => {
      const key = String(t).trim();
      if (!key) return;
      counts.set(key, (counts.get(key) || 0) + 1);
    }));
    return counts;
  };

  const getCounts = async (prompts) => {
    if (!Array.isArray(prompts)) {
      try { prompts = await PromptStorageManager.getPrompts(); } catch (_) { prompts = []; }
    }
    return computeCounts(prompts);
  };

  // COMMENT: Order tags based on saved order, append unseen alphabetically
  const getOrderedTags = async (countsOrPrompts) => {
    const counts = countsOrPrompts instanceof Map ? countsOrPrompts : await getCounts(countsOrPrompts);
    const order = await PromptStorageManager.getTagsOrder();
    const tags = Array.from(counts.keys());
    const missing = tags.filter(t => !order.includes(t)).sort((a, b) => a.localeCompare(b));
    return [...order.filter(t => counts.has(t)), ...missing];
  };

  // COMMENT: Suggestions honor user order, filter by term, exclude selected
  const getSuggestions = async ({ term = '', exclude = new Set() } = {}) => {
    const counts = await getCounts();
    const ordered = await getOrderedTags(counts);
    const lcTerm = term.trim().toLowerCase();
    return ordered.filter(t => !exclude.has(t) && (lcTerm === '' || String(t).toLowerCase().includes(lcTerm)));
  };

  return { getCounts, getOrderedTags, getSuggestions };
})();

const TagUI = (() => {
  // COMMENT: Build a reusable tags input with pills + suggestions. Returns { element, getTags }
  const createTagInput = ({ initialTags = [] } = {}) => {
    const tagsSet = new Set(Array.isArray(initialTags) ? initialTags : []);
    const row = createEl('div', { className: `opm-tag-row opm-${getMode()}` });
    const pills = createEl('div', { className: 'opm-tags-container' });
    const input = createEl('input', { attributes: { type: 'text', placeholder: 'Tags' }, className: `opm-tag-input opm-${getMode()}` });
    const suggestions = createEl('div', { className: `opm-tag-suggestions opm-${getMode()}`, styles: { display: 'none' } });
    let activeIndex = -1; let options = [];

    // COMMENT: Render current pills from the set
    const renderPills = () => {
      pills.innerHTML = '';
      Array.from(tagsSet).forEach(tag => {
        const pill = createEl('span', { className: `opm-tag-pill opm-${getMode()}`, innerHTML: String(tag) });
        const removeBtn = createEl('button', { className: 'opm-tag-remove', innerHTML: '×' });
        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          tagsSet.delete(tag);
          if (pill && pill.parentNode) pill.parentNode.removeChild(pill);
        });
        pill.appendChild(removeBtn);
        pills.appendChild(pill);
      });
    };

    const mountSuggestionsPortal = () => {
      const root = document.getElementById(SELECTORS.ROOT) || document.body;
      if (suggestions.parentElement !== root) root.appendChild(suggestions);
      suggestions.style.position = 'fixed';
      suggestions.style.zIndex = '100000';
    };

    const positionSuggestions = () => {
      const rect = row.getBoundingClientRect();
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
      suggestions.style.display = 'none';
    };

    const refreshSuggestions = async () => {
      options = await TagService.getSuggestions({ term: input.value, exclude: tagsSet });
      suggestions.innerHTML = '';
      options.forEach((t, idx) => {
        const item = createEl('div', { className: 'opm-tag-suggestion-item', innerHTML: t });
        if (idx === activeIndex) item.classList.add('active');
        item.addEventListener('mousedown', e => { e.preventDefault(); addTag(t); input.value = ''; suggestions.style.display = 'none'; });
        suggestions.appendChild(item);
      });
      if (options.length > 0) {
        mountSuggestionsPortal();
        positionSuggestions();
        suggestions.style.display = 'block';
      } else {
        suggestions.style.display = 'none';
      }
    };

    input.addEventListener('input', () => {
      activeIndex = -1;
      const term = input.value.trim();
      if (term.length === 0) { suggestions.style.display = 'none'; options = []; return; }
      refreshSuggestions();
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); if (activeIndex >= 0 && activeIndex < options.length) { addTag(options[activeIndex]); input.value = ''; } else { addTag(input.value); input.value = ''; } suggestions.style.display = 'none'; }
      if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex = Math.min(activeIndex + 1, options.length - 1); refreshSuggestions(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); activeIndex = Math.max(activeIndex - 1, -1); refreshSuggestions(); }
      if (e.key === 'Escape') { suggestions.style.display = 'none'; }
    });
    input.addEventListener('focus', () => { suggestions.style.display = 'none'; });
    input.addEventListener('blur', () => { suggestions.style.display = 'none'; });
    document.addEventListener('click', (evt) => { if (!suggestions.contains(evt.target)) suggestions.style.display = 'none'; });
    window.addEventListener('resize', positionSuggestions);
    window.addEventListener('scroll', positionSuggestions, true);

    renderPills();
    row.append(pills, input);
    return { element: row, getTags: () => Array.from(tagsSet) };
  };

  return { createTagInput };
})();

/* ============================================================================
   PromptUI namespace (internal modules)
   - State: ephemeral UI state and timers
   - Elements: pure DOM factory helpers
   - Views: build composite views from Elements/PromptUIManager helpers
   - Behaviors: show/hide, timers, simple visual behaviors
   - Events: event wiring for button and list interactions
   These are used internally by PromptUIManager to keep the public API stable.
   ============================================================================ */
const PromptUI = (() => {
  // Holds ephemeral UI state and references to timers
  const State = {
    manuallyOpened: false,
    inVariableInputMode: false,
    closeTimer: null
  };

  // Pure DOM factory helpers. Keep side-effects out; only build elements.
  const Elements = {
    // Build the unified list content container (items + menu)
    createPanelContent() {
      return createEl('div', { id: SELECTORS.PANEL_CONTENT });
    },
    // Build a horizontal, scrollable tag filter bar for LIST view only
    // COMMENT: One-line scrollable pills with an "All" pill; clicking filters prompt items by tag without changing panel height
    createTagsBar({ tags = [], counts = new Map(), onSelect, selectedTag = 'all' } = {}) {
      // Container: CSS handles layout and separator
      const bar = createEl('div', { className: `opm-tags-filter-bar opm-${getMode()}` });

      // Helper to style a pill (button) with selected state
      const makePill = (label, isSelected = false) => {
        const pill = createEl('button', { className: `opm-tag-pill-filter opm-${getMode()}`, attributes: { 'aria-pressed': String(!!isSelected) } });
        pill.textContent = label;
        return pill;
      };

      // Maintain selected state locally for visual updates
      let current = selectedTag || 'all';
      const updateSelected = (nextTag) => {
        current = nextTag;
        Array.from(bar.children).forEach(child => {
          const isSelected = child.dataset && child.dataset.tag === current;
          child.setAttribute('aria-pressed', String(isSelected));
        });
      };

      // Always include an "All" pill first
      const allPill = makePill('All', (selectedTag || 'all') === 'all');
      allPill.dataset.tag = 'all';
      allPill.addEventListener('click', e => { e.stopPropagation(); if (typeof onSelect === 'function') onSelect('all'); updateSelected('all'); });
      bar.appendChild(allPill);

      // Add one pill per tag (only tags with counts > 0 supplied by caller)
      tags.forEach(tag => {
        const count = counts.get(tag) || 0;
        const pill = makePill(count > 0 ? `${tag}` : tag, (selectedTag || 'all') === tag);
        pill.dataset.tag = tag;
        pill.addEventListener('click', e => { e.stopPropagation(); if (typeof onSelect === 'function') onSelect(tag); updateSelected(tag); });
        bar.appendChild(pill);
      });

      return bar;
    },
    // Create the scrollable items container
    createItemsContainer() {
      // Mark this as the dedicated Prompt List view container
      return createEl('div', { className: `${SELECTORS.PROMPT_ITEMS_CONTAINER} opm-prompt-list-items opm-view-list opm-${getMode()}` });
    },
    // Create a single prompt list item element
    createPromptItem(prompt) {
      const item = createEl('div', {
        className: `opm-prompt-list-item opm-${getMode()}`,
        eventListeners: {
          click: () => PromptUIManager.emitPromptSelect(prompt),
          mouseenter: () => {
            document.querySelectorAll(`#${SELECTORS.ROOT} .opm-prompt-list-item`).forEach(i => i.classList.remove('opm-keyboard-selected'));
            PromptUIManager.cancelCloseTimer();
          }
        }
      });
      const text = createEl('div', { styles: { flex: '1' } });
      text.textContent = prompt.title;
      item.appendChild(text);
      item.dataset.title = prompt.title.toLowerCase();
      item.dataset.content = prompt.content.toLowerCase();
      // COMMENT: Include tags in dataset for search filtering (space-joined, lowercased)
      item.dataset.tags = Array.isArray(prompt.tags) ? prompt.tags.map(t => String(t).toLowerCase()).join(' ') : '';
      // COMMENT: Store exact tag list (lowercased) as JSON to avoid space-splitting issues when matching exact tag pills
      item.dataset.tagsList = JSON.stringify(Array.isArray(prompt.tags) ? prompt.tags.map(t => String(t).toLowerCase()) : []);
      return item;
    },
    // Create an icon button for the bottom menu
    createIconButton(type, onClick) {
      return createEl('button', { className: 'opm-icon-button', eventListeners: { click: onClick }, innerHTML: ICON_SVGS[type] || '' });
    },
    // Build the horizontal menu bar with action icon buttons
    createMenuBar() {
      const bar = createEl('div', { styles: { display: 'flex', alignItems: 'center', justifyContent: 'space-evenly', width: '100%' } });
      const btns = ['list', 'add', 'edit', 'help', 'changelog', 'settings'];
      // COMMENT: Ensure manual flag set before action handlers
      const actions = {
        list: e => { e.stopPropagation(); PromptUIManager.manuallyOpened = true; PanelRouter.mount(PanelView.LIST); },
        add: e => { e.stopPropagation(); PromptUIManager.manuallyOpened = true; PanelRouter.mount(PanelView.CREATE); },
        edit: e => { e.stopPropagation(); PromptUIManager.manuallyOpened = true; PanelRouter.mount(PanelView.EDIT); },
        settings: e => { e.stopPropagation(); PromptUIManager.manuallyOpened = true; PanelRouter.mount(PanelView.SETTINGS); },
        help: e => { e.stopPropagation(); PromptUIManager.manuallyOpened = true; PanelRouter.mount(PanelView.HELP); },
        changelog: e => { e.stopPropagation(); PromptUIManager.manuallyOpened = true; PanelRouter.mount(PanelView.CHANGELOG); },
      };
      btns.forEach(type => bar.appendChild(Elements.createIconButton(type, actions[type])));
      return bar;
    },
    // COMMENT: Create the bottom menu container including search and the menu bar
    createBottomMenu() {
      const menu = createEl('div', {
        className: `opm-bottom-menu opm-${getMode()}`,
        styles: { display: 'flex', flexDirection: 'column', gap: '10px', padding: '10px 10px 5px 10px', borderTop: '1px solid var(--light-border)' }
      });
      const search = createEl('input', {
        id: SELECTORS.PROMPT_SEARCH_INPUT,
        className: `opm-search-input opm-${getMode()}`,
        attributes: { type: 'text', placeholder: 'Type to search', style: 'border-radius: 4px;' }
      });
      search.addEventListener('input', e => { PromptUIManager.filterPromptItems(e.target.value); });
      menu.appendChild(search);
      menu.appendChild(Elements.createMenuBar());
      return menu;
    },

    // Create a reusable toggle row for settings with async initial state and custom save logic
    createToggleRow({ labelText, getValue, onToggle }) {
      const row = createEl('div', { styles: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } });
      const label = createEl('label', { innerHTML: labelText, styles: { fontSize: '14px' } });
      const toggleSwitch = createEl('div', {
        className: `opm-toggle-switch opm-${getMode()}`,
        eventListeners: {
          click: async e => {
            e.stopPropagation();
            toggleSwitch.classList.toggle('active');
            const active = toggleSwitch.classList.contains('active');
            try { await onToggle(active); } catch (_) { /* COMMENT: ignore save failures silently */ }
          }
        }
      });
      // Initialize active state
      Promise.resolve()
        .then(() => getValue?.())
        .then((active) => {
          if (active) toggleSwitch.classList.add('active'); else toggleSwitch.classList.remove('active');
        })
        .catch(() => { /* COMMENT: default remains off */ });
      row.append(label, toggleSwitch);
      return row;
    }
  };

  // Drag & Drop reorder helper for Edit view
  const Reorder = {
    attach(promptsContainer, prompts, onReorder) {
      const placeholder = createEl('div', { className: 'opm-drop-placeholder' });
      let dropIndex = null;

      const itemNodes = () => Array.from(promptsContainer.children)
        .filter(n => n.classList && n.classList.contains('opm-prompt-list-item'));

      const computeContainerDropPosition = (clientY) => {
        const nodes = itemNodes();
        if (nodes.length === 0) { dropIndex = 0; return; }
        for (let i = 0; i < nodes.length; i++) {
          const node = nodes[i];
          const rect = node.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          if (clientY < midY) {
            placeholder.style.height = `${rect.height}px`;
            if (node.previousSibling !== placeholder) {
              promptsContainer.insertBefore(placeholder, node);
            }
            dropIndex = parseInt(node.dataset.index, 10);
            return;
          }
        }
        const last = nodes[nodes.length - 1];
        const lastRect = last.getBoundingClientRect();
        placeholder.style.height = `${lastRect.height}px`;
        if (last.nextSibling !== placeholder) {
          promptsContainer.insertBefore(placeholder, last.nextSibling);
        }
        dropIndex = prompts.length;
      };

      const handleDrop = e => {
        e.preventDefault();
        e.stopPropagation();
        const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
        if (Number.isNaN(from)) return;
        let to = dropIndex !== null ? dropIndex : prompts.length;
        if (from < to) to = to - 1;
        if (from === to) {
          if (placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
          dropIndex = null;
          return;
        }
        const newPrompts = [...prompts];
        const [moved] = newPrompts.splice(from, 1);
        newPrompts.splice(Math.max(0, Math.min(newPrompts.length, to)), 0, moved);
        if (placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
        dropIndex = null;
        onReorder(newPrompts);
      };

      promptsContainer.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        computeContainerDropPosition(e.clientY);
      });
      promptsContainer.addEventListener('drop', handleDrop);

      const wireItem = (item, idx, dragHandle) => {
        // Ensure drop is allowed when hovering over items, and set precise placeholder position
        item.addEventListener('dragover', e => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          const rect = item.getBoundingClientRect();
          const offset = e.clientY - rect.top;
          const placeBefore = offset < rect.height / 2;
          placeholder.style.height = `${rect.height}px`;
          if (placeBefore) {
            if (item.previousSibling !== placeholder) {
              item.parentNode.insertBefore(placeholder, item);
            }
            dropIndex = parseInt(item.dataset.index, 10);
          } else {
            if (item.nextSibling !== placeholder) {
              item.parentNode.insertBefore(placeholder, item.nextSibling);
            }
            dropIndex = parseInt(item.dataset.index, 10) + 1;
          }
        });
        dragHandle.setAttribute('draggable', 'true');
        dragHandle.addEventListener('dragstart', e => {
          e.stopPropagation();
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', idx);
          dropIndex = idx;
          item.classList.add('opm-dragging');
          const rect = item.getBoundingClientRect();
          const offsetX = e.clientX - rect.left;
          const offsetY = e.clientY - rect.top;
          if (typeof e.dataTransfer.setDragImage === 'function') {
            e.dataTransfer.setDragImage(item, offsetX, offsetY);
          }
        });
        dragHandle.addEventListener('dragend', e => {
          e.stopPropagation();
          item.classList.remove('opm-dragging');
          if (placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
          dropIndex = null;
        });
      };

      return { wireItem };
    }
  };

  // View composition: UI sections using Elements and Manager helpers
  const Views = {
    // Generic prompt form builder used by Create and Edit flows
    createPromptForm({ initialTitle = '', initialContent = '', submitLabel = 'Save', onSubmit }) {
      const form = createEl('div', { className: `opm-form-container opm-create-form opm-${getMode()}`, styles: { padding: '0', display: 'flex', flexDirection: 'column', gap: '4px' } });
      const titleIn = createEl('input', { attributes: { placeholder: 'Prompt Title' }, className: `opm-input-field opm-${getMode()}`, styles: { borderRadius: '4px' } });
      const contentArea = createEl('textarea', {
        attributes: { placeholder: 'Write your prompt. Use hashtags for #variables#' },
        className: `opm-textarea-field opm-${getMode()}`,
        // COMMENT: Let the textarea grow to fill available space within the container
        styles: { flex: '1 1 auto', minHeight: '0', height: 'auto' }
      });
      titleIn.value = initialTitle;
      contentArea.value = initialContent;
      const saveBtn = createEl('button', { innerHTML: submitLabel, className: `opm-button opm-${getMode()}` });
      saveBtn.addEventListener('click', async e => {
        e.stopPropagation();
        const t = titleIn.value.trim(), c = contentArea.value.trim();
        if (!t || !c) { alert('Please fill in both title and content.'); return; }
        if (typeof onSubmit === 'function') await onSubmit({ title: t, content: c });
      });
      form.append(titleIn, contentArea, saveBtn);
      form.addEventListener('click', e => e.stopPropagation());
      return form;
    },
    // Render prompt list (items + bottom menu) and return the content node
    renderPromptList(prompts = []) {
      const content = Elements.createPanelContent();
      // COMMENT: Insert a tags bar host first so it appears on top of the panel/list
      const tagsHost = createEl('div', { className: `opm-tags-filter-host opm-${getMode()}`, styles: { display: 'none' } });
      content.appendChild(tagsHost);
      const itemsContainer = Elements.createItemsContainer();
      prompts.forEach(p => itemsContainer.appendChild(Elements.createPromptItem(p)));
      content.appendChild(itemsContainer);
      content.appendChild(Elements.createBottomMenu());

      // COMMENT: Build the tag pills asynchronously using TagService
      (async () => {
        try {
          const enableTags = await PromptStorageManager.getEnableTags();
          if (!enableTags) { tagsHost.style.display = 'none'; return; }
          const counts = await TagService.getCounts(prompts);
          if (counts.size === 0) { tagsHost.style.display = 'none'; return; }
          const ordered = await TagService.getOrderedTags(counts);

          // COMMENT: Use persisted tag if available and present in counts
          let persisted = 'all';
          try { persisted = (await PromptStorageManager.getActiveTagFilter() || 'all').toLowerCase(); } catch (_) { persisted = 'all'; }
          const prev = (PromptUIManager.activeTagFilter || persisted || 'all').toLowerCase();
          const selected = prev !== 'all' && counts.has(prev) ? prev : 'all';
          PromptUIManager.activeTagFilter = selected;

          const bar = Elements.createTagsBar({
            tags: ordered,
            counts: counts,
            selectedTag: selected,
            onSelect: (tag) => { PromptUIManager.filterByTag(tag); }
          });
          tagsHost.replaceWith(bar);
          PromptUIManager.filterByTag(selected);
        } catch (_) { tagsHost.style.display = 'none'; }
      })();
      return content;
    },
    // Build the Prompt Creation form view with provided prefill
    async createPromptCreationForm(prefill = '') {
      const search = document.getElementById(SELECTORS.PROMPT_SEARCH_INPUT);
      if (search) search.style.display = 'none';

      // Check if tags feature is enabled
      const enableTags = await PromptStorageManager.getEnableTags();

      // Build creation form with optional tags UI
      const form = createEl('div', { className: `opm-form-container opm-${getMode()}`, styles: { padding: '0', display: 'flex', flexDirection: 'column', gap: '8px' } });
      const titleIn = createEl('input', { attributes: { placeholder: 'Prompt Title' }, className: `opm-input-field opm-${getMode()}`, styles: { borderRadius: '4px' } });
      const contentArea = createEl('textarea', {
        attributes: { placeholder: 'Enter your prompt here. Add variables with #examplevariable#' },
        className: `opm-textarea-field opm-${getMode()}`,
        // COMMENT: Let the textarea grow to fill available space within the container
        styles: { flex: '1 1 auto', minHeight: '0', height: 'auto' }
      });
      titleIn.value = '';
      contentArea.value = prefill || '';

      // Tags UI (reusable)
      let tagsBlock = null;
      let tagInput = null;
      if (enableTags) {
        const label = createEl('label', { styles: { fontSize: '12px', fontWeight: 'bold' } });
        tagInput = TagUI.createTagInput();
        tagsBlock = createEl('div');
        tagsBlock.append(label, tagInput.element);
      }

      const saveBtn = createEl('button', { innerHTML: 'Create Prompt', className: `opm-button opm-${getMode()}` });
      saveBtn.addEventListener('click', async e => {
        e.stopPropagation();
        const t = titleIn.value.trim(), c = contentArea.value.trim();
        if (!t || !c) { alert('Please fill in both title and content.'); return; }
        const tags = enableTags && tagInput ? tagInput.getTags() : [];
        const res = await PromptStorageManager.savePrompt({ title: t, content: c, tags });
        if (!res.success) { alert('Error saving prompt.'); return; }
        PanelRouter.mount(PanelView.LIST);
      });

      form.append(titleIn, contentArea);
      if (tagsBlock) form.append(tagsBlock);
      form.append(saveBtn);
      form.addEventListener('click', e => e.stopPropagation());
      return form;
    },
    // Build the Settings form view
    createSettingsForm() {
      const form = createEl('div', { className: `opm-form-container opm-${getMode()}`, styles: { padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' } });
      const title = createEl('div', { styles: { fontWeight: 'bold', fontSize: '16px', marginBottom: '10px' }, innerHTML: 'Settings' });
      const settings = createEl('div', { styles: { display: 'flex', flexDirection: 'column', gap: '12px' } });

      // Hot Corner Mode toggle
      settings.appendChild(Elements.createToggleRow({
        labelText: 'Hot Corner Mode',
        getValue: async () => (await PromptStorageManager.getDisplayMode()) === 'hotCorner',
        onToggle: async (active) => {
          const newMode = active ? 'hotCorner' : 'standard';
          await PromptStorageManager.saveDisplayMode(newMode);
          await PromptUIManager.refreshDisplayMode();
        }
      }));

      // Append prompts vs overwrite input
      settings.appendChild(Elements.createToggleRow({
        labelText: 'Append prompts to text',
        getValue: async () => await PromptStorageManager.getDisableOverwrite(),
        onToggle: async (active) => { await PromptStorageManager.saveDisableOverwrite(active); }
      }));

      // Enable tags feature (applies to prompt creation view)
      settings.appendChild(Elements.createToggleRow({
        labelText: 'Enable tags',
        getValue: async () => await PromptStorageManager.getEnableTags(),
        onToggle: async (active) => { await PromptStorageManager.saveEnableTags(active); }
      }));

      // Force Dark Mode toggle
      settings.appendChild(Elements.createToggleRow({
        labelText: 'Force Dark Mode',
        getValue: async () => {
          const enabled = await PromptStorageManager.getForceDarkMode();
          isDarkModeForced = !!enabled; // keep local flag consistent
          return enabled;
        },
        onToggle: async (active) => {
          isDarkModeForced = active;
          await PromptStorageManager.saveForceDarkMode(active);
          PromptUIManager.updateThemeForUI();
        }
      }));

      // Comment : Import & Export functionality in settings menu
      const dataSectionTitle = createEl('div', { styles: { fontWeight: 'bold', fontSize: '14px', marginTop: '6px' }, innerHTML: 'Prompt Management' });
      const dataActions = createEl('div', { styles: { display: 'flex', gap: '8px' } });
      const exportBtn = createEl('button', { innerHTML: 'Export', className: `opm-button opm-${getMode()}` });
      exportBtn.addEventListener('click', async e => {
        e.stopPropagation();
        try {
          const prompts = await PromptStorageManager.getPrompts();
          const json = JSON.stringify(prompts, null, 2);
          const blob = new Blob([json], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = createEl('a', { attributes: { href: url, download: `prompts-${new Date().toISOString().split('T')[0]}.json` } });
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } catch (err) {
          alert('Export failed.');
        }
      });
      const importBtn = createEl('button', { innerHTML: 'Import', className: `opm-button opm-${getMode()}` });
      importBtn.addEventListener('click', async e => {
        e.stopPropagation();
        // COMMENT: Use a transient file input to select a JSON file and merge its prompts
        const fileInput = createEl('input', { attributes: { type: 'file', accept: '.json' } });
        fileInput.addEventListener('change', async event => {
          const file = event.target.files[0];
          if (file) {
            try {
              const text = await file.text();
              const imported = JSON.parse(text);
              if (!Array.isArray(imported)) throw new Error('Invalid format');
              const merged = await PromptStorageManager.mergeImportedPrompts(imported);
              // COMMENT: Refresh list view state in case the user navigates back
              PromptUIManager.refreshPromptList(merged);
              importBtn.textContent = 'Import successful!';
              setTimeout(() => importBtn.textContent = 'Import', IMPORT_SUCCESS_RESET_MS);
            } catch (err) {
              alert('Invalid JSON file format.');
            }
          }
        });
        fileInput.click();
      });
      dataActions.append(exportBtn, importBtn);
      // COMMENT: Add a full-width, light-grey tinted destructive action to remove all prompts
      const deleteAllBtn = createEl('button', {
        innerHTML: 'Delete all prompts',
        className: `opm-button opm-${getMode()}`,
        // COMMENT: Override background to a light grey tint while keeping the same button style
        styles: { backgroundColor: '#9CA3AF', marginTop: '4px' }
      });
      deleteAllBtn.addEventListener('click', async e => {
        e.stopPropagation();
        if (!confirm('Delete ALL prompts? This cannot be undone.')) return;
        try {
          // COMMENT: Clear all prompts in storage using the unified API
          await PromptStorageManager.setPrompts([]);
          // COMMENT: Rebuild Settings so counts/order/tag UI reflect the empty state immediately
          PanelRouter.mount(PanelView.SETTINGS);
        } catch (_) {
          alert('Failed to delete prompts.');
        }
      });
      // COMMENT: Tag Management section (aggregated tags with counts)
      const tagMgmtTitle = createEl('div', { styles: { fontWeight: 'bold', fontSize: '14px', marginTop: '12px', display: 'none' }, innerHTML: 'Tag management' });
      const tagMgmtContainer = createEl('div', { styles: { display: 'none', flexDirection: 'column', gap: '6px' } });
      (async () => {
        try {
          const enableTags = await PromptStorageManager.getEnableTags();
          if (!enableTags) { tagMgmtTitle.style.display = 'none'; tagMgmtContainer.style.display = 'none'; return; }

          // Show section only when tags feature is enabled
          tagMgmtTitle.style.display = '';
          tagMgmtContainer.style.display = '';

          let counts = await TagService.getCounts();
          const row = createEl('div', { className: 'opm-tags-mgmt-container' });
          let finalOrder = await TagService.getOrderedTags(counts);

          // COMMENT: Placeholder for dynamic insertion while dragging
          const placeholder = createEl('span', { className: `opm-tag-pill opm-${getMode()} opm-drop-placeholder`, innerHTML: '&nbsp;' });
          let dragFromIndex = null;

          const pillsOnly = () => Array.from(row.children).filter(n => n.classList && n.classList.contains('opm-tag-pill') && n !== placeholder);

          const insertPlaceholderAt = (clientX, clientY) => {
            const pills = pillsOnly();
            if (pills.length === 0) { row.appendChild(placeholder); return; }
            let inserted = false;
            for (let i = 0; i < pills.length; i++) {
              const rect = pills[i].getBoundingClientRect();
              if (clientY >= rect.top && clientY <= rect.bottom) {
                // Match placeholder width to nearest pill for stable layout
                placeholder.style.width = `${rect.width}px`;
                const before = clientX < rect.left + rect.width / 2;
                if (before) {
                  if (pills[i].previousSibling !== placeholder) row.insertBefore(placeholder, pills[i]);
                } else {
                  if (pills[i].nextSibling !== placeholder) row.insertBefore(placeholder, pills[i].nextSibling);
                }
                inserted = true;
                break;
              }
            }
            if (!inserted) {
              const first = pills[0];
              const last = pills[pills.length - 1];
              const firstRect = first.getBoundingClientRect();
              const lastRect = last.getBoundingClientRect();
              placeholder.style.width = `${(firstRect || lastRect).width}px`;
              if (clientY < firstRect.top) {
                if (first.previousSibling !== placeholder) row.insertBefore(placeholder, first);
              } else {
                if (last.nextSibling !== placeholder) row.insertBefore(placeholder, last.nextSibling);
              }
            }
          };

          // Row-level DnD to create space dynamically
          row.addEventListener('dragover', e => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            insertPlaceholderAt(e.clientX, e.clientY);
          });
          row.addEventListener('drop', async e => {
            e.preventDefault();
            const nodes = Array.from(row.children);
            let to = 0;
            for (let i = 0; i < nodes.length; i++) {
              const node = nodes[i];
              if (node === placeholder) break;
              if (node.classList && node.classList.contains('opm-tag-pill')) to++;
            }
            let from = dragFromIndex;
            if (from === null) {
              const txt = e.dataTransfer.getData('text/plain');
              const parsed = parseInt(txt, 10);
              from = Number.isNaN(parsed) ? null : parsed;
            }
            if (from === null || from === to) {
              if (placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
              dragFromIndex = null;
              return;
            }
            if (from < to) to = to - 1;
            const moved = finalOrder.splice(from, 1)[0];
            finalOrder.splice(Math.max(0, Math.min(finalOrder.length, to)), 0, moved);
            await PromptStorageManager.saveTagsOrder(finalOrder);
            if (placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
            dragFromIndex = null;
            render();
          });

          // Enable drag to reorder via a dedicated handle (with custom drag image)
          const render = () => {
            row.innerHTML = '';
            finalOrder.forEach((tag, idx) => {
              const n = counts.get(tag) || 0;
              const pill = createEl('span', { className: `opm-tag-pill opm-${getMode()}` });

              // Drag handle on the left
              const handle = createEl('span', {
                styles: { display: 'inline-flex', alignItems: 'center', marginRight: '6px', cursor: 'grab' },
                innerHTML: `
                  <img 
                    src="${chrome.runtime.getURL('icons/drag_indicator.svg')}" 
                    width="14" 
                    height="14" 
                    alt="Drag" 
                    title="Drag to reorder"
                    style="opacity: 0.9; filter: ${getIconFilter()}"
                  >
                `
              });
              handle.setAttribute('draggable', 'true');
              handle.addEventListener('dragstart', e => {
                e.stopPropagation();
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(idx));
                dragFromIndex = idx;
                try {
                  const rect = pill.getBoundingClientRect();
                  const offsetX = Math.min(8, rect.width / 2);
                  const offsetY = Math.min(8, rect.height / 2);
                  e.dataTransfer.setDragImage(pill, offsetX, offsetY);
                } catch (_) {}
              });
              handle.addEventListener('dragend', () => {
                if (placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
                dragFromIndex = null;
              });

              // Label in the middle
              const label = createEl('span', { innerHTML: `${tag} (${n})` });

              // Remove button on the right
              const removeBtn = createEl('button', { innerHTML: '×', styles: { marginLeft: '6px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '14px', lineHeight: '1' } });
              removeBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!confirm(`Remove tag "${tag}" from all prompts?`)) return;
                try {
                  const prompts = await PromptStorageManager.getPrompts();
                  const updated = prompts.map(p => {
                    const nextTags = Array.isArray(p.tags) ? p.tags.filter(t => t !== tag) : [];
                    return { ...p, tags: nextTags };
                  });
                  await PromptStorageManager.setPrompts(updated);
                  // Update counts & order locally
                  counts = await TagService.getCounts(updated);
                  finalOrder = finalOrder.filter(t => t !== tag);
                  await PromptStorageManager.saveTagsOrder(finalOrder);
                  render();
                } catch (_) { /* ignore */ }
              });

              pill.append(handle, label, removeBtn);
              row.appendChild(pill);
            });
          };
          render();
          tagMgmtContainer.appendChild(row);
        } catch (_) { /* ignore */ }
      })();

      form.append(title, settings, dataSectionTitle, dataActions, deleteAllBtn, tagMgmtTitle, tagMgmtContainer);
      return form;
    },
    // COMMENT: Build the Edit view with draggable reordering and actions
    async createEditView() {
      const prompts = await PromptStorageManager.getPrompts();
      // COMMENT: Read tags feature flag to optionally display tag pills in edit view
      const enableTags = await PromptStorageManager.getEnableTags();
      const container = createEl('div', { className: `opm-form-container opm-${getMode()}`, styles: { padding: '0', display: 'flex', flexDirection: 'column' } });
      const promptsContainer = createEl('div', { className: `${SELECTORS.PROMPT_ITEMS_CONTAINER} opm-prompt-list-items opm-${getMode()}`, styles: { maxHeight: '350px', overflowY: 'auto', marginBottom: '4px' } });
      const reorder = Reorder.attach(
        promptsContainer,
        prompts,
        (newPrompts) => { PromptStorageManager.setPrompts(newPrompts).then(() => { PanelRouter.mount(PanelView.EDIT); }); }
      );
      prompts.forEach((p, idx) => {
        const item = createEl('div', { className: `opm-prompt-list-item opm-${getMode()}`, styles: { justifyContent: 'space-between', padding: '4px 4px', margin: '6px 0' } });
        item.dataset.index = idx;
        const dragHandle = createEl('div', {
          className: 'opm-drag-handle',
          innerHTML: `
            <img 
              src="${chrome.runtime.getURL('icons/drag_indicator.svg')}" 
              width="16" 
              height="16" 
              alt="Drag handle" 
              title="Drag to reorder"
              style="display: block; opacity: 0.9; filter: ${getIconFilter()}"
            >
          `,
          styles: {
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '16px', height: '16px', marginRight: '4px', marginLeft: '0px', flex: '0 0 auto',
            cursor: 'grab', userSelect: 'none', opacity: '0.9'
          }
        });
        reorder.wireItem(item, idx, dragHandle);
        // COMMENT: Left-side info column with title only (tags move to edit form)
        const info = createEl('div', { styles: { display: 'flex', flexDirection: 'column', flex: '1', gap: '2px' } });
        const text = createEl('div', { styles: { flex: '0 0 auto' } });
        text.textContent = p.title;
        info.appendChild(text);
        // COMMENT: Attach dataset for search filtering in edit view
        const lowerTags = Array.isArray(p.tags) ? p.tags.map(t => String(t).toLowerCase()).join(' ') : '';
        item.dataset.title = p.title.toLowerCase();
        item.dataset.content = p.content.toLowerCase();
        item.dataset.tags = lowerTags;
        const actions = createEl('div', { styles: { display: 'flex', gap: '4px' } });
        const editIcon = Elements.createIconButton('edit', () => { PromptUIManager.showEditForm(p); });
        const deleteIcon = Elements.createIconButton('delete', () => { if (confirm(`Delete "${p.title}"?`)) PromptUIManager.deletePrompt(p.uuid); });
        actions.append(editIcon, deleteIcon);
        item.append(dragHandle, info, actions);
        promptsContainer.appendChild(item);
      });
      container.appendChild(promptsContainer);
      return container;
    }
  };

  // Visual behaviors & timers
  const Behaviors = {
    // COMMENT: Show the list element with classes and animations
    showList(listEl) {
      showEl(listEl);
    },
    // COMMENT: Hide the list element and reset after animation
    hideList(listEl) {
      hideEl(listEl);
    },
    // COMMENT: Start a delayed hide of the list; cancels prior timer
    startCloseTimer(listEl, onClose) {
      if (State.closeTimer) clearTimeout(State.closeTimer);
      State.closeTimer = setTimeout(() => {
        try { if (typeof onClose === 'function') onClose(); } finally {
          Behaviors.hideList(listEl);
          State.closeTimer = null;
        }
      }, PROMPT_CLOSE_DELAY);
    },
    // COMMENT: Cancel any pending delayed hide
    cancelCloseTimer() {
      if (State.closeTimer) clearTimeout(State.closeTimer);
      State.closeTimer = null;
    }
  };

  // Event wiring for the floating button and list interactions
  const Events = {
    // COMMENT: Attach open/close and hover behaviors to the main button and list
    attachButtonEvents(button, listEl) {
      let isOpen = false;
      const startClose = (e) => {
        if (e) e.stopPropagation();
        Behaviors.startCloseTimer(listEl, () => { isOpen = false; });
      };

      button.addEventListener('click', e => {
        e.stopPropagation();
        State.manuallyOpened = true;
        isOpen ? Behaviors.hideList(listEl) : Behaviors.showList(listEl);
        isOpen = !isOpen;
      });

      button.addEventListener('mouseenter', async e => {
        e.stopPropagation();
        Behaviors.cancelCloseTimer();
        // COMMENT: Desired behavior change:
        // - If the container is not open, open LIST on hover, but show CREATE if there are no prompts (onboarding)
        // - If a non-list view (Edit/Settings/Variable Input) is already open, do NOT switch views on hover
        const listIsVisible = listEl.classList.contains('opm-visible');
        if (!listIsVisible && !PromptUIManager.inVariableInputMode) {
          // COMMENT: Preserve onboarding by routing based on prompt availability
          PromptUIManager.manuallyOpened = false;
          await PromptUIManager.mountListOrCreateBasedOnPrompts();
          isOpen = true;
        } else {
          // COMMENT: Keep current open view as-is; simply ensure the list remains open state-wise
          isOpen = true;
        }
      });

      button.addEventListener('mouseleave', startClose);
      listEl.addEventListener('mouseenter', Behaviors.cancelCloseTimer);
      listEl.addEventListener('mouseleave', startClose);
      // Outside click handling is centralized by OutsideClickCloser
    }
  };

  // Expose internal modules
  return Object.freeze({ State, Elements, Views, Behaviors, Events });
})();

/* UI Manager */
class PromptUIManager {
  static _ensureRoot() {
    let root = document.getElementById(SELECTORS.ROOT);
    if (!root) {
      root = createEl('div', { id: SELECTORS.ROOT });
      document.body.appendChild(root);
      root.classList.add(`opm-${getMode()}`);
    }
    return root;
  }
  // COMMENT: Toggle panel height mode: 'variable' (LIST) or 'fixed' (other views)
  static setPanelHeightMode(mode) {
    const listEl = qs(`#${SELECTORS.PROMPT_LIST}`);
    if (!listEl) return;
    listEl.classList.remove('opm-fixed-400', 'opm-variable');
    if (mode === 'variable') listEl.classList.add('opm-variable'); else listEl.classList.add('opm-fixed-400');
  }
  // COMMENT: Map manager flags to PromptUI.State via accessors
  static get manuallyOpened() { return PromptUI.State.manuallyOpened; }
  static set manuallyOpened(v) { PromptUI.State.manuallyOpened = v; }
  static get inVariableInputMode() { return PromptUI.State.inVariableInputMode; }
  static set inVariableInputMode(v) { PromptUI.State.inVariableInputMode = v; }
  static onPromptSelect(cb) { PromptUIManager._eb.on('promptSelect', cb); }
  static emitPromptSelect(prompt) { PromptUIManager._eb.emit('promptSelect', prompt); }
  static _eb = new EventBus();
  // COMMENT: Removed panel height lock; CSS now enforces min/max height across views

  static injectPromptManagerButton(prompts) {
    if (document.getElementById(SELECTORS.PROMPT_BUTTON_CONTAINER)) return;
    PromptStorageManager.getButtonPosition().then(pos => {
      const container = createEl('div', { id: SELECTORS.PROMPT_BUTTON_CONTAINER, styles: UI_STYLES.getPromptButtonContainerStyle(pos) });
      const button = createEl('button', { id: SELECTORS.PROMPT_BUTTON, className: 'opm-prompt-button' });
      container.appendChild(button);
      const listEl = createEl('div', { id: SELECTORS.PROMPT_LIST, className: `opm-prompt-list opm-${getMode()} opm-fixed-400` });
      container.appendChild(listEl);
      PromptUIManager._ensureRoot().appendChild(container);
      PromptUIManager.refreshPromptList(prompts);
      PromptUIManager.attachButtonEvents(button, listEl, container, prompts);
      PromptUIManager.makeDraggable(container);
      PromptUIManager.checkAndShowOnboarding(container);
      OutsideClickCloser.ensure();
    });
  }

  static async checkAndShowOnboarding(container) {
    const onboardingCompleted = await PromptStorageManager.getOnboardingCompleted();
    // Remove "!" to the onboardingCompleted to force it to show.
    if (!onboardingCompleted) {
      PromptUIManager.showOnboardingPopup(container);
    }
  }

  static showOnboardingPopup(container) {
    const existingPopup = document.getElementById(SELECTORS.ONBOARDING_POPUP);
    if (existingPopup) existingPopup.remove();
    const popup = createEl('div', {
      id: SELECTORS.ONBOARDING_POPUP,
      className: `opm-onboarding-popup opm-${getMode()}`,
      styles: {
        position: 'absolute', top: '-42px', left: '50%',
        transform: 'translateX(-50%)', backgroundColor: `${THEME_COLORS.primary}dd`,
        color: 'white', padding: '6px 10px', borderRadius: '6px',
        fontSize: '13px', fontWeight: 'bold', zIndex: '10000',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.15)',
        textAlign: 'center', whiteSpace: 'nowrap', transition: 'opacity 0.3s ease'
      },
      innerHTML: 'Hover to Start'
    });
    const triangle = createEl('div', {
      styles: {
        position: 'absolute', bottom: '-4px', left: '50%',
        transform: 'translateX(-50%)', width: '0', height: '0',
        borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
        borderTop: `5px solid ${THEME_COLORS.primary}dd`
      }
    });
    popup.appendChild(triangle);
    container.appendChild(popup);
    setTimeout(() => {
      if (popup && popup.parentNode) {
        popup.style.opacity = '0';
        setTimeout(() => {
          if (popup && popup.parentNode) popup.remove();
        }, ONBOARDING_FADE_OUT_MS);
      }
    }, ONBOARDING_AUTO_HIDE_MS);
  }

  static attachButtonEvents(button, listEl /*, container, prompts */) {
    // COMMENT: Delegate event wiring to internal PromptUI.Events
    PromptUI.Events.attachButtonEvents(button, listEl);
  }

  static startCloseTimer(e, listEl, callback) {
    // COMMENT: Use shared behavior to coordinate delayed hide
    PromptUI.Behaviors.startCloseTimer(listEl, callback);
  }
  static cancelCloseTimer() {
    // COMMENT: Cancel any pending delayed hide
    PromptUI.Behaviors.cancelCloseTimer();
  }

  static makeDraggable(container) {
    let pos = { x: 0, y: 0 };
    PromptStorageManager.getButtonPosition().then(savedPos => {
      pos = savedPos;
      Object.assign(container.style, {
        right: `${pos.x}px`,
        bottom: `${pos.y}px`
      });
    });
    container.addEventListener('mousedown', startEvent => {
      if (startEvent.target.id !== SELECTORS.PROMPT_BUTTON) return;
      const startX = startEvent.clientX;
      const startY = startEvent.clientY;
      const startRight = parseInt(container.style.right, 10) || 0;
      const startBottom = parseInt(container.style.bottom, 10) || 0;
      container.style.transition = 'none';
      const handleMove = moveEvent => {
        const newX = Math.min(
          Math.max(startRight + (startX - moveEvent.clientX), 0),
          window.innerWidth - container.offsetWidth
        );
        const newY = Math.min(
          Math.max(startBottom + (startY - moveEvent.clientY), 0),
          window.innerHeight - container.offsetHeight
        );
        container.style.right = `${newX}px`;
        container.style.bottom = `${newY}px`;
      };
      const handleEnd = () => {
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleEnd);
        container.style.transition = 'all 0.3s ease';
        const newPos = {
          x: parseInt(container.style.right, 10),
          y: parseInt(container.style.bottom, 10)
        };
        if (Math.abs(newPos.x - pos.x) > 5 || Math.abs(newPos.y - pos.y) > 5) {
          PromptStorageManager.saveButtonPosition(newPos)
            .then(success => {
              if (success) pos = newPos;
            });
        }
      };
      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleEnd);
    });
  }

  static refreshPromptList(prompts) {    // COMMENT: Rebuild list and ensure search is visible via centralized helper
    this.buildPromptListContainer(prompts);
    this.setSearchVisibility(true);
  }

  static refreshItemsIfListActive(prompts = []) {   // COMMENT: Only refresh the items list when the prompt list view is active
    const panel = document.getElementById(SELECTORS.PANEL_CONTENT);
    if (!panel) return;
    const items = panel.querySelector(`.${SELECTORS.PROMPT_ITEMS_CONTAINER}.opm-view-list`);
    if (!items) return; // not on the list view – skip to avoid toggling search visibility
    PromptUIManager.buildPromptListContainer(prompts);
    PromptUIManager.setSearchVisibility(true);
    // COMMENT: After a storage-driven refresh, reapply the active tag filter (if any) and current search term
    const selected = (PromptUIManager.activeTagFilter || 'all');
    const input = document.getElementById(SELECTORS.PROMPT_SEARCH_INPUT);
    const term = input ? input.value : '';
    PromptUIManager.filterByTag(selected);
    if (term) PromptUIManager.filterPromptItems(term);
  }

  static setSearchVisibility(visible) {   // COMMENT: Explicitly control visibility of the search input in the bottom menu
    const input = document.getElementById(SELECTORS.PROMPT_SEARCH_INPUT);
    if (input) input.style.display = visible ? 'block' : 'none';
  }

  // COMMENT: Centralized prompt items filter used by search input
  static filterPromptItems(term) {
    const value = (term || '').toLowerCase();
    const container = document.querySelector(`.${SELECTORS.PROMPT_ITEMS_CONTAINER}`);
    if (!container) return;
    // Combine with active tag filter if present
    const activeTag = (PromptUIManager.activeTagFilter || 'all').toLowerCase();
    Array.from(container.children).forEach(item => {
      const matchesSearch = value === ''
        || item.dataset.title?.includes(value)
        || item.dataset.content?.includes(value)
        || item.dataset.tags?.includes(value);
      // COMMENT: Use the exact tags list (JSON) for pill filtering to handle multi-word tags
      let matchesTag = true;
      if (activeTag !== 'all') {
        try {
          const tagList = JSON.parse(item.dataset.tagsList || '[]');
          matchesTag = Array.isArray(tagList) && tagList.includes(activeTag);
        } catch (_) { matchesTag = false; }
      }
      item.style.display = (matchesSearch && matchesTag) ? 'flex' : 'none';
    });
    PromptUIManager.selectedSearchIndex = -1;
  }

  // COMMENT: Tag filter setter that reruns combined filtering without changing panel height
  static filterByTag(tag) {
    const prev = (PromptUIManager.activeTagFilter || 'all');
    PromptUIManager.activeTagFilter = (tag || 'all');
    // Re-apply current search term to combine filters
    const input = document.getElementById(SELECTORS.PROMPT_SEARCH_INPUT);
    const term = input ? input.value : '';
    PromptUIManager.filterPromptItems(term);
    // COMMENT: Persist selected tag for future sessions
    try { PromptStorageManager.saveActiveTagFilter(PromptUIManager.activeTagFilter); } catch (_) { /* ignore */ }
  }

  // COMMENT: Centralized clearing of search input and results state
  static clearSearchInput() {
    const input = document.getElementById(SELECTORS.PROMPT_SEARCH_INPUT);
    if (input) input.value = '';
    PromptUIManager.selectedSearchIndex = -1;
  }

  static buildPromptListContainer(prompts = []) {   // COMMENT: Rebuild the list content using internal view composition
    const listEl = qs(`#${SELECTORS.PROMPT_LIST}`);
    if (!listEl) return;
    Theme.applyNode(listEl);
    listEl.innerHTML = '';
    const content = PromptUI.Views.renderPromptList(prompts);
    listEl.appendChild(content);
  }

  static resetPromptListContainer() {
    const listEl = qs(`#${SELECTORS.PROMPT_LIST}`);
    const wasVisible = listEl && listEl.classList.contains('opm-visible');
    PromptUIManager.buildPromptListContainer();
    if (wasVisible) {
      const updated = qs(`#${SELECTORS.PROMPT_LIST}`);
      if (updated) { updated.style.display = 'block'; void updated.offsetHeight; updated.classList.add('opm-visible'); }
    }
  }

  static replacePanelMainContent(node) {  // COMMENT: Replace the scrollable main area (prompt items) while preserving the bottom menu
    const panel = document.getElementById(SELECTORS.PANEL_CONTENT);
    if (!panel) return;
    const items = panel.querySelector(`.${SELECTORS.PROMPT_ITEMS_CONTAINER}`);
    if (items) {
      items.replaceWith(node);
    } else {  // If items container is missing, inject the node before the last child (bottom menu) if present
      const lastChild = panel.lastElementChild;
      if (lastChild) panel.insertBefore(node, lastChild); else panel.appendChild(node);
    }
    // COMMENT: Toggle search visibility based on whether the new node is the list view
    const isListView = node.classList && node.classList.contains('opm-view-list');
    PromptUIManager.setSearchVisibility(!!isListView);
  }

  // COMMENT: Show the prompt list and handle keyboard navigation
  static showPromptList(listEl) {
    if (!listEl) return;
    // COMMENT: Detect whether we are opening the panel (vs already open)
    const wasVisible = listEl.classList.contains('opm-visible');
    // COMMENT: When showing, if current view is LIST, allow variable height; else keep fixed
    const panelNode = document.getElementById(SELECTORS.PANEL_CONTENT);
    const isListView = panelNode && panelNode.querySelector(`.${SELECTORS.PROMPT_ITEMS_CONTAINER}.opm-view-list`);
    PromptUIManager.setPanelHeightMode(isListView ? 'variable' : 'fixed');
    PromptUI.Behaviors.showList(listEl);
    // COMMENT: Determine if the current main content is the LIST view
    const panel = document.getElementById(SELECTORS.PANEL_CONTENT);
    const hasListItems = panel && panel.querySelector(`.${SELECTORS.PROMPT_ITEMS_CONTAINER}.opm-view-list`);
    // COMMENT: On open, restore persisted tag or default to "All" and refresh prompts only when the list view is active
    if (!wasVisible && hasListItems) {
      // restore persisted tag
      PromptStorageManager.getActiveTagFilter().then(savedTag => { PromptUIManager.activeTagFilter = savedTag || 'all'; }).catch(() => { PromptUIManager.activeTagFilter = 'all'; });
      // Rebuild the list from storage, then apply default tag filter
      PromptStorageManager.getPrompts().then(prompts => {
        PromptUIManager.refreshPromptList(prompts);
        // COMMENT: Ensure search input focuses after the refresh so typing/keyboard works
        setTimeout(() => {
          PromptStorageManager.getActiveTagFilter().then(savedTag => {
            PromptUIManager.filterByTag(savedTag || 'all');
          }).catch(() => {
            PromptUIManager.filterByTag('all');
          });
          PromptUIManager.focusSearchInput();
        }, SEARCH_FOCUS_DELAY_MS);
      }).catch(() => {
        // COMMENT: ignore reload errors; UI will still show last-rendered content
      });
    }
    // COMMENT: Focus only if list view is active
    // COMMENT: Keep fallback behavior here; router will also set explicitly
    PromptUIManager.setSearchVisibility(!!hasListItems);
    if (hasListItems) {
      const first = listEl.querySelector('.opm-prompt-list-item');
      if (first) setTimeout(() => first.focus(), SEARCH_FOCUS_DELAY_MS);
      PromptUIManager.focusSearchInput();
    }
    PromptUIManager.completeOnboarding();
  }

  static hidePromptList(listEl) {
    if (!listEl) return;
    // COMMENT: Use unified hide behavior, then perform manager-side cleanup
    PromptUI.Behaviors.hideList(listEl);
    PromptUIManager.clearSearchInput();
    // Reset both flags when hiding the view
    PromptUIManager.manuallyOpened = false;
    PromptUIManager.inVariableInputMode = false;
  }

  static handleKeyboardNavigation(e, context = 'list') {
    const list = qs(`#${SELECTORS.PROMPT_LIST}`);
    if (!list || !list.classList.contains('opm-visible')) return;
    PromptUIManager.cancelCloseTimer();
    let items = [];
    if (context === 'search') {
      const container = document.querySelector(`.${SELECTORS.PROMPT_ITEMS_CONTAINER}`);
      if (!container) return;
      items = Array.from(container.querySelectorAll('.opm-prompt-list-item'))
        .filter(item => item.style.display !== 'none');
    } else {
      items = Array.from(list.querySelectorAll('.opm-prompt-list-item'));
    }
    if (items.length === 0) return;
    let idx = context === 'search' ? PromptUIManager.selectedSearchIndex : items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (context === 'search') {
        PromptUIManager.selectedSearchIndex = Math.min(PromptUIManager.selectedSearchIndex + 1, items.length - 1) || 0;
        PromptUIManager.updateSelection(items, PromptUIManager.selectedSearchIndex);
      } else {
        items[(idx === -1 || idx === items.length - 1) ? 0 : idx + 1].focus();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (context === 'search') {
        PromptUIManager.selectedSearchIndex = Math.max(PromptUIManager.selectedSearchIndex - 1, -1);
        PromptUIManager.updateSelection(items, PromptUIManager.selectedSearchIndex);
      } else {
        items[(idx <= 0) ? items.length - 1 : idx - 1].focus();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (context === 'search') {
        if (PromptUIManager.selectedSearchIndex >= 0 && PromptUIManager.selectedSearchIndex < items.length) {
          items[PromptUIManager.selectedSearchIndex].click();
        } else if (items.length === 1) {
          items[0].click();
        }
      } else if (idx !== -1) {
        items[idx].click();
      }
    }
  }

  static handleGlobalEscape(e) {
    if (e.key === 'Escape') {
      const listEl = qs(`#${SELECTORS.PROMPT_LIST}`);
      if (listEl && listEl.classList.contains('opm-visible')) {
        e.preventDefault();
        PromptUIManager.selectedSearchIndex = -1;
        const container = document.querySelector(`.${SELECTORS.PROMPT_ITEMS_CONTAINER}`);
        if (container) {
          const items = Array.from(container.querySelectorAll('.opm-prompt-list-item'))
            .filter(item => item.style.display !== 'none');
          PromptUIManager.updateSelection(items, -1);
        }
        PromptUIManager.hidePromptList(listEl);
      }
    }
  }

  static updateThemeForUI() {
    Theme.applyAll();
    const container = document.getElementById(SELECTORS.PROMPT_BUTTON_CONTAINER);
    if (container) {
      const btn = container.querySelector(`#${SELECTORS.PROMPT_BUTTON}`) || container.querySelector('.opm-prompt-button');
      if (btn) {
        btn.style.boxShadow = isDarkMode() ? THEME_COLORS.darkShadow : THEME_COLORS.lightShadow;
      }
    }
    const icons = document.querySelectorAll(`#${SELECTORS.ROOT} .opm-icon-button img`);
    icons.forEach(icon => { icon.style.filter = getIconFilter(); });
  }

  static focusSearchInput() {
    const input = document.getElementById(SELECTORS.PROMPT_SEARCH_INPUT);
    if (input) { Theme.applyNode(input); requestAnimationFrame(() => { input.focus(); input.select(); }); }
  }  

  static showVariableInputForm(inputBox, content, variables, listEl, onSubmit) {
    // Set the flag to indicate we're in variable input mode
    PromptUIManager.inVariableInputMode = true;

    listEl.innerHTML = '';
    const dark = isDarkMode();
    const form = createEl('div', {
      className: `opm-form-container opm-${getMode()}`,
      styles: { padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }
    });
    const varContainer = createEl('div', {
      styles: { display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '300px', overflowY: 'auto' }
    });
    const varValues = {};
    variables.forEach(v => {
      // COMMENT: Normalize label text — replace underscores with spaces and capitalize first letter
      const displayLabel = String(v).replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
      const row = createEl('div', { styles: { display: 'flex', flexDirection: 'column', gap: '4px' } });
      // COMMENT: Use standard font inheritance by avoiding custom font styles and rely on theme class
      const label = createEl('label', { innerHTML: displayLabel, className: `opm-${getMode()}`, styles: { fontSize: '12px', fontWeight: 'bold' } });
      // COMMENT: Use a textarea with approx three lines height for easier multi-line input
      const inputField = createEl('textarea', {
        attributes: { rows: '3', placeholder: `${displayLabel} value` },
        className: `opm-textarea-field opm-${getMode()}`,
        // COMMENT: Inline height rules override generic textarea min-heights in stylesheet for this specific view
        styles: { minHeight: '54px', height: '54px', resize: 'vertical' }
      });
      inputField.addEventListener('input', () => { varValues[v] = inputField.value; });
      // COMMENT: Preserve Enter-to-submit behavior for consistency with previous single-line inputs
      inputField.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submitBtn.click(); } });
      row.append(label, inputField);
      varContainer.appendChild(row);
      varValues[v] = '';
    });
    form.appendChild(varContainer);
    // COMMENT: Ensure non-list view uses fixed height
    PromptUIManager.setPanelHeightMode('fixed');
    // COMMENT: Button container sticks to bottom of the panel
    const btnContainer = createEl('div', { styles: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px', marginTop: 'auto', position: 'sticky', bottom: '0', background: 'transparent' } });
    const submitBtn = createEl('button', { innerHTML: 'Submit', className: `opm-button opm-${getMode()}` });
    submitBtn.addEventListener('click', () => {
      PromptUIManager.inVariableInputMode = false;
      onSubmit(varValues);
    });
    const backBtn = createEl('button', { innerHTML: 'Back', className: `opm-button opm-${getMode()}` });
    backBtn.addEventListener('click', () => {
      PromptUIManager.inVariableInputMode = false;
      PanelRouter.mount(PanelView.LIST);
    });
    btnContainer.append(submitBtn, backBtn);
    form.appendChild(btnContainer);
    listEl.appendChild(form);
    PromptUIManager.showPromptList(listEl);
    // COMMENT: Focus the first variable field (supports textarea or input)
    const firstInput = varContainer.querySelector('textarea, input');
    if (firstInput) firstInput.focus();
  }

  static createPromptCreationForm(prefill = '') {
    // COMMENT: Delegate to PromptUI.Views to build the creation form
    return PromptUI.Views.createPromptCreationForm(prefill);
  }

  static async createEditView() {
    // COMMENT: Delegate to PromptUI.Views to build the edit view
    return PromptUI.Views.createEditView();
  }

  static async showEditForm(prompt /*, index */) {
    const list = qs(`#${SELECTORS.PROMPT_LIST}`);
    if (!list) return;
    PromptUIManager.resetPromptListContainer();
    // COMMENT: Show search in edit form as well for consistent filtering
    PromptUIManager.setSearchVisibility(true);
    const form = PromptUI.Views.createPromptForm({
      initialTitle: prompt.title,
      initialContent: prompt.content,
      submitLabel: 'Save Changes',
      onSubmit: async ({ title, content, tags }) => {
        const ps = await PromptStorageManager._ps();
        const update = { title, content };
        if (Array.isArray(tags)) update.tags = tags;
        await ps.updatePrompt(prompt.uuid, update);
        PanelRouter.mount(PanelView.EDIT);
      }
    });
    // COMMENT: Immediately render base form to avoid an empty panel while tags load
    PromptUIManager.replacePanelMainContent(form);
    const listElInitial = qs(`#${SELECTORS.PROMPT_LIST}`);
    if (listElInitial) { PromptUIManager.showPromptList(listElInitial); PromptUIManager.setSearchVisibility(false); }
    // COMMENT: If tags are enabled, mount a reusable TagUI input
    (async () => {
      const enableTags = await PromptStorageManager.getEnableTags();
      if (!enableTags) {
        PromptUIManager.replacePanelMainContent(form);
        const listElAfter = qs(`#${SELECTORS.PROMPT_LIST}`);
        if (listElAfter) { PromptUIManager.showPromptList(listElAfter); PromptUIManager.setSearchVisibility(false); }
        return;
      }
      const label = createEl('label', { styles: { fontSize: '12px', fontWeight: 'bold' } });
      const tagInput = TagUI.createTagInput({ initialTags: Array.isArray(prompt.tags) ? prompt.tags : [] });
      const tagsBlock = createEl('div');
      tagsBlock.append(label, tagInput.element);
      const saveBtn = form.querySelector('.opm-button');
      if (saveBtn && saveBtn.parentNode) saveBtn.parentNode.insertBefore(tagsBlock, saveBtn);
      if (saveBtn) {
        const newBtn = saveBtn.cloneNode(true);
        saveBtn.replaceWith(newBtn);
        newBtn.addEventListener('click', async e => {
          e.stopPropagation();
          const titleIn = form.querySelector('.opm-input-field');
          const contentArea = form.querySelector('.opm-textarea-field');
          const t = titleIn.value.trim(), c = contentArea.value.trim();
          if (!t || !c) { alert('Please fill in both title and content.'); return; }
          const ps = await PromptStorageManager._ps();
          await ps.updatePrompt(prompt.uuid, { title: t, content: c, tags: tagInput.getTags() });
          PanelRouter.mount(PanelView.EDIT);
        }, { once: true });
      }
      const listElAfter = qs(`#${SELECTORS.PROMPT_LIST}`);
      if (listElAfter) { PromptUIManager.showPromptList(listElAfter); PromptUIManager.setSearchVisibility(false); }
    })();
  }

  static async deletePrompt(uuid) {
    const ps = await PromptStorageManager._ps();
    await ps.deletePrompt(uuid);
    const list = qs(`#${SELECTORS.PROMPT_LIST}`);
    if (list) { PromptUIManager.resetPromptListContainer(); PanelRouter.mount(PanelView.EDIT); }
  }
  
  static createSettingsForm() {
    // COMMENT: Delegate to PromptUI.Views to build the settings form
    return PromptUI.Views.createSettingsForm();
  }

  // COMMENT: Update the selection of the items in the when using keyboard navigation
  static updateSelection(items, selIndex) {
    items.forEach((item, idx) => {
      item.style.backgroundColor = '';
      item.style.border = '';
      item.style.transform = '';
      item.classList.toggle('opm-keyboard-selected', idx === selIndex);
      if (idx === selIndex) {
        const container = item.parentElement, top = item.offsetTop, bottom = top + item.offsetHeight,
          cTop = container.scrollTop, cBottom = cTop + container.offsetHeight;
        if (top < cTop) container.scrollTop = top;
        else if (bottom > cBottom) container.scrollTop = bottom - container.offsetHeight;
      }
    });
  }

  // COMMENT: Store the selected index of the search results
  static selectedSearchIndex = -1;

  // HOT CORNER MODE
  static injectHotCorner() {
    if (document.getElementById(SELECTORS.HOT_CORNER_CONTAINER)) return;

    // container with active zone
    const container = createEl('div', {
      id: SELECTORS.HOT_CORNER_CONTAINER,
      styles: UI_STYLES.hotCornerActiveZone
    });

    //  visual indicator
    const indicator = createEl('div', {
      id: SELECTORS.HOT_CORNER_INDICATOR,
      styles: {
        position: 'fixed', bottom: '0', right: '0',
        width: '0', height: '0', zIndex: '9999',
        borderStyle: 'solid', borderWidth: `0 0 ${HOT_CORNER_INDICATOR_SMALL_PX}px ${HOT_CORNER_INDICATOR_SMALL_PX}px`,
        borderColor: `transparent transparent ${THEME_COLORS.primary}90 transparent`,
        transition: 'border-width 0.3s ease, border-color 0.3s ease',
        pointerEvents: 'none'
      }
    });
    container.appendChild(indicator);

    // Create the prompt list container with some positioning rules
    const listEl = createEl('div', {
      id: SELECTORS.PROMPT_LIST,
      className: `opm-prompt-list opm-${getMode()} opm-fixed-400`,
      styles: {
        position: 'absolute',
        right: '30px',
        bottom: '30px',
      }
    });
    container.appendChild(listEl);
    PromptUIManager._ensureRoot().appendChild(container);

    // Setup event handlers
    this.setupHotCornerEvents(container, indicator, listEl);
    OutsideClickCloser.ensure();
  }

  // Extracted event handling for hot corner
  static setupHotCornerEvents(container, indicator, listEl) {
    container.addEventListener('mouseenter', async e => {
      e.stopPropagation();
      PromptUIManager.cancelCloseTimer();

      // COMMENT: Mirror button-mode behavior — only mount if the list is not already visible
      const listIsVisible = listEl.classList.contains('opm-visible');
      if (!listIsVisible && !PromptUIManager.inVariableInputMode) {
        PromptUIManager.manuallyOpened = false;
        indicator.style.borderWidth = `0 0 ${HOT_CORNER_INDICATOR_LARGE_PX}px ${HOT_CORNER_INDICATOR_LARGE_PX}px`;
        indicator.style.borderColor = `transparent transparent ${THEME_COLORS.primary} transparent`;
        await PromptUIManager.mountListOrCreateBasedOnPrompts();
      }
    });

    // Existing mouseleave handler
    // Cancel the close-timer when mouse re-enters the prompt list itself
    listEl.addEventListener('mouseenter', () => {
      PromptUIManager.cancelCloseTimer();
    });
    // Restart the timer when leaving the prompt list
    listEl.addEventListener('mouseleave', e => {
      // COMMENT: Ensure flags are reset when auto-closing so future hovers work
      PromptUIManager.startCloseTimer(e, listEl, () => {
        PromptUIManager.manuallyOpened = false;
        PromptUIManager.inVariableInputMode = false;
      });
    });

    container.addEventListener('mouseleave', e => {
      e.stopPropagation();
      indicator.style.borderWidth = `0 0 ${HOT_CORNER_INDICATOR_SMALL_PX}px ${HOT_CORNER_INDICATOR_SMALL_PX}px`;
      indicator.style.borderColor = `transparent transparent ${THEME_COLORS.primary}90 transparent`;
      // COMMENT: Reset flags on timed close to avoid getting stuck in a "manually opened" state
      PromptUIManager.startCloseTimer(e, listEl, () => {
        PromptUIManager.manuallyOpened = false;
        PromptUIManager.inVariableInputMode = false;
      });
    });

    // COMMENT: When the tab is hidden and later shown again, make sure the UI resets properly
    const visibilityHandler = () => {
      if (document.hidden) {
        // COMMENT: Reset flags and hide the list silently when tab loses visibility
        PromptUIManager.manuallyOpened = false;
        PromptUIManager.inVariableInputMode = false;
        PromptUI.Behaviors.hideList(listEl);
      }
    };
    document.addEventListener('visibilitychange', visibilityHandler);
    container.visibilityHandler = visibilityHandler;

    // Set onboarding as completed when hovering over hot corner
    container.addEventListener('mouseenter', () => { PromptUIManager.completeOnboarding(); });
  }

  static cleanupAllUIComponents() {
    // Clean up button container
    const buttonContainer = document.getElementById(SELECTORS.PROMPT_BUTTON_CONTAINER);
    if (buttonContainer) {
      // Clean up any event listeners if needed
      buttonContainer.remove();
    }

    // Clean up hot corner container
    const hotCornerContainer = document.getElementById(SELECTORS.HOT_CORNER_CONTAINER);
    if (hotCornerContainer) {
      // Remove the document click handler if it exists
      if (hotCornerContainer.documentClickHandler) {
        document.removeEventListener('click', hotCornerContainer.documentClickHandler);
      }
      // COMMENT: Remove the visibilitychange handler we registered in hot-corner mode
      if (hotCornerContainer.visibilityHandler) {
        document.removeEventListener('visibilitychange', hotCornerContainer.visibilityHandler);
      }
      hotCornerContainer.remove();
    }

    // Clean up any other global handlers or state
    PromptUIManager.manuallyOpened = false;
  }

  static async refreshDisplayMode() {
    // clean up all existing UI components
    PromptUIManager.cleanupAllUIComponents();
    // Get the current mode and prompts
    const prompts = await PromptStorageManager.getPrompts();
    await PromptUIManager.injectUIForCurrentMode(prompts);

    // Make sure the prompt list is refreshed only if list view is active
    PromptUIManager.refreshItemsIfListActive(prompts);
    // If switching modes from settings, we should close any open menu
    const listEl = qs(`#${SELECTORS.PROMPT_LIST}`);
    if (listEl && listEl.classList.contains('opm-visible')) {
      PromptUIManager.hidePromptList(listEl);
    }
  }  

  // COMMENT: Helper to mark onboarding as complete and remove the popup if present
  static completeOnboarding() {
    PromptStorageManager.setOnboardingCompleted();
    const popup = document.getElementById(SELECTORS.ONBOARDING_POPUP);
    if (popup) popup.remove();
  }

  // COMMENT: Helper to mount LIST or CREATE based on prompt availability
  static async mountListOrCreateBasedOnPrompts() {
    const currentPrompts = await PromptStorageManager.getPrompts();
    if (currentPrompts.length === 0) PanelRouter.mount(PanelView.CREATE); else PanelRouter.mount(PanelView.LIST);
  }

  // COMMENT: Inject the correct UI based on current display mode
  static async injectUIForCurrentMode(prompts) {
    const displayMode = await PromptStorageManager.getDisplayMode();
    if (displayMode === 'standard') {
      const data = prompts || await PromptStorageManager.getPrompts();
      PromptUIManager.injectPromptManagerButton(data);
    } else {
      PromptUIManager.injectHotCorner();
    }
  }
}

/* Prompt Processor */
class PromptProcessor {
  static extractVariables(content) {
    const regex = /#([a-zA-Z0-9_]+)#/g;
    return [...new Set([...content.matchAll(regex)].map(m => m[1]))];
  }
  static replaceVariables(content, values) {
    return Object.entries(values).reduce((res, [k, v]) => res.replace(new RegExp(`#${k}#`, 'g'), v), content);
  }
}

/* Prompt Mediator */
class PromptMediator {
  constructor(ui, processor) {
    this.ui = ui;
    this.processor = processor;
    this.eventBus = new EventBus();
    this.bindEvents();
    this.initialize();
  }
  bindEvents() {
    PromptUIManager.onPromptSelect(async prompt => {
      // COMMENT: Be resilient — if input box isn't ready yet, wait briefly before giving up
      let inputBox = await InputBoxHandler.getInputBox();
      if (!inputBox) {
        try {
          inputBox = await InputBoxHandler.waitForInputBox();
        } catch (_) {
          console.error('Input box not found.');
          return;
        }
      }
      const vars = this.processor.extractVariables(prompt.content);
      const listEl = qs(`#${SELECTORS.PROMPT_LIST}`);
      if (vars.length === 0) {
        await InputBoxHandler.insertPrompt(inputBox, prompt.content, listEl);
        PromptUIManager.hidePromptList(listEl);
      } else {
        PromptUIManager.showVariableInputForm(inputBox, prompt.content, vars, listEl, async values => {
          const processed = this.processor.replaceVariables(prompt.content, values);
          await InputBoxHandler.insertPrompt(inputBox, processed, listEl);
          PromptUIManager.hidePromptList(listEl);
          setTimeout(() => { PromptStorageManager.getPrompts().then(prompts => { PromptUIManager.refreshPromptList(prompts); }); }, 300);
        });
      }
    });
  }
  async initialize() {
    try {
      // COMMENT: Inject UI immediately on page load without waiting for input box detection
      const prompts = await PromptStorageManager.getPrompts();
      await PromptUIManager.injectUIForCurrentMode(prompts);
      // COMMENT: Keep observers/monitors so UI stays healthy across SPA navigations and DOM changes
      this.setupMutationObserver();
      this.setupStorageChangeMonitor();
      this.setupKeyboardShortcuts();
    } catch (err) { console.error('Error initializing extension:', err); }
  }

  setupMutationObserver() {
    const target = document.querySelector('main') || document.body;

    const debouncedHandler = debounce(async () => { // COMMENT: Ensure UI is present even if an input box hasn't been detected yet
      if (!document.getElementById(SELECTORS.PROMPT_BUTTON_CONTAINER) &&
          !document.getElementById(SELECTORS.HOT_CORNER_CONTAINER)) {
        PromptUIManager.cleanupAllUIComponents();
        const prompts = await PromptStorageManager.getPrompts();
        await PromptUIManager.injectUIForCurrentMode(prompts);
      }
    }, MUTATION_DEBOUNCE_MS);

    const observer = new MutationObserver(debouncedHandler);
    observer.observe(target, { childList: true, subtree: true });
  }

  setupStorageChangeMonitor() {   // COMMENT: Use unified storage change listener to keep UI in sync across contexts
    (async () => {
      try {
        const { onPromptsChanged } = await import(chrome.runtime.getURL('promptStorage.js'));
        onPromptsChanged((prompts) => {      // COMMENT: Only refresh items when the list view is active to avoid polluting non-list views
          PromptUIManager.refreshItemsIfListActive(prompts);
        });
      } catch (err) {
        console.error('Failed to attach unified prompts change listener:', err);
      }
    })();
  }

  setupKeyboardShortcuts() {
    KeyboardManager.initialize();
  }
}

/* Initialize the extension */
setTimeout(() => { new PromptMediator(PromptUIManager, PromptProcessor); }, 50);
