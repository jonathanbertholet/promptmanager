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
const ensureStylesInjected = (() => {
  let injected = false;
  return () => {
    if (injected) return;
    try {
      injectGlobalStyles();
      injected = true;
    } catch (err) {
      console.error('[PromptManager] Failed to inject global styles safely:', err);
    }
  };
})();
ensureStylesInjected();

/* ---------------------------------------------------------------------------
 * [01] Chrome bridge helpers
 * COMMENT: Centralizes chrome.* guards so storage calls stay reliable.
 * -------------------------------------------------------------------------*/
const ChromeBridge = (() => {
  /**
   * COMMENT: Wrapper that swallows exceptions and returns a fallback.
   * @template T
   * @param {() => Promise<T>} executor
   * @param {T} fallback
   * @returns {Promise<T>}
   */
  const safeAsync = async (executor, fallback) => {
    try {
      return await executor();
    } catch (error) {
      console.error('[PromptManager] safeAsync captured error:', error);
      return fallback;
    }
  };

  const storage = {
    /**
     * COMMENT: Read from chrome.storage.local with consistent error handling.
     * @param {string} key
     * @param {any} fallback
     * @returns {Promise<any>}
     */
    async get(key, fallback) {
      if (!chrome?.storage?.local) return fallback;
      return safeAsync(() => new Promise(resolve => {
        chrome.storage.local.get(key, data => {
          if (chrome.runtime?.lastError) {
            console.warn(`[PromptManager] chrome.storage.get failed for ${key}:`, chrome.runtime.lastError.message);
            resolve(fallback);
            return;
          }
          if (key && typeof key === 'string') {
            resolve(data?.[key] !== undefined ? data[key] : fallback);
          } else {
            resolve(data ?? fallback);
          }
        });
      }), fallback);
    },
    /**
     * COMMENT: Write to chrome.storage.local and surface boolean success.
     * @param {string} key
     * @param {any} value
     * @returns {Promise<boolean>}
     */
    async set(key, value) {
      if (!chrome?.storage?.local) return false;
      return safeAsync(() => new Promise(resolve => {
        chrome.storage.local.set({ [key]: value }, () => {
          if (chrome.runtime?.lastError) {
            console.warn(`[PromptManager] chrome.storage.set failed for ${key}:`, chrome.runtime.lastError.message);
            resolve(false);
            return;
          }
          resolve(true);
        });
      }), false);
    }
  };

  return { safeAsync, storage };
})();

/* ---------------------------------------------------------------------------
 * [02] Config & Constants
 * COMMENT: Centralized timings and reusable constants.
 * -------------------------------------------------------------------------*/
const HIDE_ANIMATION_MS = 200;
const MUTATION_DEBOUNCE_MS = 600;
const SEARCH_FOCUS_DELAY_MS = 50;
const ONBOARDING_AUTO_HIDE_MS = 10000;
const ONBOARDING_FADE_OUT_MS = 300;
const IMPORT_SUCCESS_RESET_MS = 2000;
const SCROLLBAR_PERSIST_MS = 900;
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
window.createEl = createEl;

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
window.debounce = debounce;

// [02] Theme helpers — centralize theme and basic UI show/hide behavior
// Helper functions for theme and UI manipulation
const getMode = () => (isDarkMode() ? 'dark' : 'light');
// Centralize the computed CSS filter used for icons based on theme
const getIconFilter = () => (
  isDarkMode()
    ? 'invert(93%) sepia(0%) saturate(0%) hue-rotate(213deg) brightness(107%) contrast(87%)'
    : 'invert(37%) sepia(74%) saturate(380%) hue-rotate(175deg) brightness(93%) contrast(88%)'
);
window.getMode = getMode;
window.getIconFilter = getIconFilter;
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
window.showEl = showEl;
window.hideEl = hideEl;

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
  EDIT_PROMPT: 'EDIT_PROMPT',
  SETTINGS: 'SETTINGS',
  CHANGELOG: 'CHANGELOG',
  VARIABLE_INPUT: 'VARIABLE_INPUT'
});
window.PanelView = PanelView;

/* ---------------------------------------------------------------------------
 * Scroll visibility manager — shows scrollbars only while the user is scrolling.
 * COMMENT: Keeps the panel minimal until actual scroll activity occurs.
 * -------------------------------------------------------------------------*/
const ScrollVisibilityManager = (() => {
  const observers = new WeakMap();
  const ACTIVITY_EVENTS = ['scroll', 'wheel', 'touchmove'];

  const markActive = (node, state) => {
    node.classList.add('opm-scroll-active');
    clearTimeout(state.timer);
    state.timer = setTimeout(() => {
      node.classList.remove('opm-scroll-active');
    }, SCROLLBAR_PERSIST_MS);
  };

  const ensureListeners = (node) => {
    const state = { timer: null };
    const handler = () => markActive(node, state);
    ACTIVITY_EVENTS.forEach(evt => node.addEventListener(evt, handler, { passive: true }));
    observers.set(node, state);
  };

  return {
    observe(node) {
      if (!node || observers.has(node)) return;
      node.classList.add('opm-scrollable');
      ensureListeners(node);
    }
  };
})();
window.ScrollVisibilityManager = ScrollVisibilityManager;

