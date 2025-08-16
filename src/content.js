/* Global constants, helpers & styles */
const THEME_COLORS = {
  primary: '#3674B5', primaryGradientStart: '#3674B5', primaryGradientEnd: '#578FCA',
  hoverPrimary: '#205295', darkBackground: '#0A2647', lightBackground: '#F7FAFC',
  darkBorder: '#144272', lightBorder: '#E2E8F0',
  darkShadow: '0 4px 20px rgba(0,0,0,0.3)', lightShadow: '0 4px 20px rgba(0,0,0,0.15)',
  inputDarkBorder: '1px solid #4A5568', inputLightBorder: '1px solid #CBD5E0',
  inputDarkBg: '#2D3748', inputLightBg: '#FFFFFF',
  inputDarkText: '#E2E8F0', inputLightText: '#2D3748'
};

// UI style definitions for positioning and appearance
const UI_STYLES = {
  getPromptButtonContainerStyle: pos => ({
    position: 'fixed', zIndex: '9999',
    bottom: `${pos.y}px`, right: `${pos.x}px`,
    width: '40px', height: '40px',
    userSelect: 'none',
  }),
  hotCornerActiveZone: {
    position: 'fixed',
    bottom: '0',
    right: '0',
    width: '60px',
    height: '60px',
    zIndex: '9998',
    backgroundColor: 'transparent'
  }
};

// Time delay for auto close
const PROMPT_CLOSE_DELAY = 10000;

// Selectors for DOM elements (namespaced with opm-)
const SELECTORS = {
  ROOT: 'opm-root',
  PROMPT_BUTTON_CONTAINER: 'opm-prompt-button-container',
  PROMPT_BUTTON: 'opm-prompt-button',
  PROMPT_LIST: 'opm-prompt-list',
  PANEL_CONTENT: 'opm-panel-content',
  PROMPT_SEARCH_INPUT: 'opm-prompt-search-input',
  PROMPT_ITEMS_CONTAINER: 'opm-prompt-items-container',
  ONBOARDING_POPUP: 'opm-onboarding-popup',
  HOT_CORNER_CONTAINER: 'opm-hot-corner-container',
  HOT_CORNER_INDICATOR: 'opm-hot-corner-indicator',
  INFO_CONTENT: 'opm-info-content',
  CHANGELOG_CONTENT: 'opm-changelog-content'
};

// Helper function for creating DOM elements
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
 * Utility: debounce
 * Provides a simple debounce wrapper to coalesce rapid successive calls.
 * Example:
 *   const debouncedFn = debounce(() => console.log('run'), 300);
 * -------------------------------------------------------------------------*/
const debounce = (fn, wait = 100) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(null, args), wait);
  };
};

// Helper functions for theme and UI manipulation
const getMode = () => (isDarkMode() ? 'dark' : 'light');
const applyTheme = el => { el.classList.remove('opm-light', 'opm-dark'); el.classList.add(`opm-${getMode()}`); };
const showEl = el => {
  // Respect intended display for our panel
  const isPromptList = el.classList && el.classList.contains('opm-prompt-list');
  el.style.display = isPromptList ? 'flex' : 'block';
  void el.offsetHeight;
  el.classList.add('opm-visible');
};
const hideEl = el => {
  el.classList.remove('opm-visible');
  setTimeout(() => {
    el.style.display = 'none';
    const items = el.querySelector(`.${SELECTORS.PROMPT_ITEMS_CONTAINER}`);
    if (items) Array.from(items.children).forEach(i => i.style.display = 'flex');
  }, 200);
};

/* ============================================================================
   Inject Global Styles
   ============================================================================ */