const PanelRouter = (() => {
  const state = {
    currentView: null
  };

  /**
   * COMMENT: Shared factory for static info views (e.g. changelog) loaded from extension HTML.
   * @param {{ titleText: string, contentId: string, sourcePath: string }} options
   * @returns {HTMLElement}
   */
  const createInfoView = ({ titleText, contentId, sourcePath }) => {
    const dark = isDarkMode();
    const container = createEl('div', {
      className: `opm-form-container opm-${getMode()}`,
      styles: { padding: '0', display: 'flex', flexDirection: 'column', gap: '6px' }
    });
    const title = createEl('div', {
      styles: { fontWeight: 'bold', fontSize: '16px', marginBottom: '6px' },
      innerHTML: titleText
    });
    const info = createEl('div', {
      id: contentId,
      styles: {
        maxHeight: '410px',
        overflowY: 'auto',
        padding: '4px',
        borderRadius: '6px',
        color: dark ? THEME_COLORS.inputDarkText : THEME_COLORS.inputLightText
      }
    });
    container.append(title, info);
    fetch(chrome.runtime.getURL(sourcePath))
      .then(r => r.text())
      .then(html => { info.innerHTML = html; })
      .catch(err => console.error(`[PromptManager] Failed to load ${sourcePath}:`, err));
    ScrollVisibilityManager.observe(info);
    return container;
  };

  // COMMENT: Central map defining builder + UI rules for each panel view.
  const VIEW_DEFINITIONS = {
    [PanelView.LIST]: {
      kind: 'list',
      panelHeight: 'variable',
      searchVisible: true,
      alwaysRebuild: false,
      description: 'Prompt list view needs live data + persisted tags every time.',
      async controller(listEl) {
        try {
          PromptUIManager.setListMode('list');
          const prompts = await PromptStorageManager.getPrompts();
          let savedTag = 'all';
          try {
            savedTag = (await PromptStorageManager.getActiveTagFilter()) || 'all';
          } catch (_) {
            savedTag = 'all';
          }
          PromptUIManager.activeTagFilter = savedTag;
          PromptUIManager.refreshPromptList(prompts);
          PromptUIManager.filterByTag(savedTag);
          PromptUIManager.showPromptList(listEl);
        } catch (err) {
          console.error('[PromptManager] Failed to render LIST view:', err);
        }
      }
    },
    [PanelView.CREATE]: {
      builder: () => PromptUIManager.createPromptCreationForm(''),
      panelHeight: 'create',
      searchVisible: false,
      description: 'Create view uses a wider, taller panel; search stays hidden.'
    },
    [PanelView.EDIT]: {
      kind: 'list',
      panelHeight: 'variable',
      searchVisible: true,
      alwaysRebuild: false,
      description: 'Edit view reuses the prompt list with edit + reorder controls.',
      async controller(listEl) {
        try {
          PromptUIManager.setListMode('edit');
          const prompts = await PromptStorageManager.getPrompts();
          let savedTag = 'all';
          try {
            savedTag = (await PromptStorageManager.getActiveTagFilter()) || 'all';
          } catch (_) {
            savedTag = 'all';
          }
          PromptUIManager.activeTagFilter = savedTag;
          PromptUIManager.refreshPromptList(prompts);
          PromptUIManager.filterByTag(savedTag);
          PromptUIManager.showPromptList(listEl);
        } catch (err) {
          console.error('[PromptManager] Failed to render EDIT view:', err);
        }
      }
    },
    [PanelView.SETTINGS]: {
      builder: () => PromptUIManager.createSettingsForm(),
      panelHeight: 'fixed',
      searchVisible: false,
      description: 'Settings is a standalone form with no search.'
    },
    [PanelView.CHANGELOG]: {
      builder: () => createInfoView({
        titleText: 'Changelog',
        contentId: SELECTORS.CHANGELOG_CONTENT,
        sourcePath: 'changelog.html'
      }),
      panelHeight: 'fixed',
      searchVisible: false,
      description: 'Changelog mirrors the help view but sources changelog.html.'
    },
    [PanelView.VARIABLE_INPUT]: {
      builder: (context) => PromptUIManager.createVariableInputForm(context),
      panelHeight: 'fixed',
      searchVisible: false,
      description: 'Variable input form that collects placeholder values before insertion.',
      requiresContext: true,
      alwaysRebuild: true
    },
    [PanelView.EDIT_PROMPT]: {
      builder: (context) => PromptUIManager.buildEditPromptForm(context.prompt),
      panelHeight: 'create',
      searchVisible: false,
      description: 'Single-prompt edit form with back navigation.',
      requiresContext: true,
      alwaysRebuild: true
    }
  };

  const applyViewChrome = (definition) => {
    // COMMENT: panelHeight drives fixed, variable, or create-specific panel dimensions.
    const heightMode = definition.panelHeight || 'fixed';
    PromptUIManager.setPanelHeightMode(heightMode);
    PromptUIManager.setSearchVisibility(definition.searchVisible !== false);
    Theme.applyAll();
  };

  const mount = async (view, context = undefined) => {
    const definition = VIEW_DEFINITIONS[view];
    if (!definition) return;
    if (definition.requiresContext && (view === PanelView.EDIT_PROMPT ? !context?.prompt : !context)) {
      console.warn(`[PromptManager] Missing context for view ${view}`);
      return;
    }

    const listEl = qs(`#${SELECTORS.PROMPT_LIST}`);
    if (!listEl) return;

    const panelContent = listEl.querySelector(`#${SELECTORS.PANEL_CONTENT}`);
    const hasRenderedView = panelContent && (
      panelContent.querySelector(`.${SELECTORS.PROMPT_ITEMS_CONTAINER}.opm-view-list`)
      || panelContent.querySelector('.opm-create-form')
      || panelContent.querySelector('.opm-form-container')
    );
    if (state.currentView === view && !definition.alwaysRebuild && hasRenderedView) {
      // COMMENT: Skip rebuild only when the same view is already rendered in the current list node
      PromptUIManager.showPromptList(listEl);
      return;
    }

    const previousView = state.currentView;
    const shouldAnimate = listEl.classList.contains('opm-visible')
      && previousView !== null
      && previousView !== view;
    const targetHeightMode = definition.panelHeight || 'fixed';

    const applyView = async () => {
      // COMMENT: Drop tag-input document/window listeners before the form is replaced
      window.TagUI?.destroyOpenInputs?.();

      state.currentView = view;
      PromptUIManager.inVariableInputMode = (view === PanelView.VARIABLE_INPUT);

      if (definition.kind === 'list') {
        applyViewChrome(definition);
        await definition.controller(listEl);
        return;
      }

      const builder = definition.builder;
      if (!builder) return;

      // COMMENT: Reset the shared panel scaffolding first so builders can rely on
      // the latest tags/search host before injecting their custom content.
      PromptUIManager.resetPromptListContainer();

      let node = null;
      try {
        node = await builder(context);
      } catch (err) {
        console.error(`[PromptManager] Failed to build view "${view}":`, err);
        return;
      }
      if (!node) return;

      PromptUIManager.replacePanelMainContent(node);
      applyViewChrome(definition);
      PromptUIManager.showPromptList(listEl);
    };

    if (shouldAnimate) {
      await PromptUIManager.animatePanelResize(listEl, applyView, targetHeightMode);
    } else {
      await applyView();
    }
  };

  const reset = () => {
    state.currentView = null;
  };

  return { mount, reset };
})();
window.PanelRouter = PanelRouter;

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
      || e.target.closest('.opm-opd-catalog-link')
      || e.target.closest('.opm-button')
      // COMMENT: Tag suggestions render in a portal on #opm-root — keep panel open when picking a tag (#71)
      || e.target.closest('.opm-tag-suggestions')
      || e.target.closest('.opm-tag-row');
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

/* [07] Keyboard Manager */
/* [07] Keyboard Manager (restored simplified version) */
class KeyboardManager {
  static initialized = false;
  static shortcutCache = null;

  static initialize() {
    if (KeyboardManager.initialized) return;
    KeyboardManager.initialized = true;
    document.addEventListener('keydown', KeyboardManager._onKeyDown);
    KeyboardManager._loadShortcut();
    KeyboardManager._attachShortcutWatcher();
  }

  static async _onKeyDown(e) {
    const shortcut = KeyboardManager.shortcutCache || await PromptStorageManager.getKeyboardShortcut();
    if (!KeyboardManager.shortcutCache && shortcut) KeyboardManager.shortcutCache = shortcut;
    // COMMENT: Match the configured modifier + optional shift + key for open/close toggle
    const modifierMatches = Boolean(shortcut?.modifier && e[shortcut.modifier]);
    const shiftMatches = shortcut?.requiresShift ? e.shiftKey : true;
    const keyMatches = shortcut?.key && e.key.toLowerCase() === String(shortcut.key).toLowerCase();
    if (modifierMatches && shiftMatches && keyMatches) {
      e.preventDefault();
      KeyboardManager._togglePromptList();
      return;
    }

    if (e.key === 'Escape') {
      // COMMENT: Pin-picker overlay takes priority over prompt list dismiss while active
      if (window.__OPM_PIN_PICKER_ACTIVE__ && typeof window.__OPM_PIN_PICKER_DISMISS__ === 'function') {
        e.preventDefault();
        window.__OPM_PIN_PICKER_DISMISS__();
        return;
      }
      PromptUIManager.handleGlobalEscape(e);
      return;
    }

    const searchEl = document.getElementById(SELECTORS.PROMPT_SEARCH_INPUT);
    const isSearchActive = document.activeElement === searchEl;
    if (['ArrowUp', 'ArrowDown', 'Enter'].includes(e.key)) {
      PromptUIManager.handleKeyboardNavigation(e, isSearchActive ? 'search' : 'list');
    }
  }

  static async _togglePromptList() {
    // COMMENT: Ensure launcher UI exists before toggling (covers early shortcut before bootstrap)
    let listEl = qs(`#${SELECTORS.PROMPT_LIST}`);
    if (!listEl) {
      await PromptUIManager.injectUIForCurrentMode();
      listEl = qs(`#${SELECTORS.PROMPT_LIST}`);
    }
    if (!listEl) return;
    if (listEl.classList.contains('opm-visible')) {
      PromptUIManager.hidePromptList(listEl);
    } else {
      PromptUIManager.manuallyOpened = true;
      await PromptUIManager.mountListOrCreateBasedOnPrompts();
      // COMMENT: Mounting alone does not reveal the panel — keyboard toggle must show it
      PromptUIManager.showPromptList(listEl);
    }
  }

  static async _loadShortcut() {
    try {
      KeyboardManager.shortcutCache = await PromptStorageManager.getKeyboardShortcut();
    } catch (_) { /* ignore */ }
  }

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
   Reinforce global styles injection guard
   ============================================================================ */
ensureStylesInjected();

// Dark Mode Handling
/* ---------------------------------------------------------------------------
 * Theme handling (dark / light) with subscription hook
 * -------------------------------------------------------------------------*/
let isDarkModeActive = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
// Initialize global forced state (shared with content.shared.js)
if (typeof window.isDarkModeForced === 'undefined') window.isDarkModeForced = false;

/* Read current mode */
const isDarkMode = () => (window.isDarkModeForced ? true : isDarkModeActive);

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
  static async getData(key, def) {
    return await ChromeBridge.storage.get(key, def);
  }

  static async setData(key, value) {
    return await ChromeBridge.storage.set(key, value);
  }
  // ---- Unified prompt operations ----
  static async _ps() {
    // COMMENT: Use the unified module in `src/promptStorage.js` via a dynamic import
    if (this.__ps) return this.__ps;

    // COMMENT: Dynamically import the web-accessible module so content-scripts can use it
    const mod = await import(chrome.runtime.getURL('storage/promptStorage.js'));

    // COMMENT: Build a thin adapter to keep current call-sites unchanged
    this.__ps = {
      getPrompts: mod.getPrompts,
      setPrompts: mod.setPrompts,
      savePrompt: mod.savePrompt,
      updatePrompt: mod.updatePrompt,
      deletePrompt: mod.deletePrompt,
      importPrompts: mod.importPrompts,
      exportPrompts: mod.exportPrompts
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
    // COMMENT: Accept File, legacy array, or full v2 backup object
    return await ps.importPrompts(imported);
  }

  static async exportPrompts() {
    const ps = await this._ps();
    return await ps.exportPrompts();
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
window.PromptStorageManager = PromptStorageManager;



/* UI Manager */
class PromptUIManager {
  // COMMENT: Configuration for the info banner. Toggle 'active' to show/hide.
  static BANNER_CONFIG = {
    active: true,
    // COMMENT: Bump id when banner copy changes so users who dismissed an older banner see the update
    id: 'info-banner-v3',
    html: `<span>
      <strong>New:</strong> Use Open Prompt Manager on ANY site. Enjoy the extension? </br>
      <a href="https://chromewebstore.google.com/detail/open-prompt-manager/gmhaghdbihgenofhnmdbglbkbplolain" target="_blank" rel="noopener noreferrer" style="color:#3674B5;text-decoration:underline;">Leave a review</a>!
    </span>`
  };

  static state = {
    root: null,
    currentMode: null,
    buttonContainer: null,
    hotCornerContainer: null,
    hotCornerVisibilityHandler: null,
    lastPromptsSignature: null,
    listMode: 'list',
    tagsBar: null,
    suppressNextListRefresh: false,
    listPanelPromptCount: 0,
    listPanelHeight: null
  };

  static _ensureRoot() {
    let root = PromptUIManager.state.root;
    if (root && document.body.contains(root)) return root;
    root = document.getElementById(SELECTORS.ROOT);
    if (!root) {
      root = createEl('div', { id: SELECTORS.ROOT });
      document.body.appendChild(root);
      root.classList.add(`opm-${getMode()}`);
    }
    PromptUIManager.state.root = root;
    return root;
  }
  // COMMENT: Toggle panel height mode: 'variable' (LIST) or 'fixed' (other views)
  static PANEL_RESIZE_MS = 180;
  static PANEL_DIMENSIONS = {
    create: { width: 360, height: 480 },
    fixed: { width: 300, height: 400 },
    variable: { width: 300, maxHeight: 400 }
  };
  // COMMENT: List panel height derives from total prompt count (not tag/search filtered subset).
  static LIST_PANEL_LAYOUT = {
    width: 300,
    maxHeight: 400,
    minHeight: 220,
    baseChrome: 158,
    tagsBar: 34,
    banner: 56,
    itemsAreaPadding: 28,
    itemsMaxScroll: 350,
    itemHeightList: 32,
    itemHeightEdit: 44
  };
  static _deferHeightMode = false;
  static _pendingHeightMode = null;
  static _panelResizeAnimation = null;
  static _listLayoutReady = null;

  static _beginDeferredHeightMode() {
    PromptUIManager._deferHeightMode = true;
    PromptUIManager._pendingHeightMode = null;
  }

  static _endDeferredHeightMode(fallbackMode) {
    PromptUIManager._deferHeightMode = false;
    const mode = PromptUIManager._pendingHeightMode ?? fallbackMode;
    PromptUIManager._pendingHeightMode = null;
    PromptUIManager.setPanelHeightMode(mode);
  }

  // COMMENT: Derive a stable list panel height from total prompts, optional chrome, and a max cap.
  static computeListPanelHeight(promptCount, { hasTagsBar = false, hasBanner = false, isEditMode = false } = {}) {
    const L = PromptUIManager.LIST_PANEL_LAYOUT;
    const itemHeight = isEditMode ? L.itemHeightEdit : L.itemHeightList;
    const itemsBlock = Math.min(Math.max(promptCount, 0) * itemHeight + L.itemsAreaPadding, L.itemsMaxScroll);
    let height = L.baseChrome + itemsBlock;
    if (hasTagsBar) height += L.tagsBar;
    if (hasBanner) height += L.banner;
    return Math.min(Math.max(Math.round(height), L.minHeight), L.maxHeight);
  }

  // COMMENT: Apply count-based list height; tag/search filters must not call this.
  static syncListPanelHeight(listEl = null) {
    const el = listEl || qs(`#${SELECTORS.PROMPT_LIST}`);
    if (!el) return;
    const panel = el.querySelector(`#${SELECTORS.PANEL_CONTENT}`);
    if (!panel?.querySelector('.opm-view-list')) return;

    const promptCount = PromptUIManager.state.listPanelPromptCount ?? 0;
    const hasTagsBar = !!panel.querySelector('.opm-tags-filter-bar');
    const hasBanner = !!panel.querySelector('.opm-info-banner');
    const isEditMode = PromptUIManager.state.listMode === 'edit';
    const height = PromptUIManager.computeListPanelHeight(promptCount, { hasTagsBar, hasBanner, isEditMode });

    PromptUIManager.state.listPanelHeight = height;
    el.style.setProperty('--opm-list-height', `${height}px`);
  }

  // COMMENT: Fixed/create targets use layout constants; list views use count-based height.
  static _measurePanelTargetSize(listEl, mode) {
    if (mode === 'create') return { ...PromptUIManager.PANEL_DIMENSIONS.create };
    if (mode === 'variable') {
      PromptUIManager.syncListPanelHeight(listEl);
      const height = PromptUIManager.state.listPanelHeight || PromptUIManager.LIST_PANEL_LAYOUT.maxHeight;
      return { width: PromptUIManager.LIST_PANEL_LAYOUT.width, height };
    }
    return { ...PromptUIManager.PANEL_DIMENSIONS.fixed };
  }

  static _clearPanelResizeStyles(listEl) {
    listEl.classList.remove('opm-resizing');
    listEl.style.height = '';
    listEl.style.width = '';
    listEl.style.minHeight = '';
    listEl.style.maxHeight = '';
    listEl.style.overflow = '';
    listEl.style.boxSizing = '';
    listEl.style.transition = '';
  }

  static async _awaitListLayoutReady() {
    const listEl = qs(`#${SELECTORS.PROMPT_LIST}`);
    const panel = listEl?.querySelector(`#${SELECTORS.PANEL_CONTENT}`);
    // COMMENT: Skip waiting when tags/banner chrome is already in the DOM (reopen / tag switch).
    if (panel?.querySelector('.opm-tags-filter-bar') || panel?.querySelector('.opm-info-banner')) {
      PromptUIManager._listLayoutReady = null;
      PromptUIManager.syncListPanelHeight(listEl);
      return;
    }
    const pending = PromptUIManager._listLayoutReady;
    PromptUIManager._listLayoutReady = null;
    if (pending) await pending;
    PromptUIManager.syncListPanelHeight(listEl);
  }

  // COMMENT: List views use count-based height; only tween width when it changed.
  static async _animatePanelResizeToList(listEl, updateFn, startHeight, startWidth) {
    listEl.classList.add('opm-resizing');
    listEl.style.boxSizing = 'border-box';
    listEl.style.overflow = 'hidden';
    listEl.style.height = `${startHeight}px`;
    listEl.style.width = `${startWidth}px`;

    PromptUIManager._beginDeferredHeightMode();
    try {
      await updateFn();
    } catch (err) {
      PromptUIManager._deferHeightMode = false;
      PromptUIManager._pendingHeightMode = null;
      PromptUIManager._panelResizeAnimation?.cancel?.();
      PromptUIManager._panelResizeAnimation = null;
      PromptUIManager._clearPanelResizeStyles(listEl);
      throw err;
    }

    await PromptUIManager._awaitListLayoutReady();
    PromptUIManager.syncListPanelHeight(listEl);

    const targetWidth = PromptUIManager.LIST_PANEL_LAYOUT.width;
    const settledHeight = PromptUIManager.state.listPanelHeight || PromptUIManager.LIST_PANEL_LAYOUT.maxHeight;
    const widthDelta = Math.abs(targetWidth - startWidth);
    const heightDelta = Math.abs(settledHeight - startHeight);

    listEl.style.height = `${settledHeight}px`;
    listEl.style.minHeight = `${settledHeight}px`;
    listEl.style.maxHeight = `${settledHeight}px`;

    const finishList = () => {
      PromptUIManager._panelResizeAnimation?.cancel?.();
      PromptUIManager._panelResizeAnimation = null;
      PromptUIManager._endDeferredHeightMode('variable');
      listEl.classList.remove('opm-resizing');
      listEl.style.height = '';
      listEl.style.minHeight = '';
      listEl.style.maxHeight = '';
      listEl.style.width = '';
      listEl.style.overflow = '';
      listEl.style.boxSizing = '';
    };

    if (widthDelta < 1 && heightDelta < 1) {
      finishList();
      return;
    }

    const animation = listEl.animate(
      [
        { width: `${startWidth}px`, height: `${startHeight}px` },
        { width: `${targetWidth}px`, height: `${settledHeight}px` }
      ],
      {
        duration: PromptUIManager.PANEL_RESIZE_MS,
        easing: 'ease',
        fill: 'forwards'
      }
    );
    PromptUIManager._panelResizeAnimation = animation;

    try {
      await animation.finished;
    } catch (_) {
      // COMMENT: Cancelled by a rapid successive view change — still apply final list chrome.
    } finally {
      finishList();
    }
  }

  // COMMENT: WAAPI tweens width + height together for fixed/create; list views use _animatePanelResizeToList.
  static async animatePanelResize(listEl, updateFn, targetMode = 'fixed') {
    if (!listEl || typeof updateFn !== 'function') return;
    if (!listEl.classList.contains('opm-visible')) {
      await updateFn();
      return;
    }

    PromptUIManager._panelResizeAnimation?.cancel?.();

    const startHeight = listEl.offsetHeight;
    const startWidth = listEl.offsetWidth;

    if (targetMode === 'variable') {
      await PromptUIManager._animatePanelResizeToList(listEl, updateFn, startHeight, startWidth);
      return;
    }

    listEl.classList.add('opm-resizing');
    listEl.style.boxSizing = 'border-box';
    listEl.style.overflow = 'hidden';
    listEl.style.height = `${startHeight}px`;
    listEl.style.width = `${startWidth}px`;

    PromptUIManager._beginDeferredHeightMode();
    try {
      await updateFn();
    } catch (err) {
      PromptUIManager._deferHeightMode = false;
      PromptUIManager._pendingHeightMode = null;
      PromptUIManager._panelResizeAnimation?.cancel?.();
      PromptUIManager._panelResizeAnimation = null;
      PromptUIManager._clearPanelResizeStyles(listEl);
      throw err;
    }

    const target = PromptUIManager._measurePanelTargetSize(listEl, targetMode);
    const heightDelta = Math.abs(target.height - startHeight);
    const widthDelta = Math.abs(target.width - startWidth);

    const finish = () => {
      PromptUIManager._panelResizeAnimation?.cancel?.();
      PromptUIManager._panelResizeAnimation = null;
      PromptUIManager._endDeferredHeightMode(targetMode);
      PromptUIManager._clearPanelResizeStyles(listEl);
    };

    if (heightDelta < 1 && widthDelta < 1) {
      finish();
      return;
    }

    const animation = listEl.animate(
      [
        { width: `${startWidth}px`, height: `${startHeight}px` },
        { width: `${target.width}px`, height: `${target.height}px` }
      ],
      {
        duration: PromptUIManager.PANEL_RESIZE_MS,
        easing: 'ease',
        fill: 'forwards'
      }
    );
    PromptUIManager._panelResizeAnimation = animation;

    try {
      await animation.finished;
    } catch (_) {
      // COMMENT: Animation was cancelled by a rapid successive view change — still apply final chrome.
    } finally {
      finish();
    }
  }

  static setPanelHeightMode(mode) {
    if (PromptUIManager._deferHeightMode) {
      PromptUIManager._pendingHeightMode = mode;
      return;
    }
    const listEl = qs(`#${SELECTORS.PROMPT_LIST}`);
    if (!listEl) return;
    listEl.classList.remove('opm-fixed-400', 'opm-list-sized', 'opm-panel-create');
    if (mode === 'variable') {
      listEl.classList.add('opm-list-sized');
      PromptUIManager.syncListPanelHeight(listEl);
    } else if (mode === 'create') {
      listEl.classList.remove('opm-list-sized');
      listEl.style.removeProperty('--opm-list-height');
      listEl.classList.add('opm-panel-create');
    } else {
      listEl.style.removeProperty('--opm-list-height');
      listEl.classList.add('opm-fixed-400');
    }
  }
  // COMMENT: Track whether the active list should expose editing controls or standard view.
  static setListMode(mode = 'list') {
    const normalized = mode === 'edit' ? 'edit' : 'list';
    PromptUIManager.state.listMode = normalized;
    PromptUIManager.applyListModeClass();
  }
  static applyListModeClass() {
    const root = PromptUIManager._ensureRoot();
    root.classList.toggle('opm-edit-mode-active', PromptUIManager.state.listMode === 'edit');
  }
  static requestListRefreshSuppression() {
    PromptUIManager.state.suppressNextListRefresh = true;
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
    const populateList = (data) => {
      // COMMENT: Always rebuild after (re)injecting the button shell — signature may match an empty list
      PromptUIManager.state.lastPromptsSignature = null;
      PromptUIManager.refreshPromptList(Array.isArray(data) ? data : []);
    };

    // COMMENT: Reuse an existing button container if present in the DOM (survives partial re-inits)
    const existingContainer = document.getElementById(SELECTORS.PROMPT_BUTTON_CONTAINER);
    if (existingContainer) {
      PromptUIManager.state.buttonContainer = existingContainer;
      PromptUIManager.state.currentMode = 'standard';
      populateList(prompts);
      return Promise.resolve();
    }
    if (PromptUIManager.state.buttonContainer &&
        document.body.contains(PromptUIManager.state.buttonContainer)) {
      populateList(prompts);
      return Promise.resolve();
    }

    // COMMENT: Return a promise so mode refresh can await before closing/hiding the panel
    return PromptStorageManager.getButtonPosition().then(pos => {
      const container = createEl('div', { id: SELECTORS.PROMPT_BUTTON_CONTAINER, styles: UI_STYLES.getPromptButtonContainerStyle(pos) });
      const button = createEl('button', { id: SELECTORS.PROMPT_BUTTON, className: 'opm-prompt-button' });
      container.appendChild(button);
      const listEl = createEl('div', { id: SELECTORS.PROMPT_LIST, className: `opm-prompt-list opm-${getMode()} opm-fixed-400` });
      container.appendChild(listEl);
      PromptUIManager._ensureRoot().appendChild(container);
      populateList(prompts);
      PromptUIManager.attachButtonEvents(button, listEl, container, prompts);
      PromptUIManager.makeDraggable(container);
      PromptUIManager.checkAndShowOnboarding(container);
      OutsideClickCloser.ensure();
      PromptUIManager.state.buttonContainer = container;
      PromptUIManager.state.hotCornerContainer = null;
      PromptUIManager.state.currentMode = 'standard';
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

  static attachButtonEvents(button, listEl, container) {
    // COMMENT: Delegate event wiring to internal PromptUI.Events (container enables hover reopen).
    PromptUI.Events.attachButtonEvents(button, listEl, container);
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
    const signature = PromptUIManager.computePromptsSignature(prompts);
    if (signature && PromptUIManager.state.lastPromptsSignature === signature) {
      PromptUIManager.setSearchVisibility(true);
      return;
    }
    PromptUIManager.buildPromptListContainer(prompts);
    PromptUIManager.state.lastPromptsSignature = signature;
    PromptUIManager.setSearchVisibility(true);
  }

  static refreshItemsIfListActive(prompts = []) {   // COMMENT: Only refresh the items list when the prompt list view is active
    const panel = document.getElementById(SELECTORS.PANEL_CONTENT);
    if (!panel) return;
    const items = panel.querySelector(`.${SELECTORS.PROMPT_ITEMS_CONTAINER}.opm-view-list`);
    if (!items) return; // not on the list view – skip to avoid toggling search visibility
    if (PromptUIManager.state.suppressNextListRefresh) {
      PromptUIManager.state.suppressNextListRefresh = false;
      PromptUIManager.setSearchVisibility(true);
      return;
    }
    const signature = PromptUIManager.computePromptsSignature(prompts);
    if (!signature || PromptUIManager.state.lastPromptsSignature !== signature) {
      PromptUIManager.buildPromptListContainer(prompts);
      PromptUIManager.state.lastPromptsSignature = signature;
    }
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

  // COMMENT: Ensure every scrollable region only shows scrollbars while in motion.
  static refreshScrollObservers(context = document) {
    if (!window.ScrollVisibilityManager) return;
    const selectors = [
      `.${SELECTORS.PROMPT_ITEMS_CONTAINER}`,
      '.opm-form-container',
      `#${SELECTORS.CHANGELOG_CONTENT}`,
      '.opm-tags-filter-bar'
    ];
    const ensure = (node) => ScrollVisibilityManager.observe(node);
    selectors.forEach(sel => {
      if (context.matches?.(sel)) ensure(context);
      context.querySelectorAll?.(sel)?.forEach(ensure);
    });
  }

  // COMMENT: Tag filter setter that reruns combined filtering without changing panel height
  static filterByTag(tag) {
    PromptUIManager.activeTagFilter = (tag || 'all');
    // Re-apply current search term to combine filters
    const input = document.getElementById(SELECTORS.PROMPT_SEARCH_INPUT);
    const term = input ? input.value : '';
    PromptUIManager.filterPromptItems(term);
    // COMMENT: Height stays based on total prompt count — not visible/filtered items
    PromptStorageManager.saveActiveTagFilter(PromptUIManager.activeTagFilter);
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
    PromptUIManager.state.listPanelPromptCount = prompts.length;
    Theme.applyNode(listEl);
    const existingPanel = listEl.querySelector(`#${SELECTORS.PANEL_CONTENT}`);
    const existingItems = existingPanel?.querySelector(`.${SELECTORS.PROMPT_ITEMS_CONTAINER}`);
    const previousScrollTop = existingItems ? existingItems.scrollTop : 0;
    listEl.innerHTML = '';
    const mode = PromptUIManager.state.listMode || 'list';
    const content = PromptUI.Views.renderPromptList(prompts, { mode });
    const tagsLayoutReady = content.__opmLayoutReady || Promise.resolve();
    
    // COMMENT: Inject Info Banner if active and not dismissed
    let bannerLayoutReady = Promise.resolve();
    if (PromptUIManager.BANNER_CONFIG.active) {
      bannerLayoutReady = (async () => {
        try {
          const dismissed = await PromptStorageManager.getData('dismissedBanners', []);
          if (dismissed.includes(PromptUIManager.BANNER_CONFIG.id)) return;

          const banner = createEl('div', {
            className: `opm-info-banner opm-${getMode()}`,
            styles: {
              padding: '10px 12px',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'start',
              justifyContent: 'space-between',
              gap: '8px',
              borderBottom: isDarkMode() ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.06)',
              backgroundColor: isDarkMode() ? 'rgba(54, 116, 181, 0.15)' : '#ebf8ff', // Tinted primary/blue
              color: isDarkMode() ? '#E2E8F0' : '#2C5282',
              flex: '0 0 auto',
              lineHeight: '1.4'
            },
            innerHTML: `
              <div style="flex: 1;">${PromptUIManager.BANNER_CONFIG.html}</div>
            `
          });

          const closeBtn = createEl('button', {
            innerHTML: '×',
            styles: {
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: '0 4px', fontSize: '18px', lineHeight: '1', opacity: '0.6',
              color: 'inherit', display: 'flex', alignItems: 'center'
            }
          });
          closeBtn.addEventListener('mouseenter', () => closeBtn.style.opacity = '1');
          closeBtn.addEventListener('mouseleave', () => closeBtn.style.opacity = '0.6');
          closeBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            banner.remove();
            const current = await PromptStorageManager.getData('dismissedBanners', []);
            if (!current.includes(PromptUIManager.BANNER_CONFIG.id)) {
              current.push(PromptUIManager.BANNER_CONFIG.id);
              await PromptStorageManager.setData('dismissedBanners', current);
            }
          });

          banner.appendChild(closeBtn);
          
          // Insert before the tags bar (if present) or at the top
          // The content container has: tagsHost, itemsContainer, bottomMenu.
          content.insertBefore(banner, content.firstChild);
        } catch (err) {
          console.error('[PromptManager] Failed to render banner:', err);
        }
      })();
    }

    PromptUIManager._listLayoutReady = Promise.all([tagsLayoutReady, bannerLayoutReady]).then(() => {
      PromptUIManager.syncListPanelHeight(listEl);
    });

    listEl.appendChild(content);
    const newItems = content.querySelector(`.${SELECTORS.PROMPT_ITEMS_CONTAINER}`);
    if (newItems) {
      newItems.scrollTop = previousScrollTop;
    }
    PromptUIManager.refreshScrollObservers(listEl);
    PromptUIManager.applyListModeClass();
  }

  static resetPromptListContainer() {
    const listEl = qs(`#${SELECTORS.PROMPT_LIST}`);
    const wasVisible = listEl && listEl.classList.contains('opm-visible');
    PromptUIManager.buildPromptListContainer();
    PromptUIManager.state.lastPromptsSignature = null;
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
    PromptUIManager.refreshScrollObservers(panel);
  }

  // COMMENT: Show the prompt list and handle keyboard navigation
  static showPromptList(listEl) {
    if (!listEl) return;
    // COMMENT: Detect whether we are opening the panel (vs already open)
    const wasVisible = listEl.classList.contains('opm-visible');
    // COMMENT: When showing, if current view is LIST, allow variable height; else keep fixed
    const panelNode = document.getElementById(SELECTORS.PANEL_CONTENT);
    const isListView = panelNode && panelNode.querySelector(`.${SELECTORS.PROMPT_ITEMS_CONTAINER}.opm-view-list`);
    const isCreateView = panelNode && panelNode.querySelector('.opm-create-form');
    const isEditPromptView = panelNode && panelNode.querySelector('.opm-edit-prompt-form');
    let heightMode = 'fixed';
    if (isListView) heightMode = 'variable';
    else if (isCreateView || isEditPromptView) heightMode = 'create';
    PromptUIManager.setPanelHeightMode(heightMode);
    PromptUI.Behaviors.showList(listEl);
    const panel = document.getElementById(SELECTORS.PANEL_CONTENT);
    const hasListItems = panel && panel.querySelector(`.${SELECTORS.PROMPT_ITEMS_CONTAINER}.opm-view-list`);
    if (hasListItems) PromptUIManager.syncListPanelHeight(listEl);
    // COMMENT: Reapply existing filters/search when reopening the list instead of refetching storage data
    if (!wasVisible && hasListItems) {
      const searchInput = document.getElementById(SELECTORS.PROMPT_SEARCH_INPUT);
      const currentTerm = searchInput ? searchInput.value : '';
      PromptUIManager.filterPromptItems(currentTerm);
    }
    // COMMENT: Focus only if list view is active
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
    PromptUIManager.manuallyOpened = false;
    // COMMENT: Preserve inVariableInputMode so hover can restore the variable form without remounting.
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
      // COMMENT: Respect active tag/search filters — skip hidden items during list navigation
      items = Array.from(list.querySelectorAll('.opm-prompt-list-item'))
        .filter(item => item.style.display !== 'none');
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

  static createVariableInputForm({ inputBox, content, variables, onSubmit }) {
    PromptUIManager.inVariableInputMode = true;

    const form = createEl('div', {
      className: `opm-form-container opm-variable-input-form opm-${getMode()}`
    });

    // COMMENT: Scrollable field stack — no equal-height flex splits that cause overlap in a fixed panel.
    const varContainer = createEl('div', {
      className: 'opm-variable-fields',
      styles: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        flex: '1 1 auto',
        minHeight: '0',
        overflowY: 'auto',
        paddingBottom: '4px'
      }
    });
    ScrollVisibilityManager.observe(varContainer);

    const varValues = {};
    const submitBtn = createEl('button', { innerHTML: 'Submit', className: `opm-button opm-${getMode()}` });
    const backBtn = createEl('button', { innerHTML: 'Back', className: `opm-button opm-${getMode()}` });

    variables.forEach(v => {
      const displayLabel = String(v).replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
      const row = createEl('div', {
        className: 'opm-variable-row',
        styles: { display: 'flex', flexDirection: 'column', gap: '4px', flex: '0 0 auto' }
      });
      const label = createEl('label', {
        innerHTML: displayLabel,
        className: `opm-${getMode()}`,
        styles: { fontSize: '12px', fontWeight: '600', letterSpacing: '0.2px', opacity: '0.85', lineHeight: '1.2' }
      });
      const inputField = createEl('textarea', {
        attributes: { rows: '2', placeholder: `${displayLabel} value` },
        className: `opm-textarea-field opm-${getMode()}`,
        styles: {
          boxSizing: 'border-box',
          width: '100%',
          minHeight: '44px',
          height: 'auto',
          resize: 'vertical',
          flex: '0 0 auto',
          marginBottom: '0'
        }
      });
      inputField.addEventListener('input', () => { varValues[v] = inputField.value; });
      inputField.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          submitBtn.click();
        }
      });
      row.append(label, inputField);
      varContainer.appendChild(row);
      varValues[v] = '';
    });

    form.appendChild(varContainer);
    PromptUIManager.setPanelHeightMode('fixed');

    // COMMENT: Action row pinned to the bottom of the form, side by side.
    const btnContainer = createEl('div', {
      className: 'opm-variable-actions',
      styles: {
        display: 'flex',
        flexDirection: 'row',
        gap: '8px',
        flex: '0 0 auto',
        marginTop: 'auto',
        paddingTop: '8px'
      }
    });

    submitBtn.addEventListener('click', () => {
      PromptUIManager.inVariableInputMode = false;
      onSubmit(varValues);
    });
    backBtn.addEventListener('click', () => {
      PromptUIManager.inVariableInputMode = false;
      PanelRouter.mount(PanelView.LIST);
    });

    btnContainer.append(submitBtn, backBtn);
    form.appendChild(btnContainer);

    requestAnimationFrame(() => {
      const firstInput = varContainer.querySelector('textarea, input');
      if (firstInput) firstInput.focus();
    });
    return form;
  }

  static createPromptCreationForm(prefill = '') {
    // COMMENT: Delegate to PromptUI.Views to build the creation form
    return PromptUI.Views.createPromptCreationForm(prefill);
  }

  static async showEditForm(prompt /*, index */) {
    if (!prompt || !qs(`#${SELECTORS.PROMPT_LIST}`)) return;
    await PanelRouter.mount(PanelView.EDIT_PROMPT, { prompt });
  }

  // COMMENT: Build the single-prompt edit form (used by PanelRouter for animated transitions).
  static async buildEditPromptForm(prompt) {
    const form = createEl('div', {
      className: `opm-form-container opm-edit-prompt-form opm-${getMode()}`,
      styles: {
        display: 'flex',
        flexDirection: 'column',
        minHeight: '0',
        overflow: 'hidden',
        gap: '0'
      }
    });

    const fields = createEl('div', {
      className: 'opm-edit-prompt-fields',
      styles: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        flex: '1 1 auto',
        minHeight: '0',
        overflowY: 'auto',
        paddingBottom: '4px'
      }
    });
    ScrollVisibilityManager.observe(fields);

    const titleIn = createEl('input', {
      attributes: { placeholder: 'Prompt Title' },
      className: `opm-input-field opm-${getMode()}`,
      styles: { borderRadius: '4px', flex: '0 0 auto' }
    });
    const contentArea = createEl('textarea', {
      attributes: { placeholder: 'Write your prompt. Use hashtags for #variables#' },
      className: `opm-textarea-field opm-${getMode()}`,
      styles: { flex: '1 1 auto', minHeight: '120px', resize: 'vertical', boxSizing: 'border-box' }
    });
    titleIn.value = prompt.title || '';
    contentArea.value = prompt.content || '';
    fields.append(titleIn, contentArea);

    const enableTags = await PromptStorageManager.getEnableTags();
    let tagInput = null;
    if (enableTags) {
      tagInput = window.TagUI.createTagInput({ initialTags: Array.isArray(prompt.tags) ? prompt.tags : [] });
      const tagsBlock = createEl('div', { styles: { flex: '0 0 auto' } });
      tagsBlock.append(tagInput.element);
      fields.appendChild(tagsBlock);
    }

    form.appendChild(fields);

    const btnContainer = createEl('div', {
      className: 'opm-form-actions opm-variable-actions',
      styles: {
        display: 'flex',
        flexDirection: 'row',
        gap: '8px',
        flex: '0 0 auto',
        marginTop: 'auto',
        paddingTop: '8px'
      }
    });

    const backBtn = createEl('button', { innerHTML: 'Back', className: `opm-button opm-${getMode()}` });
    backBtn.addEventListener('click', () => {
      PanelRouter.mount(PromptUIManager.state.listMode === 'edit' ? PanelView.EDIT : PanelView.LIST);
    });

    const saveBtn = createEl('button', { innerHTML: 'Save Changes', className: `opm-button opm-${getMode()}` });
    saveBtn.addEventListener('click', async e => {
      e.stopPropagation();
      const t = titleIn.value.trim();
      const c = contentArea.value.trim();
      if (!t || !c) { alert('Please fill in both title and content.'); return; }
      const ps = await PromptStorageManager._ps();
      const update = { title: t, content: c };
      if (tagInput) update.tags = tagInput.getTags();
      await ps.updatePrompt(prompt.uuid, update);
      PanelRouter.mount(PromptUIManager.state.listMode === 'edit' ? PanelView.EDIT : PanelView.LIST);
    });

    btnContainer.append(saveBtn, backBtn);
    form.appendChild(btnContainer);
    form.addEventListener('click', e => e.stopPropagation());

    requestAnimationFrame(() => titleIn.focus());
    return form;
  }