function injectGlobalStyles() {
  const styleEl = createEl('style');
  styleEl.textContent = `
    #${SELECTORS.ROOT} {
      --primary: ${THEME_COLORS.primary};
      --primary-gradient-start: ${THEME_COLORS.primaryGradientStart};
      --primary-gradient-end: ${THEME_COLORS.primaryGradientEnd};
      --hover-primary: ${THEME_COLORS.hoverPrimary};
      --dark-bg: ${THEME_COLORS.darkBackground};
      --light-bg: ${THEME_COLORS.lightBackground};
      --dark-border: ${THEME_COLORS.darkBorder};
      --light-border: ${THEME_COLORS.lightBorder};
      --dark-shadow: ${THEME_COLORS.darkShadow};
      --light-shadow: ${THEME_COLORS.lightShadow};
      --input-dark-border: ${THEME_COLORS.inputDarkBorder};
      --input-light-border: ${THEME_COLORS.inputLightBorder};
      --input-dark-bg: ${THEME_COLORS.inputDarkBg};
      --input-light-bg: ${THEME_COLORS.inputLightBg};
      --input-dark-text: ${THEME_COLORS.inputDarkText};
      --input-light-text: ${THEME_COLORS.inputLightText};
      --transition-speed: 0.3s;
      --border-radius: 8px;
      --font-family: 'Roboto', sans-serif;
    }
    
    /* New scrollbar styling for our specific containers */
    /* Legacy selectors kept temporarily for smoother transition; safe under #opm-root */
    #${SELECTORS.ROOT} .opm-prompt-list-items,
    #${SELECTORS.ROOT} .opm-prompt-list-items *,
    #${SELECTORS.ROOT} #opm-info-content,
    #${SELECTORS.ROOT} #opm-changelog-content {
      scrollbar-width: auto !important;
      scrollbar-color: ${THEME_COLORS.primary}90 transparent !important;
    }

    /* WebKit scrollbar styling for consistency */
    #${SELECTORS.ROOT} .opm-prompt-list-items::-webkit-scrollbar,
    #${SELECTORS.ROOT} #opm-info-content::-webkit-scrollbar,
    #${SELECTORS.ROOT} #opm-changelog-content::-webkit-scrollbar {
      width: 10px;
    }
    #${SELECTORS.ROOT} .opm-prompt-list-items::-webkit-scrollbar-thumb,
    #${SELECTORS.ROOT} #opm-info-content::-webkit-scrollbar-thumb,
    #${SELECTORS.ROOT} #opm-changelog-content::-webkit-scrollbar-thumb {
      background-color: ${THEME_COLORS.primary}90;
      border-radius: 8px;
    }
    #${SELECTORS.ROOT} .opm-prompt-list-items::-webkit-scrollbar-track,
    #${SELECTORS.ROOT} #opm-info-content::-webkit-scrollbar-track,
    #${SELECTORS.ROOT} #opm-changelog-content::-webkit-scrollbar-track {
      background: transparent;
    }
    
    #${SELECTORS.ROOT}, #${SELECTORS.ROOT} * { font-family: var(--font-family); }
    /* Prompt Button styling */
    #${SELECTORS.ROOT} .opm-prompt-button {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      border: none;
      outline: none;
      cursor: pointer;
      background: linear-gradient(135deg, var(--primary-gradient-start), var(--primary-gradient-end));
      background-size: cover;
      box-shadow: var(--light-shadow);
      transition: transform var(--transition-speed) ease, box-shadow var(--transition-speed) ease;
      background-position: center;
      background-repeat: no-repeat;
      position: relative;
    }
    
    /* Toggle switch styling */
    #${SELECTORS.ROOT} .opm-toggle-switch {
      position: relative;
      width: 40px;
      height: 20px;
      border-radius: 10px;
      cursor: pointer;
      transition: background-color var(--transition-speed) ease;
    }
    
    #${SELECTORS.ROOT} .opm-toggle-switch.opm-light {
      background-color: #cbd5e0;
    }
    
    #${SELECTORS.ROOT} .opm-toggle-switch.opm-dark {
      background-color: #4a5568;
    }
    
    #${SELECTORS.ROOT} .opm-toggle-switch.active.opm-light {
      background-color: var(--primary);
    }
    
    #${SELECTORS.ROOT} .opm-toggle-switch.active.opm-dark {
      background-color: var(--primary);
    }
    
    #${SELECTORS.ROOT} .opm-toggle-switch::after {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background-color: #fff;
      transition: transform var(--transition-speed) ease;
    }
    
    #${SELECTORS.ROOT} .opm-toggle-switch.active::after {
      transform: translateX(20px);
    }
    
    /* Prompt Button styling */
    #${SELECTORS.ROOT} .opm-prompt-button::after {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-image: url('${chrome.runtime.getURL('icons/icon-button.png')}');
      background-size: 50%;
      background-position: center;
      background-repeat: no-repeat;
    }
    #${SELECTORS.ROOT} .opm-prompt-button:hover {
      transform: scale(1.05);
      box-shadow: var(--dark-shadow);
    }
    /* Prompt list container styling */
    #${SELECTORS.ROOT} .opm-prompt-list {
      position: absolute;
      bottom: 50px;
      right: 0;
      padding: 10px;
      border-radius: var(--border-radius);
      display: none;
      width: 280px;
      z-index: 10000;
      opacity: 0;
      transform: translateY(10px);
      transition: opacity var(--transition-speed) ease, transform var(--transition-speed) ease;
      backdrop-filter: blur(12px);
      /* Constrain panel and let inner list scroll */
      display: flex;
      flex-direction: column;
      max-height: 450px;
      overflow: hidden;
    }
    /* Dedicated scrollable content container inside the panel */
    #${SELECTORS.ROOT} #${SELECTORS.PANEL_CONTENT} {
      flex: 1 1 auto;
      min-height: 0;
      overflow: hidden;
    }
    #${SELECTORS.ROOT} .opm-prompt-list.opm-visible {
      opacity: 1;
      transform: translateY(0);
    }
    #${SELECTORS.ROOT} .opm-prompt-list.opm-light {
      background-color: var(--light-bg);
      border: 1px solid var(--light-border);
      box-shadow: var(--light-shadow);
    }
    #${SELECTORS.ROOT} .opm-prompt-list.opm-dark {
      background-color: var(--dark-bg);
      border: 1px solid var(--dark-border);
      box-shadow: var(--dark-shadow);
    }
    /* List Items styled as modern cards */
    #${SELECTORS.ROOT} .opm-prompt-list-items {
      max-height: 350px;
      overflow-y: auto;
      margin-bottom: 8px;
    }
    #${SELECTORS.ROOT} .opm-prompt-list-items.opm-light {
      background-color: var(--light-bg);
    }
    #${SELECTORS.ROOT} .opm-prompt-list-items.opm-dark {
      background-color: var(--dark-bg);
    }
    #${SELECTORS.ROOT} .opm-prompt-list-item {
      border-radius: var(--border-radius);
      font-size: 14px;
      cursor: pointer;
      transition: background-color var(--transition-speed) ease, transform var(--transition-speed) ease;
      display: flex;
      align-items: center;
      padding: 8px 6px;
    }
    #${SELECTORS.ROOT} .opm-prompt-list-item.opm-light:hover {
      background-color: #e2e8f0;
      transform: translateY(-2px);
    }
    #${SELECTORS.ROOT} .opm-prompt-list-item.opm-dark:hover {
      background-color: #2d3748;
      transform: translateY(-2px);
    }
    /* Drag-and-drop placeholder to displace items during reordering */
    #${SELECTORS.ROOT} .opm-drop-placeholder {
      border: 1px dashed var(--light-border);
      background-color: ${THEME_COLORS.primary}14;
      border-radius: var(--border-radius);
      margin: 6px 0;
    }
    #${SELECTORS.ROOT}.opm-dark .opm-drop-placeholder {
      border: 1px dashed var(--dark-border);
      background-color: ${THEME_COLORS.primary}26;
    }
    /* Bottom menu styling */
    #${SELECTORS.ROOT} .opm-bottom-menu {
      position: sticky;
      bottom: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 10px;
      border-top: 1px solid var(--light-border);
      margin-top: 8px;
      flex: none;
    }
    #${SELECTORS.ROOT} .opm-bottom-menu.opm-light {
      background-color: var(--light-bg);
    }
    #${SELECTORS.ROOT} .opm-bottom-menu.opm-dark {
      background-color: var(--dark-bg);
      border-top: 1px solid var(--dark-border);
    }
    /* Search input styling */
    #${SELECTORS.ROOT} .opm-prompt-list .opm-search-input {
      width: 100%;
      padding: 8px;
      font-size: 14px;
      border-radius: 4px;
      box-sizing: border-box;
      height: 32px;
      line-height: 20px;
      outline: none;
      transition: border-color var(--transition-speed) ease, box-shadow var(--transition-speed) ease;
      display: none; /* initially hidden until Prompt Manager list opens */
    }
    #${SELECTORS.ROOT} .opm-prompt-list .opm-search-input.opm-light {
      border: var(--input-light-border);
      background-color: var(--input-light-bg);
      color: var(--input-light-text);
    }
    #${SELECTORS.ROOT} .opm-prompt-list .opm-search-input.opm-dark {
      border: var(--input-dark-border);
      background-color: var(--input-dark-bg);
      color: var(--input-dark-text);
    }
    /* Form fields styling */
    #${SELECTORS.ROOT} .opm-input-field, #${SELECTORS.ROOT} .opm-textarea-field {
      width: 100%;
      padding: 10px;
      border-radius: 6px;
      box-sizing: border-box;
      font-size: 14px;
      font-family: var(--font-family);
      color: var(--input-text);
      margin-bottom: 8px;
    }
    #${SELECTORS.ROOT} .opm-input-field.opm-light {
      border: var(--input-light-border);
      background-color: var(--input-light-bg);
      color: var(--input-light-text);
    }
    #${SELECTORS.ROOT} .opm-input-field.opm-dark {
      border: var(--input-dark-border);
      background-color: var(--input-dark-bg);
      color: var(--input-dark-text);
    }
    #${SELECTORS.ROOT} .opm-textarea-field.opm-light {
      border: var(--input-light-border);
      background-color: var(--input-light-bg);
      color: var(--input-light-text);
      min-height: 120px;
      resize: vertical;
    }
    #${SELECTORS.ROOT} .opm-textarea-field.opm-dark {
      border: var(--input-dark-border);
      background-color: var(--input-dark-bg);
      color: var(--input-dark-text);
      min-height: 120px;
      resize: vertical;
    }
    /* Button styling */
    #${SELECTORS.ROOT} .opm-button {
      padding: 10px;
      width: 100%;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      transition: background-color var(--transition-speed) ease;
      color: #fff;
    }
    #${SELECTORS.ROOT} .opm-button.opm-light {
      background-color: var(--primary);
    }
    #${SELECTORS.ROOT} .opm-button.opm-dark {
      background-color: var(--hover-primary);
    }
    #${SELECTORS.ROOT} .opm-button:hover {
      opacity: 0.9;
    }
    /* Icon button styling */
    #${SELECTORS.ROOT} .opm-icon-button {
      width: 28px;
      height: 28px;
      padding: 6px;
      background-color: transparent;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background-color var(--transition-speed) ease;
    }
    #${SELECTORS.ROOT} .opm-icon-button:hover {
      background-color: rgba(0, 0, 0, 0.1);
    }
    
    /* Make bottom menu icons white-ish in dark mode only */
    /* COMMENT: Force white-ish appearance for bottom menu icons when in dark mode */
    #${SELECTORS.ROOT}.opm-dark .opm-bottom-menu .opm-icon-button img {
      /* COMMENT: Use a high-contrast invert with no saturation; keep light mode untouched */
      filter: invert(100%) saturate(0%) brightness(115%) contrast(100%) !important;
    }
    /* Focus style for input inside prompt list */
    #${SELECTORS.ROOT} #${SELECTORS.PROMPT_LIST} input:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 2px rgba(90, 103, 216, 0.3);
      outline: none;
    }
    /* Keyboard navigation styling */
    #${SELECTORS.ROOT} .opm-prompt-list-item.opm-keyboard-selected {
      background-color: var(--dark-bg);
      transform: translateY(-2px);
    }
    #${SELECTORS.ROOT} .opm-prompt-list-item.opm-light.opm-keyboard-selected {
      background-color: #e2e8f0;
      transform: translateY(-2px);
    }
    #${SELECTORS.ROOT} .opm-prompt-list-item.opm-dark.opm-keyboard-selected {
      background-color: #2d3748;
      transform: translateY(-2px);
    }
    /* Ensure prompt list stays visible during keyboard navigation */
    #${SELECTORS.ROOT} .opm-prompt-list.opm-visible:focus-within {
      display: block;
      opacity: 1;
      transform: translateY(0);
    }
    /* Onboarding animation */
    @keyframes opm-onboarding-bounce {
      0%, 100% { transform: translateX(-50%) translateY(0); }
      50% { transform: translateX(-50%) translateY(-5px); }
    }
    /* Responsive styles for onboarding popup */
    @media (max-width: 768px) {
      #${SELECTORS.ROOT} #${SELECTORS.ONBOARDING_POPUP} {
        font-size: 12px;
        padding: 6px 10px;
      }
    }
    /* Hot corner styling */
    #${SELECTORS.ROOT} #${SELECTORS.HOT_CORNER_INDICATOR} {
      opacity: 0.7;
      transition: opacity 0.3s ease, border-width 0.3s ease, border-color 0.3s ease;
    }
    #${SELECTORS.ROOT} #${SELECTORS.HOT_CORNER_CONTAINER}:hover #${SELECTORS.HOT_CORNER_INDICATOR} {
      opacity: 1;
    }
  `;
  document.head.appendChild(styleEl);
}
injectGlobalStyles();

// Dark Mode Handling
/* ---------------------------------------------------------------------------
 * Theme handling (dark / light) with subscription hook
 * -------------------------------------------------------------------------*/
let isDarkModeActive = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

/* Read current mode */
const isDarkMode = () => isDarkModeActive;

/* Listen to OS-level preference changes */
if (window.matchMedia) {
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  mql.addEventListener('change', e => {
    isDarkModeActive = e.matches;
    const root = document.getElementById(SELECTORS.ROOT);
    if (root) {
      root.classList.toggle('opm-dark', isDarkMode());
      root.classList.toggle('opm-light', !isDarkMode());
    }
    PromptUIManager.updateThemeForUI();
  });
}

/* Simple Event Bus */
class EventBus {
  constructor() { this.events = {}; }
  on(evt, listener) { (this.events[evt] = this.events[evt] || []).push(listener); }
  emit(evt, ...args) { (this.events[evt] || []).forEach(fn => fn(...args)); }
}

/* Storage Manager */
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
  static onChange(cb) { chrome.storage.onChanged.addListener(cb); }
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

  // COMMENT: Preference to append prompts instead of overwriting the input area
  static async getDisableOverwrite() {
    // COMMENT: Default is false (overwrite existing content as before)
    return await PromptStorageManager.getData('disableOverwrite', false);
  }
  static async saveDisableOverwrite(value) {
    // COMMENT: Persist the user's preference for append vs overwrite
    return await PromptStorageManager.setData('disableOverwrite', !!value);
  }
}