  static async deletePrompt(uuid) {
    const ps = await PromptStorageManager._ps();
    await ps.deletePrompt(uuid);
    await PanelRouter.mount(PanelView.EDIT);
  }
  
  static createSettingsForm() {
    // COMMENT: Delegate to PromptUI.Views to build the settings form
    return PromptUI.Views.createSettingsForm();
  }

  static computePromptsSignature(prompts = []) {
    if (!Array.isArray(prompts)) return null;
    try {
      return prompts.map(p => `${p?.uuid || ''}:${p?.updatedAt || p?.createdAt || ''}`).join('|');
    } catch (err) {
      console.error('[PromptManager] Failed to compute prompts signature:', err);
      return null;
    }
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
  static _usesCornerLauncher(mode) {
    return mode === 'hotCorner' || mode === 'invisible';
  }

  // COMMENT: Shared bottom-right prompt list anchor used by hot corner and invisible modes
  static _mountCornerPromptList(containerId, containerStyles) {
    const container = createEl('div', { id: containerId, styles: containerStyles });
    const listEl = createEl('div', {
      id: SELECTORS.PROMPT_LIST,
      className: `opm-prompt-list opm-${getMode()} opm-fixed-400`,
      styles: {
        position: 'absolute',
        right: '30px',
        bottom: '30px',
      },
    });
    container.appendChild(listEl);
    PromptUIManager._ensureRoot().appendChild(container);
    OutsideClickCloser.ensure();
    return { container, listEl };
  }

  static injectHotCorner() {
    // COMMENT: Reuse an existing hot-corner container if already mounted in the DOM
    const existingHotCorner = document.getElementById(SELECTORS.HOT_CORNER_CONTAINER);
    if (existingHotCorner) {
      PromptUIManager.state.hotCornerContainer = existingHotCorner;
      PromptUIManager.state.currentMode = 'hotCorner';
      return;
    }
    if (PromptUIManager.state.hotCornerContainer &&
        document.body.contains(PromptUIManager.state.hotCornerContainer)) {
      return;
    }

    // container with active zone
    const { container, listEl } = PromptUIManager._mountCornerPromptList(
      SELECTORS.HOT_CORNER_CONTAINER,
      UI_STYLES.hotCornerActiveZone,
    );

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

    // Setup event handlers
    this.setupHotCornerEvents(container, indicator, listEl);
    PromptUIManager.state.hotCornerContainer = container;
    PromptUIManager.state.buttonContainer = null;
    PromptUIManager.state.currentMode = 'hotCorner';
  }

  // COMMENT: Shortcut-only launcher — same panel position as hot corner, no visible trigger
  static injectInvisibleLauncher() {
    const existingInvisible = document.getElementById(SELECTORS.INVISIBLE_LAUNCHER_CONTAINER);
    if (existingInvisible) {
      PromptUIManager.state.hotCornerContainer = existingInvisible;
      PromptUIManager.state.currentMode = 'invisible';
      return;
    }

    const { container, listEl } = PromptUIManager._mountCornerPromptList(
      SELECTORS.INVISIBLE_LAUNCHER_CONTAINER,
      UI_STYLES.invisibleLauncherAnchor,
    );
    listEl.style.pointerEvents = 'auto';

    PromptUIManager.setupInvisibleLauncherEvents(listEl);
    PromptUIManager.state.hotCornerContainer = container;
    PromptUIManager.state.buttonContainer = null;
    PromptUIManager.state.currentMode = 'invisible';
  }

  // COMMENT: Close/hide behavior for invisible mode without hover-to-open
  static setupInvisibleLauncherEvents(listEl) {
    listEl.addEventListener('mouseenter', () => {
      PromptUIManager.cancelCloseTimer();
    });
    listEl.addEventListener('mouseleave', (e) => {
      PromptUIManager.startCloseTimer(e, listEl, () => {
        PromptUIManager.manuallyOpened = false;
      });
    });

    const visibilityHandler = () => {
      if (document.hidden) {
        PromptUIManager.manuallyOpened = false;
        PromptUIManager.inVariableInputMode = false;
        PromptUI.Behaviors.hideList(listEl);
      }
    };
    document.addEventListener('visibilitychange', visibilityHandler);
    PromptUIManager.state.hotCornerVisibilityHandler = visibilityHandler;
  }

  // Extracted event handling for hot corner
  static setupHotCornerEvents(container, indicator, listEl) {
    container.addEventListener('mouseenter', async e => {
      e.stopPropagation();
      PromptUIManager.cancelCloseTimer();

      const listIsVisible = listEl.classList.contains('opm-visible');
      if (listIsVisible) {
        indicator.style.borderWidth = `0 0 ${HOT_CORNER_INDICATOR_LARGE_PX}px ${HOT_CORNER_INDICATOR_LARGE_PX}px`;
        indicator.style.borderColor = `transparent transparent ${THEME_COLORS.primary} transparent`;
        return;
      }

      indicator.style.borderWidth = `0 0 ${HOT_CORNER_INDICATOR_LARGE_PX}px ${HOT_CORNER_INDICATOR_LARGE_PX}px`;
      indicator.style.borderColor = `transparent transparent ${THEME_COLORS.primary} transparent`;

      const hasVariableForm = listEl.querySelector('.opm-variable-input-form');
      const hasEditForm = listEl.querySelector('.opm-edit-prompt-form');
      if (hasVariableForm) {
        PromptUIManager.inVariableInputMode = true;
        PromptUI.Behaviors.showList(listEl);
        return;
      }
      if (hasEditForm) {
        PromptUI.Behaviors.showList(listEl);
        return;
      }
      if (!PromptUIManager.inVariableInputMode) {
        PromptUIManager.manuallyOpened = false;
        await PromptUIManager.mountListOrCreateBasedOnPrompts();
        PromptUI.Behaviors.showList(listEl);
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
      });
    });

    container.addEventListener('mouseleave', e => {
      e.stopPropagation();
      indicator.style.borderWidth = `0 0 ${HOT_CORNER_INDICATOR_SMALL_PX}px ${HOT_CORNER_INDICATOR_SMALL_PX}px`;
      indicator.style.borderColor = `transparent transparent ${THEME_COLORS.primary}90 transparent`;
      PromptUIManager.startCloseTimer(e, listEl, () => {
        PromptUIManager.manuallyOpened = false;
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
    PromptUIManager.state.hotCornerVisibilityHandler = visibilityHandler;

    // Set onboarding as completed when hovering over hot corner
    container.addEventListener('mouseenter', () => { PromptUIManager.completeOnboarding(); });
  }

  static cleanupAllUIComponents() {
    // Clean up button container
    if (PromptUIManager.state.buttonContainer &&
        document.body.contains(PromptUIManager.state.buttonContainer)) {
      PromptUIManager.state.buttonContainer.remove();
    }

    // Clean up hot corner container
    if (PromptUIManager.state.hotCornerVisibilityHandler) {
      document.removeEventListener('visibilitychange', PromptUIManager.state.hotCornerVisibilityHandler);
      PromptUIManager.state.hotCornerVisibilityHandler = null;
    }
    if (PromptUIManager.state.hotCornerContainer &&
        document.body.contains(PromptUIManager.state.hotCornerContainer)) {
      PromptUIManager.state.hotCornerContainer.remove();
    }

    // COMMENT: Remove any launcher shells even if state refs were lost mid-refresh
    [SELECTORS.PROMPT_BUTTON_CONTAINER, SELECTORS.HOT_CORNER_CONTAINER, SELECTORS.INVISIBLE_LAUNCHER_CONTAINER]
      .forEach((id) => {
        const el = document.getElementById(id);
        if (el && document.body.contains(el)) el.remove();
      });

    // COMMENT: Drop cached view so the next open remounts into the fresh list container
    window.TagUI?.destroyOpenInputs?.();
    PanelRouter.reset();

    // Clean up any other global handlers or state
    PromptUIManager.manuallyOpened = false;
    PromptUIManager.inVariableInputMode = false;
    PromptUIManager.state.buttonContainer = null;
    PromptUIManager.state.hotCornerContainer = null;
    PromptUIManager.state.currentMode = null;
    PromptUIManager.state.lastPromptsSignature = null;
  }

  static async refreshDisplayMode() {
    // COMMENT: Coalesce overlapping refreshes (in-page save + storage.onChanged fire together)
    if (PromptUIManager._displayModeRefreshPromise) {
      return PromptUIManager._displayModeRefreshPromise;
    }

    PromptUIManager._displayModeRefreshPromise = (async () => {
      PromptUIManager.cleanupAllUIComponents();
      const prompts = await PromptStorageManager.getPrompts();
      await PromptUIManager.injectUIForCurrentMode(prompts, { skipCleanup: true });

      PromptUIManager.refreshItemsIfListActive(prompts);
      const listEl = qs(`#${SELECTORS.PROMPT_LIST}`);
      if (listEl && listEl.classList.contains('opm-visible')) {
        PromptUIManager.hidePromptList(listEl);
      }
    })().finally(() => {
      PromptUIManager._displayModeRefreshPromise = null;
    });

    return PromptUIManager._displayModeRefreshPromise;
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
  static async injectUIForCurrentMode(prompts, { skipCleanup = false } = {}) {
    const displayMode = await PromptStorageManager.getDisplayMode();

    if (!skipCleanup) {
      // COMMENT: Skip reinjection when the requested mode is already mounted and healthy
      const hasButtonUI = PromptUIManager.state.buttonContainer &&
        document.body.contains(PromptUIManager.state.buttonContainer);
      const hasHotCornerUI = PromptUIManager.state.hotCornerContainer &&
        document.body.contains(PromptUIManager.state.hotCornerContainer);
      if (PromptUIManager.state.currentMode === displayMode) {
        if (displayMode === 'standard' && hasButtonUI) {
          if (prompts) PromptUIManager.refreshPromptList(prompts);
          return;
        }
        if (PromptUIManager._usesCornerLauncher(displayMode) && hasHotCornerUI) return;
      }

      PromptUIManager.cleanupAllUIComponents();
    }

    if (displayMode === 'standard') {
      const data = prompts || await PromptStorageManager.getPrompts();
      await PromptUIManager.injectPromptManagerButton(data);
    } else if (displayMode === 'hotCorner') {
      PromptUIManager.injectHotCorner();
    } else if (displayMode === 'invisible') {
      PromptUIManager.injectInvisibleLauncher();
    } else {
      PromptUIManager.injectHotCorner();
    }
  }
}

window.PromptUIManager = PromptUIManager;

if (typeof window.__initPromptShared === 'function') {
  window.__initPromptShared();
}
const { TagService, TagUI, PromptUI } = window;

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
const PromptMediator = (() => {
  const state = {
    initialized: false,
    processor: null,
    promptSelectHandler: null,
    mutationObserver: null,
    storageWatcherAttached: false,
    uiRecoverInProgress: false,
  };

  /**
   * COMMENT: Main prompt selection handler reused across listeners.
   * @param {Prompt} prompt
   */
  const handlePromptSelect = async (prompt) => {
    // COMMENT: Be resilient — if input box isn't ready yet, wait briefly before giving up
    let inputBox = await window.InputBoxHandler.getInputBox();
    if (!inputBox) {
      try {
        inputBox = await window.InputBoxHandler.waitForInputBox();
      } catch (_) {
        console.error('Input box not found.');
        return;
      }
    }
    const vars = state.processor.extractVariables(prompt.content);
    const listEl = qs(`#${SELECTORS.PROMPT_LIST}`);
    if (vars.length === 0) {
      await window.InputBoxHandler.insertPrompt(inputBox, prompt.content, listEl);
      PromptUIManager.hidePromptList(listEl);
      return;
    }
    PanelRouter.mount(PanelView.VARIABLE_INPUT, {
      inputBox,
      content: prompt.content,
      variables: vars,
      onSubmit: async values => {
        const processed = state.processor.replaceVariables(prompt.content, values);
        await window.InputBoxHandler.insertPrompt(inputBox, processed, qs(`#${SELECTORS.PROMPT_LIST}`));
        const activeList = qs(`#${SELECTORS.PROMPT_LIST}`);
        if (activeList) PromptUIManager.hidePromptList(activeList);
        setTimeout(() => {
          PromptStorageManager.getPrompts()
            .then(nextPrompts => { PromptUIManager.refreshPromptList(nextPrompts); })
            .catch(err => console.error('Failed to refresh prompt list after variable submission:', err));
        }, 300);
      }
    });
  };

  const ensurePromptSelectionListener = () => {
    if (state.promptSelectHandler) return;
    state.promptSelectHandler = handlePromptSelect;
    PromptUIManager.onPromptSelect(state.promptSelectHandler);
  };

  const setupMutationObserver = () => {
    if (state.mutationObserver) return;
    const target = document.querySelector('main') || document.body;
    if (!target) return;

    const ensureUIVisible = debounce(async () => {
      // COMMENT: Skip work when the injected UI is still present in the DOM
      if (document.getElementById(SELECTORS.PROMPT_BUTTON_CONTAINER)
        || document.getElementById(SELECTORS.HOT_CORNER_CONTAINER)
        || document.getElementById(SELECTORS.INVISIBLE_LAUNCHER_CONTAINER)) {
        return;
      }
      if (state.uiRecoverInProgress) return;

      state.uiRecoverInProgress = true;
      try {
        const prompts = await PromptStorageManager.getPrompts();
        await PromptUIManager.injectUIForCurrentMode(prompts);
      } finally {
        state.uiRecoverInProgress = false;
      }
    }, MUTATION_DEBOUNCE_MS);

    state.mutationObserver = new MutationObserver(ensureUIVisible);
    state.mutationObserver.observe(target, { childList: true, subtree: true });
  };

  const setupDisplayModeWatcher = () => {
    if (!chrome?.storage?.onChanged) return;
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes.displayMode) {
        PromptUIManager.refreshDisplayMode().catch((err) => {
          console.error('Failed to refresh display mode after storage change:', err);
        });
      }
      if (changes.forceDarkMode) {
        window.isDarkModeForced = !!changes.forceDarkMode.newValue;
        PromptUIManager.updateThemeForUI();
      }
    });
  };

  const setupStorageChangeMonitor = () => {
    if (state.storageWatcherAttached) return;
    state.storageWatcherAttached = true;
    (async () => {
      try {
        const { onPromptsChanged } = await import(chrome.runtime.getURL('storage/promptStorage.js'));
        onPromptsChanged((prompts) => {
          // COMMENT: Only refresh items when the list view is active to avoid polluting non-list views
          PromptUIManager.refreshItemsIfListActive(prompts);
        });
      } catch (err) {
        state.storageWatcherAttached = false; // COMMENT: Allow retry if import fails transiently
        console.error('Failed to attach unified prompts change listener:', err);
      }
    })();
  };

  const setupKeyboardShortcuts = () => {
    KeyboardManager.initialize();
  };

  const bootstrap = async (ui, processor) => {
    // COMMENT: Global guard prevents duplicate UI when scripts are re-injected on SPA navigations
    if (window.__OPM_INITIALIZED__ || state.initialized) return;
    window.__OPM_INITIALIZED__ = true;
    state.initialized = true;
    
    // COMMENT: Load theme preference before UI injection
    try {
      window.isDarkModeForced = await PromptStorageManager.getForceDarkMode();
    } catch (_) { /* ignore */ }

    state.processor = processor;
    ensurePromptSelectionListener();
    // COMMENT: Inject UI immediately on page load without waiting for input box detection
    PromptStorageManager.getPrompts()
      .then(prompts => PromptUIManager.injectUIForCurrentMode(prompts))
      .catch(err => console.error('Error initializing extension UI:', err));
    setupMutationObserver();
    setupDisplayModeWatcher();
    setupStorageChangeMonitor();
    setupKeyboardShortcuts();
  };

  return { bootstrap };
})();

/* Initialize the extension */
setTimeout(() => { PromptMediator.bootstrap(PromptUIManager, PromptProcessor); }, 50);