/* Icon SVGs */
const ICON_SVGS = {
  list: `<img src="${chrome.runtime.getURL('icons/list.svg')}" width="16" height="16" alt="List Prompts" title="List Prompts" style="filter: ${getMode() === 'dark' ? 'invert(93%) sepia(0%) saturate(0%) hue-rotate(213deg) brightness(107%) contrast(87%)' : 'invert(37%) sepia(74%) saturate(380%) hue-rotate(175deg) brightness(93%) contrast(88%)'}">`,
  add: `<img src="${chrome.runtime.getURL('icons/new.svg')}" width="16" height="16" alt="Add Prompt" title="Add Prompt" style="filter: ${getMode() === 'dark' ? 'invert(93%) sepia(0%) saturate(0%) hue-rotate(213deg) brightness(107%) contrast(87%)' : 'invert(37%) sepia(74%) saturate(380%) hue-rotate(175deg) brightness(93%) contrast(88%)'}">`,
  delete: `<img src="${chrome.runtime.getURL('icons/delete.svg')}" width="16" height="16" alt="Delete" title="Delete" style="filter: ${getMode() === 'dark' ? 'invert(93%) sepia(0%) saturate(0%) hue-rotate(213deg) brightness(107%) contrast(87%)' : 'invert(37%) sepia(74%) saturate(380%) hue-rotate(175deg) brightness(93%) contrast(88%)'}">`,
  edit: `<img src="${chrome.runtime.getURL('icons/edit.svg')}" width="16" height="16" alt="Edit" title="Edit" style="filter: ${getMode() === 'dark' ? 'invert(93%) sepia(0%) saturate(0%) hue-rotate(213deg) brightness(107%) contrast(87%)' : 'invert(37%) sepia(74%) saturate(380%) hue-rotate(175deg) brightness(93%) contrast(88%)'}">`,
  settings: `<img src="${chrome.runtime.getURL('icons/settings.svg')}" width="16" height="16" alt="Settings" title="Settings" style="filter: ${getMode() === 'dark' ? 'invert(93%) sepia(0%) saturate(0%) hue-rotate(213deg) brightness(107%) contrast(87%)' : 'invert(37%) sepia(74%) saturate(380%) hue-rotate(175deg) brightness(93%) contrast(88%)'}">`,
  help: `<img src="${chrome.runtime.getURL('icons/help.svg')}" width="16" height="16" alt="Help" title="Help" style="filter: ${getMode() === 'dark' ? 'invert(93%) sepia(0%) saturate(0%) hue-rotate(213deg) brightness(107%) contrast(87%)' : 'invert(37%) sepia(74%) saturate(380%) hue-rotate(175deg) brightness(93%) contrast(88%)'}">`,
  changelog: `<img src="${chrome.runtime.getURL('icons/notes.svg')}" width="16" height="16" alt="Changelog" title="Changelog" style="filter: ${getMode() === 'dark' ? 'invert(93%) sepia(0%) saturate(0%) hue-rotate(213deg) brightness(107%) contrast(87%)' : 'invert(37%) sepia(74%) saturate(380%) hue-rotate(175deg) brightness(93%) contrast(88%)'}">`,
};

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
    // COMMENT: Tracks whether the list was opened via user action
    manuallyOpened: false,
    // COMMENT: Tracks whether we are in variable input collection mode
    inVariableInputMode: false,
    // COMMENT: Close timer reference to coordinate delayed hide
    closeTimer: null
  };

  // Pure DOM factory helpers. Keep side-effects out; only build elements.
  const Elements = {
    // COMMENT: Build the unified list content container (items + menu)
    createPanelContent() {
      return createEl('div', { id: SELECTORS.PANEL_CONTENT });
    },
    // COMMENT: Create the scrollable items container
    createItemsContainer() {
      // COMMENT: Mark this as the dedicated Prompt List view container
      return createEl('div', { className: `${SELECTORS.PROMPT_ITEMS_CONTAINER} opm-prompt-list-items opm-view-list opm-${getMode()}` });
    },
    // COMMENT: Create a single prompt list item element
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
      return item;
    },
    // COMMENT: Create an icon button for the bottom menu
    createIconButton(type, onClick) {
      return createEl('button', { className: 'opm-icon-button', eventListeners: { click: onClick }, innerHTML: ICON_SVGS[type] || '' });
    },
    // COMMENT: Build the horizontal menu bar with action icon buttons
    createMenuBar() {
      const bar = createEl('div', { styles: { display: 'flex', alignItems: 'center', justifyContent: 'space-evenly', width: '100%' } });
      const btns = ['list', 'add', 'edit', 'help', 'changelog', 'settings'];
      // COMMENT: Ensure manual flag set before action handlers
      const actions = {
        list: e => { e.stopPropagation(); PromptUIManager.manuallyOpened = true; PromptUIManager.refreshAndShowPromptList(); },
        add: e => { e.stopPropagation(); PromptUIManager.manuallyOpened = true; PromptUIManager.showPromptCreationForm(); },
        edit: e => { e.stopPropagation(); PromptUIManager.manuallyOpened = true; PromptUIManager.showEditView(); },
        settings: e => { e.stopPropagation(); PromptUIManager.manuallyOpened = true; PromptUIManager.showSettingsForm(); },
        help: e => { e.stopPropagation(); PromptUIManager.manuallyOpened = true; PromptUIManager.showHelp(); },
        changelog: e => { e.stopPropagation(); PromptUIManager.manuallyOpened = true; PromptUIManager.showChangelog(); },
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
      search.addEventListener('input', e => {
        const term = e.target.value.toLowerCase();
        const container = document.querySelector(`.${SELECTORS.PROMPT_ITEMS_CONTAINER}`);
        if (!container) return;
        Array.from(container.children).forEach(item => {
          item.style.display = (item.dataset.title.includes(term) || item.dataset.content.includes(term)) ? 'flex' : 'none';
        });
        PromptUIManager.selectedSearchIndex = -1;
      });
      menu.appendChild(search);
      menu.appendChild(Elements.createMenuBar());
      return menu;
    }
  };

  // View composition:  larger UI sections using Elements and Manager helpers
  const Views = {
    // COMMENT: Render prompt list (items + bottom menu) and return the content node
    renderPromptList(prompts = []) {
      const content = Elements.createPanelContent();
      const itemsContainer = Elements.createItemsContainer();
      prompts.forEach(p => itemsContainer.appendChild(Elements.createPromptItem(p)));
      content.appendChild(itemsContainer);
      content.appendChild(Elements.createBottomMenu());
      return content;
    },
    // COMMENT: Build the Prompt Creation form view with provided prefill
    createPromptCreationForm(prefill = '') {
      const search = document.getElementById(SELECTORS.PROMPT_SEARCH_INPUT);
      if (search) search.style.display = 'none';
      const form = createEl('div', { className: `opm-form-container opm-${getMode()}`, styles: { padding: '0', display: 'flex', flexDirection: 'column', gap: '8px' } });
      const titleIn = createEl('input', { attributes: { placeholder: 'Prompt Title' }, className: `opm-input-field opm-${getMode()}`, styles: { borderRadius: '4px' } });
      const contentArea = createEl('textarea', {
        attributes: { placeholder: 'Enter your prompt here. Add variables with #examplevariable#' },
        className: `opm-textarea-field opm-${getMode()}`,
        styles: { minHeight: '220px' }
      });
      contentArea.value = prefill;
      const saveBtn = createEl('button', { innerHTML: 'Create Prompt', className: `opm-button opm-${getMode()}` });
      saveBtn.addEventListener('click', async e => {
        e.stopPropagation();
        const t = titleIn.value.trim(), c = contentArea.value.trim();
        if (!t || !c) { alert('Please fill in both title and content.'); return; }
        const res = await PromptStorageManager.savePrompt({ title: t, content: c });
        if (!res.success) { alert('Error saving prompt.'); return; }
        PromptUIManager.refreshAndShowPromptList();
      });
      form.append(titleIn, contentArea, saveBtn);
      form.addEventListener('click', e => e.stopPropagation());
      return form;
    },
    // COMMENT: Build the Settings form view
    createSettingsForm() {
      const form = createEl('div', { className: `opm-form-container opm-${getMode()}`, styles: { padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' } });
      const title = createEl('div', { styles: { fontWeight: 'bold', fontSize: '16px', marginBottom: '10px' }, innerHTML: 'Settings' });
      const settings = createEl('div', { styles: { display: 'flex', flexDirection: 'column', gap: '12px' } });
      const displayModeRow = createEl('div', { styles: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } });
      const displayModeLabel = createEl('label', { innerHTML: 'Enable Hot Corner Mode', styles: { fontSize: '14px' } });
      PromptStorageManager.getDisplayMode().then(mode => {
        const isHotCorner = mode === 'hotCorner';
        const toggleSwitch = createEl('div', {
          className: `opm-toggle-switch opm-${getMode()} ${isHotCorner ? 'active' : ''}`,
          eventListeners: {
            click: e => {
              e.stopPropagation();
              toggleSwitch.classList.toggle('active');
              const newMode = toggleSwitch.classList.contains('active') ? 'hotCorner' : 'standard';
              PromptStorageManager.saveDisplayMode(newMode).then(() => { PromptUIManager.refreshDisplayMode(); });
            }
          }
        });
        displayModeRow.append(displayModeLabel, toggleSwitch);
        settings.appendChild(displayModeRow);
      });

      // COMMENT: Toggle to control whether prompts append or overwrite input area
      const overwriteRow = createEl('div', { styles: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } });
      const overwriteLabel = createEl('label', { innerHTML: 'Append prompts to text', styles: { fontSize: '14px' } });
      PromptStorageManager.getDisableOverwrite().then(disable => {
        const overwriteToggle = createEl('div', {
          className: `opm-toggle-switch opm-${getMode()} ${disable ? 'active' : ''}`,
          eventListeners: {
            click: e => {
              e.stopPropagation();
              overwriteToggle.classList.toggle('active');
              const nextValue = overwriteToggle.classList.contains('active');
              // COMMENT: Persist setting; no immediate UI rebuild needed
              PromptStorageManager.saveDisableOverwrite(nextValue);
            }
          }
        });
        overwriteRow.append(overwriteLabel, overwriteToggle);
        settings.appendChild(overwriteRow);
      });

      // Comment : Import & Export functionality in settings menu
      const dataSectionTitle = createEl('div', { styles: { fontWeight: 'bold', fontSize: '14px', marginTop: '6px' }, innerHTML: 'Prompt Management' });
      const dataActions = createEl('div', { styles: { display: 'flex', gap: '8px' } });
      const exportBtn = createEl('button', { innerHTML: 'Export', className: `opm-button opm-${getMode()}` });
      exportBtn.addEventListener('click', async e => {
        e.stopPropagation();
        try {
          // COMMENT: Serialize current prompts and trigger a download
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
              setTimeout(() => importBtn.textContent = 'Import', 2000);
            } catch (err) {
              alert('Invalid JSON file format.');
            }
          }
        });
        fileInput.click();
      });
      dataActions.append(exportBtn, importBtn);

      form.append(title, settings, dataSectionTitle, dataActions);
      return form;
    },
    // COMMENT: Build the Edit view with draggable reordering and actions
    async createEditView() {
      const prompts = await PromptStorageManager.getPrompts();
      const container = createEl('div', { className: `opm-form-container opm-${getMode()}`, styles: { padding: '0', display: 'flex', flexDirection: 'column' } });
      const promptsContainer = createEl('div', { className: `${SELECTORS.PROMPT_ITEMS_CONTAINER} opm-prompt-list-items opm-${getMode()}`, styles: { maxHeight: '350px', overflowY: 'auto', marginBottom: '4px' } });
      // COMMENT: Keep a single placeholder element reused during drag to displace items visually
      const placeholder = createEl('div', { className: 'opm-drop-placeholder' });
      let dragFromIndex = null;
      let dropIndex = null;
      // COMMENT: Compute drop position relative to all items in the container (handles gaps and placeholder drops)
      const computeContainerDropPosition = (clientY) => {
        const itemNodes = Array.from(promptsContainer.children).filter(n => n.classList && n.classList.contains('opm-prompt-list-item'));
        if (itemNodes.length === 0) { dropIndex = 0; return; }
        for (let i = 0; i < itemNodes.length; i++) {
          const node = itemNodes[i];
          const rect = node.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          // COMMENT: Insert before the first item whose midpoint is below the cursor
          if (clientY < midY) {
            // COMMENT: Match placeholder height with the target node for stability
            placeholder.style.height = `${rect.height}px`;
            if (node.previousSibling !== placeholder) {
              promptsContainer.insertBefore(placeholder, node);
            }
            dropIndex = parseInt(node.dataset.index, 10);
            return;
          }
        }
        // COMMENT: If cursor is below all items, append placeholder at end
        const last = itemNodes[itemNodes.length - 1];
        const lastRect = last.getBoundingClientRect();
        placeholder.style.height = `${lastRect.height}px`;
        if (last.nextSibling !== placeholder) {
          promptsContainer.insertBefore(placeholder, last.nextSibling);
        }
        dropIndex = prompts.length; // after last
      };
      promptsContainer.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        computeContainerDropPosition(e.clientY);
      });
      promptsContainer.addEventListener('drop', e => {
        e.preventDefault();
        e.stopPropagation();
        const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
        if (Number.isNaN(from)) return;
        let to = dropIndex !== null ? dropIndex : prompts.length;
        if (from < to) to = to - 1; // COMMENT: Adjust for removal shifting indices when moving downward
        if (from === to) {
          if (placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
          dragFromIndex = null; dropIndex = null;
          return;
        }
        const newPrompts = [...prompts];
        const [moved] = newPrompts.splice(from, 1);
        newPrompts.splice(Math.max(0, Math.min(newPrompts.length, to)), 0, moved);
        if (placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
        dragFromIndex = null; dropIndex = null;
        // COMMENT: Persist the new order via unified storage manager
        PromptStorageManager.setPrompts(newPrompts).then(() => { PromptUIManager.showEditView(); });
      });
      prompts.forEach((p, idx) => {
        const item = createEl('div', { className: `opm-prompt-list-item opm-${getMode()}`, styles: { justifyContent: 'space-between', padding: '4px 4px', margin: '6px 0' } });
        item.dataset.index = idx;
        // COMMENT: On dragover, compute whether to place placeholder before or after based on cursor position
        item.addEventListener('dragover', e => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          const rect = item.getBoundingClientRect();
          const offset = e.clientY - rect.top;
          const placeBefore = offset < rect.height / 2;
          // Ensure placeholder visually matches item spacing
          placeholder.style.height = `${rect.height}px`;
          // Avoid flicker if already correctly placed
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
        // COMMENT: Drop is handled at container level to centralize index computation
        const dragHandle = createEl('div', {
          className: 'opm-drag-handle',
          innerHTML: `
            <img 
              src="${chrome.runtime.getURL('icons/drag_indicator.svg')}" 
              width="16" 
              height="16" 
              alt="Drag handle" 
              title="Drag to reorder"
              style="display: block; opacity: 0.9; filter: ${isDarkMode() ? 'invert(93%) sepia(0%) saturate(0%) hue-rotate(213deg) brightness(107%) contrast(87%)' : 'invert(37%) sepia(74%) saturate(380%) hue-rotate(175deg) brightness(93%) contrast(88%)'}"
            >
          `,
          styles: {
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '16px', height: '16px', marginRight: '4px', marginLeft: '0px', flex: '0 0 auto',
            cursor: 'grab', userSelect: 'none', opacity: '0.9'
          }
        });
        // COMMENT: Make only the handle draggable; use the full item as the drag image so it follows the cursor
        dragHandle.setAttribute('draggable', 'true');
        dragHandle.addEventListener('dragstart', e => {
          e.stopPropagation();
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', idx);
          dragFromIndex = idx;
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
          // Remove placeholder if it remains in DOM after drag end
          if (placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
          dragFromIndex = null;
          dropIndex = null;
        });
        const text = createEl('div', { styles: { flex: '1' } });
        text.textContent = p.title;
        const actions = createEl('div', { styles: { display: 'flex', gap: '4px' } });
        const editIcon = Elements.createIconButton('edit', () => { PromptUIManager.showEditForm(p); });
        const deleteIcon = Elements.createIconButton('delete', () => { if (confirm(`Delete "${p.title}"?`)) PromptUIManager.deletePrompt(p.uuid); });
        actions.append(editIcon, deleteIcon);
        item.append(dragHandle, text, actions);
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
      listEl.classList.add('opm-visible');
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
        const currentPrompts = await PromptStorageManager.getPrompts();
        if (currentPrompts.length === 0) {
          PromptUIManager.showPromptCreationForm();
        } else {
          PromptUIManager.showPromptList(listEl);
        }
        isOpen = true;
      });

      button.addEventListener('mouseleave', startClose);
      listEl.addEventListener('mouseenter', Behaviors.cancelCloseTimer);
      listEl.addEventListener('mouseleave', startClose);

      document.addEventListener('click', e => {
        const isMenu = e.target.closest(`#${SELECTORS.PROMPT_LIST}`) ||
          e.target.closest(`.${SELECTORS.PROMPT_ITEMS_CONTAINER}`) ||
          e.target.closest('.opm-icon-button') ||
          e.target.closest('.opm-form-container') ||
          e.target.closest('.opm-button') ||
          button.contains(e.target);
        if (isOpen && !isMenu) {
          PromptUIManager.hidePromptList(listEl);
          isOpen = false;
        }
      });
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
  // COMMENT: Map manager flags to PromptUI.State via accessors
  static get manuallyOpened() { return PromptUI.State.manuallyOpened; }
  static set manuallyOpened(v) { PromptUI.State.manuallyOpened = v; }
  static get inVariableInputMode() { return PromptUI.State.inVariableInputMode; }
  static set inVariableInputMode(v) { PromptUI.State.inVariableInputMode = v; }
  static eventBus = new EventBus();
  static onPromptSelect(cb) { this.eventBus.on('promptSelect', cb); }
  static emitPromptSelect(prompt) { this.eventBus.emit('promptSelect', prompt); }

  static injectPromptManagerButton(prompts) {
    if (document.getElementById(SELECTORS.PROMPT_BUTTON_CONTAINER)) return;
    PromptStorageManager.getButtonPosition().then(pos => {
      const container = createEl('div', { id: SELECTORS.PROMPT_BUTTON_CONTAINER, styles: UI_STYLES.getPromptButtonContainerStyle(pos) });
      const button = createEl('button', { id: SELECTORS.PROMPT_BUTTON, className: 'opm-prompt-button' });
      container.appendChild(button);
      const listEl = createEl('div', { id: SELECTORS.PROMPT_LIST, className: `opm-prompt-list opm-${getMode()}` });
      container.appendChild(listEl);
      PromptUIManager._ensureRoot().appendChild(container);
      PromptUIManager.refreshPromptList(prompts);
      PromptUIManager.attachButtonEvents(button, listEl, container, prompts);
      PromptUIManager.makeDraggable(container);
      PromptUIManager.checkAndShowOnboarding(container);
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
        }, 300);
      }
    }, 10000);
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

  static refreshPromptList(prompts) { this.buildPromptListContainer(prompts); const input = document.getElementById(SELECTORS.PROMPT_SEARCH_INPUT); if (input) input.style.display = 'block'; }

  static refreshItemsIfListActive(prompts = []) {
    // COMMENT: Only refresh the items list when the prompt list view is active
    const panel = document.getElementById(SELECTORS.PANEL_CONTENT);
    if (!panel) return;
    const items = panel.querySelector(`.${SELECTORS.PROMPT_ITEMS_CONTAINER}.opm-view-list`);
    if (!items) return; // not on the list view – skip to avoid toggling search visibility
    PromptUIManager.buildPromptListContainer(prompts);
    const input = document.getElementById(SELECTORS.PROMPT_SEARCH_INPUT);
    if (input) input.style.display = 'block';
  }

  static setSearchVisibility(visible) {
    // COMMENT: Explicitly control visibility of the search input in the bottom menu
    const input = document.getElementById(SELECTORS.PROMPT_SEARCH_INPUT);
    if (input) input.style.display = visible ? 'block' : 'none';
  }

  static buildPromptListContainer(prompts = []) {
    // COMMENT: Rebuild the list content using internal view composition
    const listEl = document.getElementById(SELECTORS.PROMPT_LIST);
    if (!listEl) return;
    applyTheme(listEl);
    listEl.innerHTML = '';
    const content = PromptUI.Views.renderPromptList(prompts);
    listEl.appendChild(content);
  }

  static resetPromptListContainer() {
    const listEl = document.getElementById(SELECTORS.PROMPT_LIST);
    const wasVisible = listEl && listEl.classList.contains('opm-visible');
    PromptUIManager.buildPromptListContainer();
    if (wasVisible) {
      const updated = document.getElementById(SELECTORS.PROMPT_LIST);
      if (updated) { updated.style.display = 'block'; void updated.offsetHeight; updated.classList.add('opm-visible'); }
    }
  }

  static replacePanelMainContent(node) {
    // COMMENT: Replace the scrollable main area (prompt items) while preserving the bottom menu
    const panel = document.getElementById(SELECTORS.PANEL_CONTENT);
    if (!panel) return;
    const items = panel.querySelector(`.${SELECTORS.PROMPT_ITEMS_CONTAINER}`);
    if (items) {
      items.replaceWith(node);
    } else {
      // If items container is missing, inject the node before the last child (bottom menu) if present
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
    PromptUI.Behaviors.showList(listEl);
    // COMMENT: Focus only if list view is active
    const panel = document.getElementById(SELECTORS.PANEL_CONTENT);
    const hasListItems = panel && panel.querySelector(`.${SELECTORS.PROMPT_ITEMS_CONTAINER}.opm-view-list`);
    PromptUIManager.setSearchVisibility(!!hasListItems);
    if (hasListItems) {
      const first = listEl.querySelector('.opm-prompt-list-item');
      if (first) setTimeout(() => first.focus(), 50);
      PromptUIManager.focusSearchInput();
    }
    PromptStorageManager.setOnboardingCompleted();
    const popup = document.getElementById(SELECTORS.ONBOARDING_POPUP);
    if (popup) popup.remove();
  }

  static hidePromptList(listEl) {
    if (!listEl) return;
    // COMMENT: Use unified hide behavior, then perform manager-side cleanup
    PromptUI.Behaviors.hideList(listEl);
    const input = document.getElementById(SELECTORS.PROMPT_SEARCH_INPUT);
    if (input) input.value = '';
    // Reset both flags when hiding the view
    PromptUIManager.manuallyOpened = false;
    PromptUIManager.inVariableInputMode = false;
  }

  static handleKeyboardNavigation(e, context = 'list') {
    const list = document.getElementById(SELECTORS.PROMPT_LIST);
    if (!list || !list.classList.contains('opm-visible')) return;
    PromptUIManager.cancelCloseTimer();
    let items = [];
    if (context === 'search') {
      const container = document.querySelector(`.${SELECTORS.PROMPT_ITEMS_CONTAINER}`);
      if (!container) return;
      items = Array.from(container.querySelectorAll('.opm-prompt-list-item'))
        .filter(item => item.style.display !== 'none' && !item.classList.contains('opm-shortcut-container'));
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
      const listEl = document.getElementById(SELECTORS.PROMPT_LIST);
      if (listEl && listEl.classList.contains('opm-visible')) {
        e.preventDefault();
        PromptUIManager.selectedSearchIndex = -1;
        const container = document.querySelector(`.${SELECTORS.PROMPT_ITEMS_CONTAINER}`);
        if (container) {
          const items = Array.from(container.querySelectorAll('.opm-prompt-list-item'))
            .filter(item => item.style.display !== 'none' && !item.classList.contains('opm-shortcut-container'));
          PromptUIManager.updateSelection(items, -1);
        }
        PromptUIManager.hidePromptList(listEl);
      }
    }
  }

  static updateThemeForUI() {
    const root = document.getElementById(SELECTORS.ROOT);
    if (root) {
      root.classList.toggle('opm-dark', isDarkMode());
      root.classList.toggle('opm-light', !isDarkMode());
    }
    const themeElements = document.querySelectorAll([
      `#${SELECTORS.ROOT} .opm-prompt-list`,
      `#${SELECTORS.ROOT} .opm-prompt-list-items`,
      `#${SELECTORS.ROOT} .opm-prompt-list-item`,
      `#${SELECTORS.ROOT} .opm-search-input`,
      `#${SELECTORS.ROOT} .opm-input-field`,
      `#${SELECTORS.ROOT} .opm-textarea-field`,
      `#${SELECTORS.ROOT} .opm-button`,
      `#${SELECTORS.ROOT} .opm-toggle-switch`,
      `#${SELECTORS.ROOT} .opm-form-container`,
      `#${SELECTORS.ROOT} .opm-bottom-menu`
    ].join(','));
    themeElements.forEach(el => {
      el.classList.remove('opm-light', 'opm-dark');
      el.classList.add(`opm-${getMode()}`);
    });
    const container = document.getElementById(SELECTORS.PROMPT_BUTTON_CONTAINER);
    if (container) {
      const btn = container.querySelector(`#${SELECTORS.PROMPT_BUTTON}`) || container.querySelector('.opm-prompt-button');
      if (btn) {
        btn.style.boxShadow = isDarkMode() ? THEME_COLORS.darkShadow : THEME_COLORS.lightShadow;
      }
    }
    const icons = document.querySelectorAll(`#${SELECTORS.ROOT} .opm-icon-button img`);
    icons.forEach(icon => {
      icon.style.filter = isDarkMode()
        ? 'invert(93%) sepia(0%) saturate(0%) hue-rotate(213deg) brightness(107%) contrast(87%)'
        : 'invert(37%) sepia(74%) saturate(380%) hue-rotate(175deg) brightness(93%) contrast(88%)';
    });
  }

  static refreshAndShowPromptList() {
    (async () => {
      const prompts = await PromptStorageManager.getPrompts();
      // COMMENT: Explicitly rebuild the prompt list when user requests it
      PromptUIManager.refreshPromptList(prompts);
      const list = document.getElementById(SELECTORS.PROMPT_LIST);
      if (list) PromptUIManager.showPromptList(list);
    })();
  }

  static focusSearchInput() {
    const input = document.getElementById(SELECTORS.PROMPT_SEARCH_INPUT);
    if (input) { applyTheme(input); requestAnimationFrame(() => { input.focus(); input.select(); }); }
  }

  static showPromptCreationForm() {
    const list = document.getElementById(SELECTORS.PROMPT_LIST);
    if (!list) return;
    PromptUIManager.showPromptList(list);
    PromptUIManager.resetPromptListContainer();
    // COMMENT: Hide search when not in the list view
    PromptUIManager.setSearchVisibility(false);
    PromptStorageManager.getPrompts().then(prompts => {
      const form = PromptUIManager.createPromptCreationForm('', prompts.length === 0);
      PromptUIManager.replacePanelMainContent(form);
      const t = form.querySelector('input');
      if (t) t.focus();
    });
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
      const row = createEl('div', { styles: { display: 'flex', flexDirection: 'column', gap: '4px' } });
      const label = createEl('label', { innerHTML: v, styles: { fontSize: '12px', fontWeight: 'bold', color: dark ? THEME_COLORS.inputDarkText : '#333' } });
      const inputField = createEl('input', { attributes: { type: 'text', placeholder: `${v} value` }, className: `opm-input-field opm-${getMode()}` });
      inputField.addEventListener('input', () => { varValues[v] = inputField.value; });
      inputField.addEventListener('keydown', e => { if (e.key === 'Enter') submitBtn.click(); });
      row.append(label, inputField);
      varContainer.appendChild(row);
      varValues[v] = '';
    });
    form.appendChild(varContainer);
    const btnContainer = createEl('div', { styles: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' } });
    const submitBtn = createEl('button', { innerHTML: 'Submit', className: `opm-button opm-${getMode()}` });
    submitBtn.addEventListener('click', () => {
      PromptUIManager.inVariableInputMode = false;
      onSubmit(varValues);
    });
    const backBtn = createEl('button', { innerHTML: 'Back', className: `opm-button opm-${getMode()}` });
    backBtn.addEventListener('click', () => {
      PromptUIManager.inVariableInputMode = false;
      PromptUIManager.refreshAndShowPromptList();
    });
    btnContainer.append(submitBtn, backBtn);
    form.appendChild(btnContainer);
    listEl.appendChild(form);
    PromptUIManager.showPromptList(listEl);
    const firstInput = varContainer.querySelector('input');
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
    const list = document.getElementById(SELECTORS.PROMPT_LIST);
    if (!list) return;
    PromptUIManager.resetPromptListContainer();
    // COMMENT: Hide search when not in the list view
    PromptUIManager.setSearchVisibility(false);
    const form = createEl('div', { className: `opm-form-container opm-${getMode()}`, styles: { padding: '0', display: 'flex', flexDirection: 'column', gap: '8px' } });
    const titleIn = createEl('input', { className: `opm-input-field opm-${getMode()}`, attributes: { type: 'text', placeholder: 'Prompt Title' } });
    titleIn.value = prompt.title;
    const contentArea = createEl('textarea', { className: `opm-textarea-field opm-${getMode()}`, styles: { minHeight: '250px' } });
    contentArea.value = prompt.content;
    const saveBtn = createEl('button', { innerHTML: 'Save Changes', className: `opm-button opm-${getMode()}` });
    saveBtn.addEventListener('click', async e => {
      e.stopPropagation();
      const ps = await PromptStorageManager._ps();
      await ps.updatePrompt(prompt.uuid, {
        title: titleIn.value.trim(),
        content: contentArea.value.trim()
      });
      PromptUIManager.showEditView();
    });
    form.append(titleIn, contentArea, saveBtn);
    form.addEventListener('click', e => e.stopPropagation());
    PromptUIManager.replacePanelMainContent(form);
  }

  static async deletePrompt(uuid) {
    const ps = await PromptStorageManager._ps();
    await ps.deletePrompt(uuid);
    const list = document.getElementById(SELECTORS.PROMPT_LIST);
    if (list) { PromptUIManager.resetPromptListContainer(); PromptUIManager.showEditView(); }
  }

  static showEditView() {
    const list = document.getElementById(SELECTORS.PROMPT_LIST);
    if (!list) return;
    PromptUIManager.showPromptList(list);
    PromptUIManager.resetPromptListContainer();
    // COMMENT: Hide search when not in the list view
    PromptUIManager.setSearchVisibility(false);
    (async () => { const view = await PromptUIManager.createEditView(); PromptUIManager.replacePanelMainContent(view); })();
  }

  static showHelp() {
    const list = document.getElementById(SELECTORS.PROMPT_LIST);
    if (!list) return;
    PromptUIManager.showPromptList(list);
    PromptUIManager.resetPromptListContainer();
    // COMMENT: Hide search when not in the list view
    PromptUIManager.setSearchVisibility(false);
    const dark = isDarkMode();
    const container = createEl('div', { className: `opm-form-container opm-${getMode()}`, styles: { padding: '0', display: 'flex', flexDirection: 'column', gap: '4px' } });
    const title = createEl('div', { styles: { fontWeight: 'bold', fontSize: '16px', marginBottom: '6px' }, innerHTML: 'Navigation & Features' });
    const info = createEl('div', { id: SELECTORS.INFO_CONTENT, styles: { maxHeight: '300px', overflowY: 'auto', padding: '4px', borderRadius: '6px', color: dark ? THEME_COLORS.inputDarkText : THEME_COLORS.inputLightText } });
    fetch(chrome.runtime.getURL('info.html')).then(r => r.text()).then(html => { info.innerHTML = html; });
    container.append(title, info);
    PromptUIManager.replacePanelMainContent(container);
  }

  static showChangelog() {
    const list = document.getElementById(SELECTORS.PROMPT_LIST);
    if (!list) return;
    PromptUIManager.showPromptList(list);
    PromptUIManager.resetPromptListContainer();
    // COMMENT: Hide search when not in the list view
    PromptUIManager.setSearchVisibility(false);
    const dark = isDarkMode();
    const container = createEl('div', { className: `opm-form-container opm-${getMode()}`, styles: { padding: '0', display: 'flex', flexDirection: 'column', gap: '6px' } });
    const title = createEl('div', { styles: { fontWeight: 'bold', fontSize: '16px', marginBottom: '6px' }, innerHTML: 'Changelog' });
    const info = createEl('div', { id: SELECTORS.CHANGELOG_CONTENT, styles: { maxHeight: '250px', overflowY: 'auto', padding: '4px', borderRadius: '6px', color: dark ? THEME_COLORS.inputDarkText : THEME_COLORS.inputLightText } });
    fetch(chrome.runtime.getURL('changelog.html')).then(r => r.text()).then(html => { info.innerHTML = html; });
    container.append(title, info);
    PromptUIManager.replacePanelMainContent(container);
  }
  static showSettingsForm() {
    const list = document.getElementById(SELECTORS.PROMPT_LIST);
    if (!list) return;
    PromptUIManager.showPromptList(list);
    PromptUIManager.resetPromptListContainer();
    // COMMENT: Hide search when not in the list view
    PromptUIManager.setSearchVisibility(false);
    const form = PromptUIManager.createSettingsForm();
    PromptUIManager.replacePanelMainContent(form);
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
        borderStyle: 'solid', borderWidth: '0 0 20px 20px',
        borderColor: `transparent transparent ${THEME_COLORS.primary}90 transparent`,
        transition: 'border-width 0.3s ease, border-color 0.3s ease',
        pointerEvents: 'none'
      }
    });
    container.appendChild(indicator);

    // Create the prompt list container with some positioning rules
    const listEl = createEl('div', {
      id: SELECTORS.PROMPT_LIST,
      className: `opm-prompt-list opm-${getMode()}`,
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
  }

  // Extracted event handling for hot corner
  static setupHotCornerEvents(container, indicator, listEl) {
    container.addEventListener('mouseenter', async e => {
      e.stopPropagation();
      PromptUIManager.cancelCloseTimer();

      // Don't show prompt list if we're in variable input mode or manual mode
      if (!PromptUIManager.manuallyOpened && !PromptUIManager.inVariableInputMode) {
        indicator.style.borderWidth = '0 0 30px 30px';
        indicator.style.borderColor = `transparent transparent ${THEME_COLORS.primary} transparent`;
        const currentPrompts = await PromptStorageManager.getPrompts();
        PromptUIManager.refreshPromptList(currentPrompts);
        if (currentPrompts.length === 0) {
          PromptUIManager.showPromptCreationForm();
        } else {
          PromptUIManager.showPromptList(listEl);
        }
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
      indicator.style.borderWidth = '0 0 20px 20px';
      indicator.style.borderColor = `transparent transparent ${THEME_COLORS.primary}90 transparent`;
      // COMMENT: Reset flags on timed close to avoid getting stuck in a "manually opened" state
      PromptUIManager.startCloseTimer(e, listEl, () => {
        PromptUIManager.manuallyOpened = false;
        PromptUIManager.inVariableInputMode = false;
      });
    });

    //  document click handler for closing the prompt list when clicking outside
    const documentClickHandler = e => {
      const isMenu = e.target.closest(`#${SELECTORS.PROMPT_LIST}`) ||
        e.target.closest(`.${SELECTORS.PROMPT_ITEMS_CONTAINER}`) ||
        e.target.closest('.opm-icon-button') ||
        e.target.closest('.opm-form-container') ||
        e.target.closest('.opm-button') ||
        container.contains(e.target);

      if (listEl.classList.contains('opm-visible') && !isMenu) {
        PromptUIManager.hidePromptList(listEl);
      }
    };

    // Store reference to the handler for cleanup
    container.documentClickHandler = documentClickHandler;

    // Add the event listener to the document
    document.addEventListener('click', documentClickHandler);

    // COMMENT: When the tab is hidden and later shown again, make sure the UI resets properly
    // COMMENT: This prevents a stale state where hovers no longer trigger due to lingering flags
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
    container.addEventListener('mouseenter', () => {
      PromptStorageManager.setOnboardingCompleted();
      const popup = document.getElementById(SELECTORS.ONBOARDING_POPUP);
      if (popup) popup.remove();
    });
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
    const mode = await PromptStorageManager.getDisplayMode();
    const prompts = await PromptStorageManager.getPrompts();
    // Create the appropriate UI based on the current mode
    if (mode === 'standard') {
      PromptUIManager.injectPromptManagerButton(prompts);
    } else {
      PromptUIManager.injectHotCorner();
    }

    // Make sure the prompt list is refreshed only if list view is active
    PromptUIManager.refreshItemsIfListActive(prompts);
    // If switching modes from settings, we should close any open menu
    const listEl = document.getElementById(SELECTORS.PROMPT_LIST);
    if (listEl && listEl.classList.contains('opm-visible')) {
      PromptUIManager.hidePromptList(listEl);
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
      let inputBox = InputBoxHandler.getInputBox();
      if (!inputBox) {
        try {
          inputBox = await InputBoxHandler.waitForInputBox();
        } catch (_) {
          console.error('Input box not found.');
          return;
        }
      }
      const vars = this.processor.extractVariables(prompt.content);
      const listEl = document.getElementById(SELECTORS.PROMPT_LIST);
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
      // COMMENT: This shows the floating button or hot-corner ASAP, while insertion still checks for an input when used
      const displayMode = await PromptStorageManager.getDisplayMode();
      const prompts = await PromptStorageManager.getPrompts();
      if (displayMode === 'standard') {
        PromptUIManager.injectPromptManagerButton(prompts);
      } else {
        PromptUIManager.injectHotCorner();
      }
      // COMMENT: Keep observers/monitors so UI stays healthy across SPA navigations and DOM changes
      this.setupMutationObserver();
      this.setupStorageChangeMonitor();
      this.setupKeyboardShortcuts();
    } catch (err) { console.error('Error initializing extension:', err); }
  }

  setupMutationObserver() {
    const target = document.querySelector('main') || document.body;

    const debouncedHandler = debounce(async () => {
      // COMMENT: Ensure UI is present even if an input box hasn't been detected yet
      const displayMode = await PromptStorageManager.getDisplayMode();
      if (!document.getElementById(SELECTORS.PROMPT_BUTTON_CONTAINER) &&
          !document.getElementById(SELECTORS.HOT_CORNER_CONTAINER)) {
        PromptUIManager.cleanupAllUIComponents();
        const prompts = await PromptStorageManager.getPrompts();
        if (displayMode === 'standard') {
          PromptUIManager.injectPromptManagerButton(prompts);
        } else {
          PromptUIManager.injectHotCorner();
        }
      }
    }, 300);

    const observer = new MutationObserver(debouncedHandler);
    observer.observe(target, { childList: true, subtree: true });
  }

  setupStorageChangeMonitor() {
    // COMMENT: Use unified storage change listener to keep UI in sync across contexts
    (async () => {
      try {
        const { onPromptsChanged } = await import(chrome.runtime.getURL('promptStorage.js'));
        onPromptsChanged((prompts) => {
          // COMMENT: Only refresh items when the list view is active to avoid polluting non-list views
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

/* Centralized Keyboard Manager */
class KeyboardManager {
  static initialized = false;

  static initialize() {
    if (KeyboardManager.initialized) return;
    KeyboardManager.initialized = true;
    document.addEventListener('keydown', KeyboardManager._onKeyDown);
  }

  static async _onKeyDown(e) {
    // 1) Global toggle shortcut
    const shortcut = await PromptStorageManager.getKeyboardShortcut();
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
    const listEl = document.getElementById(SELECTORS.PROMPT_LIST);
    if (!listEl) return;
    if (listEl.classList.contains('opm-visible')) {
      PromptUIManager.hidePromptList(listEl);
    } else {
      // Mark as manually opened
      PromptUIManager.manuallyOpened = true;
      const currentPrompts = await PromptStorageManager.getPrompts();
      PromptUIManager.refreshPromptList(currentPrompts);
      if (currentPrompts.length === 0) {
        PromptUIManager.showPromptCreationForm();
      } else {
        PromptUIManager.showPromptList(listEl);
      }
    }
  }
}

/* Initialize the extension */
setTimeout(() => { new PromptMediator(PromptUIManager, PromptProcessor); }, 50);
