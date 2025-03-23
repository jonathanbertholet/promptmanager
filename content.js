/* Global constants, helpers & styles */
const THEME_COLORS = {
  primary: '#3674B5', primaryGradientStart: '#3674B5', primaryGradientEnd: '#578FCA',
  hoverPrimary: '#4C51BF', darkBackground: '#1A202C', lightBackground: '#F7FAFC',
  darkBorder: '#2D3748', lightBorder: '#E2E8F0',
  darkShadow: '0 4px 20px rgba(0,0,0,0.3)', lightShadow: '0 4px 20px rgba(0,0,0,0.15)',
  inputDarkBorder: '1px solid #4A5568', inputLightBorder: '1px solid #CBD5E0',
  inputDarkBg: '#2D3748', inputLightBg: '#FFFFFF',
  inputDarkText: '#E2E8F0', inputLightText: '#2D3748',
  buttonHoverDark: '#434C5E', buttonHoverLight: '#3C4A59'
};

// UI style definitions for positioning and appearance
const UI_STYLES = {
  getPromptButtonContainerStyle: pos => ({
    position: 'fixed', zIndex: '9999',
    bottom: `${pos.y}px`, right: `${pos.x}px`,
    width: '40px', height: '40px',
    userSelect: 'none',
  }),
  promptButtonStyle: { width: '100%', height: '100%', backgroundColor: THEME_COLORS.primary },
  hotCornerStyle: {
    position: 'fixed',
    bottom: '0',
    right: '0',
    width: '40px',
    height: '40px',
    zIndex: '9999',
    pointerEvents: 'none'
  },
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

// Selectors for DOM elements
const SELECTORS = {
  PROMPT_BUTTON_CONTAINER: 'prompt-button-container',
  PROMPT_BUTTON: 'prompt-button',
  PROMPT_LIST: 'prompt-list',
  PROMPT_SEARCH_INPUT: 'prompt-search-input',
  PROMPT_ITEMS_CONTAINER: 'prompt-items-container',
  ONBOARDING_POPUP: 'onboarding-popup'
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

// Helper functions for theme and UI manipulation
const getMode = () => (isDarkMode() ? 'dark' : 'light');
const applyTheme = el => { el.classList.remove('light', 'dark'); el.classList.add(getMode()); };
const showEl = el => { el.style.display = 'block'; void el.offsetHeight; el.classList.add('visible'); };
const hideEl = el => {
  el.classList.remove('visible');
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
    :root {
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
      --button-hover-dark: ${THEME_COLORS.buttonHoverDark};
      --button-hover-light: ${THEME_COLORS.buttonHoverLight};
      --transition-speed: 0.3s;
      --border-radius: 8px;
      --font-family: 'Roboto', sans-serif;
    }
    
    /* New scrollbar styling for our specific containers */
    .prompt-list *,
    .prompt-list-items,
    #${SELECTORS.PROMPT_LIST} *,
    .${SELECTORS.PROMPT_ITEMS_CONTAINER},
    #info-content,
    #changelog-content {
      scrollbar-width: auto !important;
      scrollbar-color: ${THEME_COLORS.primary}90 transparent !important;
    }
    
    body {
      font-family: var(--font-family);
    }
    /* Prompt Button styling */
    .prompt-button {
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
    .toggle-switch {
      position: relative;
      width: 40px;
      height: 20px;
      border-radius: 10px;
      cursor: pointer;
      transition: background-color var(--transition-speed) ease;
    }
    
    .toggle-switch.light {
      background-color: #cbd5e0;
    }
    
    .toggle-switch.dark {
      background-color: #4a5568;
    }
    
    .toggle-switch.active.light {
      background-color: var(--primary);
    }
    
    .toggle-switch.active.dark {
      background-color: var(--primary);
    }
    
    .toggle-switch::after {
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
    
    .toggle-switch.active::after {
      transform: translateX(20px);
    }
    
    /* Prompt Button styling */
    .prompt-button::after {
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
    .prompt-button:hover {
      transform: scale(1.05);
      box-shadow: var(--dark-shadow);
    }
    /* Prompt list container styling */
    .prompt-list {
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
    }
    .prompt-list.visible {
      opacity: 1;
      transform: translateY(0);
    }
    .prompt-list.light {
      background-color: var(--light-bg);
      border: 1px solid var(--light-border);
      box-shadow: var(--light-shadow);
    }
    .prompt-list.dark {
      background-color: var(--dark-bg);
      border: 1px solid var(--dark-border);
      box-shadow: var(--dark-shadow);
    }
    /* List Items styled as modern cards */
    .prompt-list-items {
      max-height: 350px;
      overflow-y: auto;
      margin-bottom: 8px;
    }
    .prompt-list-items.light {
      background-color: var(--light-bg);
    }
    .prompt-list-items.dark {
      background-color: var(--dark-bg);
    }
    .prompt-list-item {
      border-radius: var(--border-radius);
      font-size: 14px;
      cursor: pointer;
      transition: background-color var(--transition-speed) ease, transform var(--transition-speed) ease;
      display: flex;
      align-items: center;
      padding: 8px 8px;
      margin: 6px 0;
    }
    .prompt-list-item.light:hover {
      background-color: #e2e8f0;
      transform: translateY(-2px);
    }
    .prompt-list-item.dark:hover {
      background-color: #2d3748;
      transform: translateY(-2px);
    }
    /* Bottom menu styling */
    .bottom-menu {
      position: sticky;
      bottom: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 10px;
      border-top: 1px solid var(--light-border);
    }
    .bottom-menu.light {
      background-color: var(--light-bg);
    }
    .bottom-menu.dark {
      background-color: var(--dark-bg);
      border-top: 1px solid var(--dark-border);
    }
    /* Search input styling */
    .search-input {
      width: 100%;
      padding: 8px;
      font-size: 14px;
      border-radius: 4px;
      box-sizing: border-box;
      height: 32px;
      line-height: 20px;
      outline: none;
      transition: border-color var(--transition-speed) ease, box-shadow var(--transition-speed) ease;
      display: none;
    }
    .search-input.light {
      border: var(--input-light-border);
      background-color: var(--input-light-bg);
      color: var(--input-light-text);
    }
    .search-input.dark {
      border: var(--input-dark-border);
      background-color: var(--input-dark-bg);
      color: var(--input-dark-text);
    }
    /* Form fields styling */
    .input-field, .textarea-field {
      width: 100%;
      padding: 10px;
      border-radius: 6px;
      box-sizing: border-box;
      font-size: 14px;
      font-family: var(--font-family);
      color: var(--input-text);
      margin-bottom: 8px;
    }
    .input-field.light {
      border: var(--input-light-border);
      background-color: var(--input-light-bg);
      color: var(--input-light-text);
    }
    .input-field.dark {
      border: var(--input-dark-border);
      background-color: var(--input-dark-bg);
      color: var(--input-dark-text);
    }
    .textarea-field.light {
      border: var(--input-light-border);
      background-color: var(--input-light-bg);
      color: var(--input-light-text);
      min-height: 120px;
      resize: vertical;
    }
    .textarea-field.dark {
      border: var(--input-dark-border);
      background-color: var(--input-dark-bg);
      color: var(--input-dark-text);
      min-height: 120px;
      resize: vertical;
    }
    /* Button styling */
    .button {
      padding: 10px;
      width: 100%;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      transition: background-color var(--transition-speed) ease;
      color: #fff;
    }
    .button.light {
      background-color: var(--primary);
    }
    .button.dark {
      background-color: var(--hover-primary);
    }
    .button:hover {
      opacity: 0.9;
    }
    /* Icon button styling */
    .icon-button {
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
    .icon-button:hover {
      background-color: rgba(0, 0, 0, 0.1);
    }
    /* Focus style for input inside prompt list */
    #${SELECTORS.PROMPT_LIST} input:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 2px rgba(90, 103, 216, 0.3);
      outline: none;
    }
    /* Keyboard navigation styling */
    .prompt-list-item.keyboard-selected {
      background-color: var(--dark-bg);
      transform: translateY(-2px);
    }
    .prompt-list-item.light.keyboard-selected {
      background-color: #e2e8f0;
      transform: translateY(-2px);
    }
    .prompt-list-item.dark.keyboard-selected {
      background-color: #2d3748;
      transform: translateY(-2px);
    }
    /* Ensure prompt list stays visible during keyboard navigation */
    .prompt-list.visible:focus-within {
      display: block;
      opacity: 1;
      transform: translateY(0);
    }
    /* Onboarding animation */
    @keyframes onboarding-bounce {
      0%, 100% { transform: translateX(-50%) translateY(0); }
      50% { transform: translateX(-50%) translateY(-5px); }
    }
    /* Responsive styles for onboarding popup */
    @media (max-width: 768px) {
      #${SELECTORS.ONBOARDING_POPUP} {
        font-size: 12px;
        padding: 6px 10px;
      }
    }
    /* Hot corner styling */
    #hot-corner-indicator {
      opacity: 0.7;
      transition: opacity 0.3s ease, border-width 0.3s ease, border-color 0.3s ease;
    }
    #hot-corner-container:hover #hot-corner-indicator {
      opacity: 1;
    }
  `;
  document.head.appendChild(styleEl);
}
injectGlobalStyles();

// Dark Mode Handling
let isDarkModeActive = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    isDarkModeActive = e.matches;
    document.body.classList.toggle('dark', isDarkMode());
    document.body.classList.toggle('light', !isDarkMode());
    PromptUIManager.updateThemeForUI();
  });
}
const isDarkMode = () => isDarkModeActive;

/* Simple Event Bus */
class EventBus {
  constructor() { this.events = {}; }
  on(evt, listener) { (this.events[evt] = this.events[evt] || []).push(listener); }
  emit(evt, ...args) { (this.events[evt] || []).forEach(fn => fn(...args)); }
}

/* Storage Manager */
class PromptStorageManager {
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
  static async getPrompts() { const p = await PromptStorageManager.getData('prompts', []); return Array.isArray(p) ? p : []; }
  static async savePrompt(prompt) {
    if (!prompt.uuid) prompt.uuid = crypto.randomUUID();
    const prompts = await PromptStorageManager.getPrompts();
    prompts.push(prompt);
    await PromptStorageManager.setData('prompts', prompts);
    return { success: true };
  }
  static async mergeImportedPrompts(imported) {
    let prompts = await PromptStorageManager.getPrompts();
    imported.forEach(im => {
      if (im.id && !im.uuid) { im.uuid = im.id; delete im.id; }
      delete im.createdAt;
      if (!im.uuid) im.uuid = crypto.randomUUID();
      const idx = prompts.findIndex(p => p.uuid === im.uuid);
      if (idx !== -1) prompts[idx] = im; else prompts.push(im);
    });
    prompts = prompts.map(p => p.uuid ? p : { ...p, uuid: crypto.randomUUID() });
    await PromptStorageManager.setData('prompts', prompts);
    return prompts;
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
}

/* Icon SVGs */
const ICON_COLOR = () => (getMode() === 'dark' ? '#e1e1e1' : '#3674B5');
const ICON_SVGS = {
  list: `<img src="${chrome.runtime.getURL('icons/list.svg')}" width="16" height="16" alt="List Prompts" title="List Prompts" style="filter: ${getMode() === 'dark' ? 'invert(93%) sepia(0%) saturate(0%) hue-rotate(213deg) brightness(107%) contrast(87%)' : 'invert(37%) sepia(74%) saturate(380%) hue-rotate(175deg) brightness(93%) contrast(88%)'}">`,
  add: `<img src="${chrome.runtime.getURL('icons/new.svg')}" width="16" height="16" alt="Add Prompt" title="Add Prompt" style="filter: ${getMode() === 'dark' ? 'invert(93%) sepia(0%) saturate(0%) hue-rotate(213deg) brightness(107%) contrast(87%)' : 'invert(37%) sepia(74%) saturate(380%) hue-rotate(175deg) brightness(93%) contrast(88%)'}">`,
  delete: `<img src="${chrome.runtime.getURL('icons/delete.svg')}" width="16" height="16" alt="Delete" title="Delete" style="filter: ${getMode() === 'dark' ? 'invert(93%) sepia(0%) saturate(0%) hue-rotate(213deg) brightness(107%) contrast(87%)' : 'invert(37%) sepia(74%) saturate(380%) hue-rotate(175deg) brightness(93%) contrast(88%)'}">`,
  edit: `<img src="${chrome.runtime.getURL('icons/edit.svg')}" width="16" height="16" alt="Edit" title="Edit" style="filter: ${getMode() === 'dark' ? 'invert(93%) sepia(0%) saturate(0%) hue-rotate(213deg) brightness(107%) contrast(87%)' : 'invert(37%) sepia(74%) saturate(380%) hue-rotate(175deg) brightness(93%) contrast(88%)'}">`,
  settings: `<img src="${chrome.runtime.getURL('icons/settings.svg')}" width="16" height="16" alt="Settings" title="Settings" style="filter: ${getMode() === 'dark' ? 'invert(93%) sepia(0%) saturate(0%) hue-rotate(213deg) brightness(107%) contrast(87%)' : 'invert(37%) sepia(74%) saturate(380%) hue-rotate(175deg) brightness(93%) contrast(88%)'}">`,
  import_export: `<img src="${chrome.runtime.getURL('icons/import.svg')}" width="16" height="16" alt="Import/Export" title="Import/Export" style="filter: ${getMode() === 'dark' ? 'invert(93%) sepia(0%) saturate(0%) hue-rotate(213deg) brightness(107%) contrast(87%)' : 'invert(37%) sepia(74%) saturate(380%) hue-rotate(175deg) brightness(93%) contrast(88%)'}">`,
  help: `<img src="${chrome.runtime.getURL('icons/help.svg')}" width="16" height="16" alt="Help" title="Help" style="filter: ${getMode() === 'dark' ? 'invert(93%) sepia(0%) saturate(0%) hue-rotate(213deg) brightness(107%) contrast(87%)' : 'invert(37%) sepia(74%) saturate(380%) hue-rotate(175deg) brightness(93%) contrast(88%)'}">`,
  changelog: `<img src="${chrome.runtime.getURL('icons/notes.svg')}" width="16" height="16" alt="Changelog" title="Changelog" style="filter: ${getMode() === 'dark' ? 'invert(93%) sepia(0%) saturate(0%) hue-rotate(213deg) brightness(107%) contrast(87%)' : 'invert(37%) sepia(74%) saturate(380%) hue-rotate(175deg) brightness(93%) contrast(88%)'}">`,
};

/* UI Manager */
class PromptUIManager {
  // Add a static flag to track manual view changes.
  static manuallyOpened = false;
  static inVariableInputMode = false;
  static eventBus = new EventBus();
  static onPromptSelect(cb) { this.eventBus.on('promptSelect', cb); }
  static emitPromptSelect(prompt) { this.eventBus.emit('promptSelect', prompt); }

  static injectPromptManagerButton(prompts) {
    if (document.getElementById(SELECTORS.PROMPT_BUTTON_CONTAINER)) return;
    PromptStorageManager.getButtonPosition().then(pos => {
      const container = createEl('div', { id: SELECTORS.PROMPT_BUTTON_CONTAINER, styles: UI_STYLES.getPromptButtonContainerStyle(pos) });
      const button = createEl('button', { id: SELECTORS.PROMPT_BUTTON, className: 'prompt-button' });
      container.appendChild(button);
      const listEl = createEl('div', { id: SELECTORS.PROMPT_LIST, className: `prompt-list ${getMode()}` });
      container.appendChild(listEl);
      document.body.appendChild(container);
      PromptUIManager.refreshPromptList(prompts);
      PromptUIManager.attachButtonEvents(button, listEl, container, prompts);
      PromptUIManager.makeDraggable(container);
      PromptUIManager.checkAndShowOnboarding(container);
    });
  }

  static async checkAndShowOnboarding(container) {
    const onboardingCompleted = await PromptStorageManager.getOnboardingCompleted();
    if (!onboardingCompleted) {
      PromptUIManager.showOnboardingPopup(container);
    }
  }

  static showOnboardingPopup(container) {
    const existingPopup = document.getElementById(SELECTORS.ONBOARDING_POPUP);
    if (existingPopup) existingPopup.remove();
    const popup = createEl('div', {
      id: SELECTORS.ONBOARDING_POPUP,
      className: `onboarding-popup ${getMode()}`,
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

  static attachButtonEvents(button, listEl, container, prompts) {
    let isOpen = false;
    const startCloseTimerHandler = (e) => {
      if (e) e.stopPropagation();
      PromptUIManager.startCloseTimer(e, listEl, () => (isOpen = false));
    };

    button.addEventListener('click', e => {
      e.stopPropagation();
      // For manual actions, mark as manuallyOpened.
      PromptUIManager.manuallyOpened = true;
      isOpen ? PromptUIManager.hidePromptList(listEl) : PromptUIManager.showPromptList(listEl);
      isOpen = !isOpen;
    });

    button.addEventListener('mouseenter', async e => {
      e.stopPropagation();
      PromptUIManager.cancelCloseTimer();
      const currentPrompts = await PromptStorageManager.getPrompts();
      if (currentPrompts.length === 0) {
        PromptUIManager.showPromptCreationForm();
      } else {
        PromptUIManager.showPromptList(listEl);
      }
      isOpen = true;
    });

    button.addEventListener('mouseleave', startCloseTimerHandler);
    listEl.addEventListener('mouseenter', PromptUIManager.cancelCloseTimer.bind(PromptUIManager));
    listEl.addEventListener('mouseleave', startCloseTimerHandler);

    document.addEventListener('click', e => {
      const isMenu = e.target.closest(`#${SELECTORS.PROMPT_LIST}`) ||
        e.target.closest(`.${SELECTORS.PROMPT_ITEMS_CONTAINER}`) ||
        e.target.closest('.icon-button') ||
        e.target.closest('.form-container') ||
        e.target.closest('.button') ||
        button.contains(e.target);
      if (isOpen && !isMenu) {
        PromptUIManager.hidePromptList(listEl);
        isOpen = false;
      }
    });
  }

  static startCloseTimer(e, listEl, callback) {
    if (this.closeTimer) clearTimeout(this.closeTimer);
    this.closeTimer = setTimeout(() => { hideEl(listEl); callback && callback(); this.closeTimer = null; }, PROMPT_CLOSE_DELAY);
  }
  static cancelCloseTimer() { if (this.closeTimer) { clearTimeout(this.closeTimer); this.closeTimer = null; } }

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

  static buildPromptListContainer(prompts = []) {
    const listEl = document.getElementById(SELECTORS.PROMPT_LIST);
    if (!listEl) return;
    applyTheme(listEl);
    listEl.innerHTML = '';
    const container = createEl('div', { className: `${SELECTORS.PROMPT_ITEMS_CONTAINER} prompt-list-items ${getMode()}` });
    prompts.forEach(p => container.appendChild(PromptUIManager.createPromptItem(p)));
    listEl.appendChild(container);
    listEl.appendChild(PromptUIManager.createBottomMenu());
  }

  static resetPromptListContainer() {
    const listEl = document.getElementById(SELECTORS.PROMPT_LIST);
    const wasVisible = listEl && listEl.classList.contains('visible');
    PromptUIManager.buildPromptListContainer();
    if (wasVisible) {
      const updated = document.getElementById(SELECTORS.PROMPT_LIST);
      if (updated) { updated.style.display = 'block'; void updated.offsetHeight; updated.classList.add('visible'); }
    }
  }

  static createPromptItem(prompt) {
    const item = createEl('div', {
      className: `prompt-list-item ${getMode()}`,
      eventListeners: {
        click: () => PromptUIManager.emitPromptSelect(prompt),
        mouseenter: () => {
          document.querySelectorAll('.prompt-list-item').forEach(i => i.classList.remove('keyboard-selected'));
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
  }

  static createBottomMenu() {
    const menu = createEl('div', {
      className: `bottom-menu ${getMode()}`,
      styles: { display: 'flex', flexDirection: 'column', gap: '10px', padding: '10px 10px 5px 10px', borderTop: '1px solid var(--light-border)' }
    });
    const search = createEl('input', {
      id: SELECTORS.PROMPT_SEARCH_INPUT,
      className: `search-input ${getMode()}`,
      attributes: { type: 'text', placeholder: 'Type to search', style: 'border-radius: 4px;' }
    });
    search.addEventListener('keydown', e => {
      PromptUIManager.handleKeyboardNavigation(e, 'search');
    });
    search.addEventListener('input', e => {
      const term = e.target.value.toLowerCase();
      const container = document.querySelector(`.${SELECTORS.PROMPT_ITEMS_CONTAINER}`);
      if (!container) return;
      Array.from(container.children).forEach(item =>
        item.style.display = (item.dataset.title.includes(term) || item.dataset.content.includes(term)) ? 'flex' : 'none'
      );
      PromptUIManager.selectedSearchIndex = -1;
    });
    menu.appendChild(search);
    menu.appendChild(PromptUIManager.createMenuBar());
    return menu;
  }

  static createMenuBar() {
    const bar = createEl('div', { styles: { display: 'flex', alignItems: 'center', gap: '8px' } });
    const btns = ['list', 'add', 'edit', 'import_export', 'help', 'changelog','settings'];
    // Add manual flag before calling the actions.
    const actions = {
      list: e => { e.stopPropagation(); PromptUIManager.manuallyOpened = true; PromptUIManager.refreshAndShowPromptList(); },
      add: e => { e.stopPropagation(); PromptUIManager.manuallyOpened = true; PromptUIManager.showPromptCreationForm(); },
      edit: e => { e.stopPropagation(); PromptUIManager.manuallyOpened = true; PromptUIManager.showEditView(); },
      settings: e => { e.stopPropagation(); PromptUIManager.manuallyOpened = true; PromptUIManager.showSettingsForm(); },
      import_export: e => { e.stopPropagation(); PromptUIManager.manuallyOpened = true; PromptUIManager.showImportExportForm(); },
      help: e => { e.stopPropagation(); PromptUIManager.manuallyOpened = true; PromptUIManager.showHelp(); },
      changelog: e => { e.stopPropagation(); PromptUIManager.manuallyOpened = true; PromptUIManager.showChangelog(); },
    };
    btns.forEach(type => bar.appendChild(PromptUIManager.createIconButton(type, actions[type])));
    return bar;
  }

  static createIconButton(type, onClick) {
    return createEl('button', { className: 'icon-button', eventListeners: { click: onClick }, innerHTML: ICON_SVGS[type] || '' });
  }

  static showPromptList(listEl) {
    if (!listEl) return;
    showEl(listEl);
    listEl.classList.add('visible');
    document.addEventListener('keydown', PromptUIManager.handleKeyboardNavigation);
    document.addEventListener('keydown', PromptUIManager.handleGlobalEscape);
    const first = listEl.querySelector('.prompt-list-item');
    if (first) setTimeout(() => first.focus(), 50);
    PromptUIManager.focusSearchInput();
    PromptStorageManager.setOnboardingCompleted();
    const popup = document.getElementById(SELECTORS.ONBOARDING_POPUP);
    if (popup) popup.remove();
  }

  static hidePromptList(listEl) {
    if (!listEl) return;
    hideEl(listEl);
    const input = document.getElementById(SELECTORS.PROMPT_SEARCH_INPUT);
    if (input) input.value = '';
    document.removeEventListener('keydown', PromptUIManager.handleKeyboardNavigation);
    document.removeEventListener('keydown', PromptUIManager.handleGlobalEscape);
    // Reset both flags when hiding the view
    PromptUIManager.manuallyOpened = false;
    PromptUIManager.inVariableInputMode = false;
  }

  static handleKeyboardNavigation(e, context = 'list') {
    const list = document.getElementById(SELECTORS.PROMPT_LIST);
    if (!list || !list.classList.contains('visible')) return;
    PromptUIManager.cancelCloseTimer();
    let items = [];
    if (context === 'search') {
      const container = document.querySelector(`.${SELECTORS.PROMPT_ITEMS_CONTAINER}`);
      if (!container) return;
      items = Array.from(container.querySelectorAll('.prompt-list-item'))
        .filter(item => item.style.display !== 'none' && !item.classList.contains('shortcut-container'));
    } else {
      items = Array.from(list.querySelectorAll('.prompt-list-item'));
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
      if (listEl && listEl.classList.contains('visible')) {
        e.preventDefault();
        PromptUIManager.selectedSearchIndex = -1;
        const container = document.querySelector(`.${SELECTORS.PROMPT_ITEMS_CONTAINER}`);
        if (container) {
          const items = Array.from(container.querySelectorAll('.prompt-list-item'))
            .filter(item => item.style.display !== 'none' && !item.classList.contains('shortcut-container'));
          PromptUIManager.updateSelection(items, -1);
        }
        PromptUIManager.hidePromptList(listEl);
      }
    }
  }

  static updateThemeForUI() {
    document.body.classList.toggle('dark', isDarkMode());
    document.body.classList.toggle('light', !isDarkMode());
    const themeElements = document.querySelectorAll([
        '.prompt-list',
        '.prompt-list-items',
        '.prompt-list-item',
        '.search-input',
        '.input-field',
        '.textarea-field',
        '.button',
        '.toggle-switch',
        '.form-container',
        '.bottom-menu'
    ].join(','));
    themeElements.forEach(el => {
        el.classList.remove('light', 'dark');
        el.classList.add(getMode());
    });
    const container = document.getElementById(SELECTORS.PROMPT_BUTTON_CONTAINER);
    if (container) {
        const btn = container.querySelector(`.${SELECTORS.PROMPT_BUTTON}`);
        if (btn) {
            btn.style.boxShadow = isDarkMode() ? THEME_COLORS.darkShadow : THEME_COLORS.lightShadow;
        }
    }
    const icons = document.querySelectorAll('.icon-button img');
    icons.forEach(icon => {
        icon.style.filter = isDarkMode() 
            ? 'invert(93%) sepia(0%) saturate(0%) hue-rotate(213deg) brightness(107%) contrast(87%)'
            : 'invert(37%) sepia(74%) saturate(380%) hue-rotate(175deg) brightness(93%) contrast(88%)';
    });
  }

  static refreshAndShowPromptList() {
    (async () => {
      const prompts = await PromptStorageManager.getPrompts();
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
    const input = list.querySelector(`#${SELECTORS.PROMPT_SEARCH_INPUT}`);
    if (input) input.style.display = 'none';
    PromptStorageManager.getPrompts().then(prompts => {
      const form = PromptUIManager.createPromptCreationForm('', prompts.length === 0);
      list.insertBefore(form, list.firstChild);
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
      className: `form-container ${getMode()}`,
      styles: { padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }
    });
    const varContainer = createEl('div', {
      styles: { display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '300px', overflowY: 'auto' }
    });
    const varValues = {};
    variables.forEach(v => {
      const row = createEl('div', { styles: { display: 'flex', flexDirection: 'column', gap: '4px' } });
      const label = createEl('label', { innerHTML: v, styles: { fontSize: '12px', fontWeight: 'bold', color: dark ? THEME_COLORS.inputDarkText : '#333' } });
      const inputField = createEl('input', { attributes: { type: 'text', placeholder: `${v} value` }, className: `input-field ${getMode()}` });
      inputField.addEventListener('input', () => { varValues[v] = inputField.value; });
      inputField.addEventListener('keydown', e => { if (e.key === 'Enter') submitBtn.click(); });
      row.append(label, inputField);
      varContainer.appendChild(row);
      varValues[v] = '';
    });
    form.appendChild(varContainer);
    const btnContainer = createEl('div', { styles: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' } });
    const submitBtn = createEl('button', { innerHTML: 'Submit', className: `button ${getMode()}` });
    submitBtn.addEventListener('click', () => { 
      PromptUIManager.inVariableInputMode = false;
      onSubmit(varValues); 
    });
    const backBtn = createEl('button', {
      innerHTML: 'Back', className: `button ${getMode()}`,
      styles: { marginTop: '4px', backgroundColor: dark ? '#4A5568' : '#CBD5E0', color: dark ? THEME_COLORS.inputDarkText : '#333' }
    });
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
    const search = document.getElementById(SELECTORS.PROMPT_SEARCH_INPUT);
    if (search) search.style.display = 'none';
    const form = createEl('div', { className: `form-container ${getMode()}`, styles: { padding: '0', display: 'flex', flexDirection: 'column', gap: '8px' } });
    const titleIn = createEl('input', { attributes: { placeholder: 'Prompt Title' }, className: `input-field ${getMode()}`, styles: { borderRadius: '4px' } });
    const contentArea = createEl('textarea', {
      attributes: { placeholder: 'Enter your prompt here. Add variables with #examplevariable#' },
      className: `textarea-field ${getMode()}`,
      styles: { minHeight: '220px' }
    });
    contentArea.value = prefill;
    const saveBtn = createEl('button', { innerHTML: 'Create Prompt', className: `button ${getMode()}` });
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
  }

  static showSaveErrorDialog(msg) { alert(msg); }

  static createImportExportForm() {
    const dark = isDarkMode();
    const search = document.getElementById(SELECTORS.PROMPT_SEARCH_INPUT);
    if (search) search.style.display = 'none';
    const form = createEl('div', { className: `form-container ${getMode()}`, styles: { padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' } });
    const exportBtn = createEl('button', { innerHTML: 'Export Prompts', className: `button ${getMode()}` });
    exportBtn.addEventListener('click', async e => {
      e.stopPropagation();
      const prompts = await PromptStorageManager.getPrompts();
      const json = JSON.stringify(prompts, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = createEl('a', { attributes: { href: url, download: `prompts-${new Date().toISOString().split('T')[0]}.json` } });
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
    const importBtn = createEl('button', { innerHTML: 'Import Prompts', className: `button ${getMode()}`, styles: { marginTop: '8px' } });
    importBtn.addEventListener('click', async e => {
      e.stopPropagation();
      const fileInput = createEl('input', { attributes: { type: 'file', accept: '.json' } });
      fileInput.addEventListener('change', async event => {
        const file = event.target.files[0];
        if (file) {
          try {
            const text = await file.text();
            const imported = JSON.parse(text);
            if (!Array.isArray(imported)) throw new Error('Invalid format');
            const merged = await PromptStorageManager.mergeImportedPrompts(imported);
            PromptUIManager.refreshPromptList(merged);
            importBtn.textContent = 'Import successful!';
            setTimeout(() => importBtn.textContent = 'Import Prompts', 2000);
          } catch (err) { alert('Invalid JSON file format.'); }
        }
      });
      fileInput.click();
    });
    form.append(exportBtn, importBtn);
    return form;
  }

  static showImportExportForm() {
    const list = document.getElementById(SELECTORS.PROMPT_LIST);
    if (!list) return;
    PromptUIManager.showPromptList(list);
    PromptUIManager.resetPromptListContainer();
    const form = PromptUIManager.createImportExportForm();
    list.insertBefore(form, list.firstChild);
  }

  static async createEditView() {
    const dark = isDarkMode();
    const prompts = await PromptStorageManager.getPrompts();
    const container = createEl('div', { className: `form-container ${getMode()}`, styles: { padding: '0', display: 'flex', flexDirection: 'column' } });
    const promptsContainer = createEl('div', { className: `${SELECTORS.PROMPT_ITEMS_CONTAINER} prompt-list-items ${getMode()}`, styles: { maxHeight: '350px', overflowY: 'auto', marginBottom: '4px' } });
    prompts.forEach((p, idx) => {
      const item = createEl('div', {
        className: `prompt-list-item ${getMode()}`,
        styles: {
          justifyContent: 'space-between',
          padding: '4px 10px',
          margin: '6px 0'
        }
      });
      item.setAttribute('draggable', 'true');
      item.dataset.index = idx;
      item.addEventListener('dragstart', e => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', idx);
        item.classList.add('dragging');
      });
      item.addEventListener('dragend', e => item.classList.remove('dragging'));
      item.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
      item.addEventListener('drop', e => {
        e.preventDefault();
        const from = e.dataTransfer.getData('text/plain'), to = item.dataset.index;
        if (from === to) return;
        const newPrompts = [...prompts];
        const [moved] = newPrompts.splice(from, 1);
        newPrompts.splice(to, 0, moved);
        PromptStorageManager.setData('prompts', newPrompts).then(() => { PromptUIManager.showEditView(); });
      });
      const text = createEl('div', { styles: { flex: '1' } });
      text.textContent = p.title;
      const actions = createEl('div', { styles: { display: 'flex', gap: '4px' } });
      const editIcon = PromptUIManager.createIconButton('edit', () => { PromptUIManager.showEditForm(p, idx); });
      const deleteIcon = PromptUIManager.createIconButton('delete', () => { if (confirm(`Delete "${p.title}"?`)) PromptUIManager.deletePrompt(idx); });
      actions.append(editIcon, deleteIcon);
      item.append(text, actions);
      promptsContainer.appendChild(item);
    });
    container.appendChild(promptsContainer);
    return container;
  }

  static async showEditForm(prompt, index) {
    const dark = isDarkMode();
    const list = document.getElementById(SELECTORS.PROMPT_LIST);
    if (!list) return;
    PromptUIManager.resetPromptListContainer();
    const form = createEl('div', { className: `form-container ${getMode()}`, styles: { padding: '0', display: 'flex', flexDirection: 'column', gap: '8px' } });
    const titleIn = createEl('input', { className: `input-field ${getMode()}`, attributes: { type: 'text', placeholder: 'Prompt Title' } });
    titleIn.value = prompt.title;
    const contentArea = createEl('textarea', { className: `textarea-field ${getMode()}`, styles: { minHeight: '250px' } });
    contentArea.value = prompt.content;
    const saveBtn = createEl('button', { innerHTML: 'Save Changes', className: `button ${getMode()}` });
    saveBtn.addEventListener('click', async e => {
      e.stopPropagation();
      const prompts = await PromptStorageManager.getPrompts();
      prompts[index] = { title: titleIn.value.trim(), content: contentArea.value.trim(), uuid: prompt.uuid };
      await PromptStorageManager.setData('prompts', prompts);
      PromptUIManager.showEditView();
    });
    form.append(titleIn, contentArea, saveBtn);
    form.addEventListener('click', e => e.stopPropagation());
    list.insertBefore(form, list.firstChild);
  }

  static async deletePrompt(index) {
    const prompts = await PromptStorageManager.getPrompts();
    prompts.splice(index, 1);
    await PromptStorageManager.setData('prompts', prompts);
    const list = document.getElementById(SELECTORS.PROMPT_LIST);
    if (list) { PromptUIManager.resetPromptListContainer(); PromptUIManager.showEditView(); }
  }

  static showEditView() {
    const list = document.getElementById(SELECTORS.PROMPT_LIST);
    if (!list) return;
    PromptUIManager.showPromptList(list);
    PromptUIManager.resetPromptListContainer();
    (async () => { const view = await PromptUIManager.createEditView(); list.insertBefore(view, list.firstChild); })();
  }

  static showHelp() {
    const list = document.getElementById(SELECTORS.PROMPT_LIST);
    if (!list) return;
    PromptUIManager.showPromptList(list);
    PromptUIManager.resetPromptListContainer();
    const dark = isDarkMode();
    const container = createEl('div', { className: `form-container ${getMode()}`, styles: { padding: '0', display: 'flex', flexDirection: 'column', gap: '4px' } });
    const title = createEl('div', { styles: { fontWeight: 'bold', fontSize: '16px', marginBottom: '6px' }, innerHTML: 'Navigation' });
    const info = createEl('div', { id: 'info-content', styles: { maxHeight: '300px', overflowY: 'auto', padding: '4px', borderRadius: '6px', color: dark ? THEME_COLORS.inputDarkText : THEME_COLORS.inputLightText } });
    fetch(chrome.runtime.getURL('info.html')).then(r => r.text()).then(html => { info.innerHTML = html; });
    container.append(title, info);
    list.insertBefore(container, list.firstChild);
  }

  static showChangelog() {
    const list = document.getElementById(SELECTORS.PROMPT_LIST);
    if (!list) return;
    PromptUIManager.showPromptList(list);
    PromptUIManager.resetPromptListContainer();
    const dark = isDarkMode();
    const container = createEl('div', { className: `form-container ${getMode()}`, styles: { padding: '0', display: 'flex', flexDirection: 'column', gap: '6px' } });
    const title = createEl('div', { styles: { fontWeight: 'bold', fontSize: '16px', marginBottom: '6px' }, innerHTML: 'Changelog' });
    const info = createEl('div', { id: 'changelog-content', styles: { maxHeight: '250px', overflowY: 'auto', padding: '4px', borderRadius: '6px', color: dark ? THEME_COLORS.inputDarkText : THEME_COLORS.inputLightText } });
    fetch(chrome.runtime.getURL('changelog.html')).then(r => r.text()).then(html => { info.innerHTML = html; });
    container.append(title, info);
    list.insertBefore(container, list.firstChild);
  }
  static showSettingsForm() {
    const list = document.getElementById(SELECTORS.PROMPT_LIST);
    if (!list) return;
    PromptUIManager.showPromptList(list);
    PromptUIManager.resetPromptListContainer();
    const form = PromptUIManager.createSettingsForm();
    list.insertBefore(form, list.firstChild);
  }
  static createSettingsForm() {
    const dark = isDarkMode();
    const form = createEl('div', { className: `form-container ${getMode()}`, styles: { padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' } });
    const title = createEl('div', { styles: { fontWeight: 'bold', fontSize: '16px', marginBottom: '10px' }, innerHTML: 'Settings' });
    const settings = createEl('div', { styles: { display: 'flex', flexDirection: 'column', gap: '12px' } });
    const displayModeRow = createEl('div', { styles: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } });
    const displayModeLabel = createEl('label', { innerHTML: 'Hot Corner Mode', styles: { fontSize: '14px' } });
    PromptStorageManager.getDisplayMode().then(mode => {
      const isHotCorner = mode === 'hotCorner';
      const toggleSwitch = createEl('div', { 
        className: `toggle-switch ${getMode()} ${isHotCorner ? 'active' : ''}`,
        eventListeners: { 
          click: e => {
            e.stopPropagation();
            toggleSwitch.classList.toggle('active');
            const newMode = toggleSwitch.classList.contains('active') ? 'hotCorner' : 'standard';
            PromptStorageManager.saveDisplayMode(newMode).then(() => {
              PromptUIManager.refreshDisplayMode();
            });
          } 
        } 
      });
      displayModeRow.append(displayModeLabel, toggleSwitch);
      settings.appendChild(displayModeRow);
    });
    form.append(title, settings);
    return form;
  }

  static updateSelection(items, selIndex) {
    items.forEach((item, idx) => {
      item.style.backgroundColor = '';
      item.style.border = '';
      item.style.transform = '';
      item.classList.toggle('keyboard-selected', idx === selIndex);
      if (idx === selIndex) {
        const container = item.parentElement, top = item.offsetTop, bottom = top + item.offsetHeight,
          cTop = container.scrollTop, cBottom = cTop + container.offsetHeight;
        if (top < cTop) container.scrollTop = top;
        else if (bottom > cBottom) container.scrollTop = bottom - container.offsetHeight;
      }
    });
  }

  static selectedSearchIndex = -1;

  // Hot corner injection with manual mode check.
  static injectHotCorner() {
    if (document.getElementById('hot-corner-container')) return;
    
    // container with active zone
    const container = createEl('div', { 
      id: 'hot-corner-container', 
      styles: UI_STYLES.hotCornerActiveZone
    });
    
    //  visual indicator
    const indicator = createEl('div', {
      id: 'hot-corner-indicator',
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
      className: `prompt-list ${getMode()}`,
      styles: {
        position: 'absolute',
        right: '30px',
        bottom: '30px',
      }
    });
    container.appendChild(listEl);
    document.body.appendChild(container);
    
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
    container.addEventListener('mouseleave', e => {
      e.stopPropagation();
      indicator.style.borderWidth = '0 0 20px 20px';
      indicator.style.borderColor = `transparent transparent ${THEME_COLORS.primary}90 transparent`;
      PromptUIManager.startCloseTimer(e, listEl, () => {});
    });
    
    //  document click handler for closing the prompt list when clicking outside
    const documentClickHandler = e => {
      const isMenu = e.target.closest(`#${SELECTORS.PROMPT_LIST}`) ||
        e.target.closest(`.${SELECTORS.PROMPT_ITEMS_CONTAINER}`) ||
        e.target.closest('.icon-button') ||
        e.target.closest('.form-container') ||
        e.target.closest('.button') ||
        container.contains(e.target);
      
      if (listEl.classList.contains('visible') && !isMenu) {
        PromptUIManager.hidePromptList(listEl);
      }
    };
    
    // Store reference to the handler for cleanup
    container.documentClickHandler = documentClickHandler;
    
    // Add the event listener to the document
    document.addEventListener('click', documentClickHandler);
    
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
    const hotCornerContainer = document.getElementById('hot-corner-container');
    if (hotCornerContainer) {
      // Remove the document click handler if it exists
      if (hotCornerContainer.documentClickHandler) {
        document.removeEventListener('click', hotCornerContainer.documentClickHandler);
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
    
    // Make sure the prompt list is refreshed
    PromptUIManager.refreshPromptList(prompts);
    // If switching modes from settings, we should close any open menu
    const listEl = document.getElementById(SELECTORS.PROMPT_LIST);
    if (listEl && listEl.classList.contains('visible')) {
      PromptUIManager.hidePromptList(listEl);
    }
  }

  setupMutationObserver() {
    let observerTimeout = null;
    const target = document.querySelector('main') || document.body;
    const observer = new MutationObserver(async () => {
      if (observerTimeout) clearTimeout(observerTimeout);
      observerTimeout = setTimeout(async () => {
        const inputBox = InputBoxHandler.getInputBox();
        if (inputBox) {
          const displayMode = await PromptStorageManager.getDisplayMode();
          // cleanupAllUIComponents method to ensure clean state
          if (!document.getElementById(SELECTORS.PROMPT_BUTTON_CONTAINER) && 
              !document.getElementById('hot-corner-container')) {
            PromptUIManager.cleanupAllUIComponents();
            const prompts = await PromptStorageManager.getPrompts();
            if (displayMode === 'standard') {
              PromptUIManager.injectPromptManagerButton(prompts);
            } else {
              PromptUIManager.injectHotCorner();
            }
          }
        }
      }, 300);
    });
    observer.observe(target, { childList: true, subtree: true });
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
  static async insertPrompt(inputBox, content, listEl) {
    const vars = PromptProcessor.extractVariables(content);
    if (vars.length === 0) {
      await InputBoxHandler.insertPrompt(inputBox, content, listEl);
      PromptUIManager.hidePromptList(listEl);
    } else {
      console.error('Prompts with variables handled by PromptMediator.');
    }
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
      const inputBox = InputBoxHandler.getInputBox();
      if (!inputBox) { console.error('Input box not found.'); return; }
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
      await InputBoxHandler.waitForInputBox();
      const displayMode = await PromptStorageManager.getDisplayMode();
      if (displayMode === 'standard') {
        const prompts = await PromptStorageManager.getPrompts();
        PromptUIManager.injectPromptManagerButton(prompts);
      } else {
        PromptUIManager.injectHotCorner();
      }
      this.setupMutationObserver();
      this.setupStorageChangeMonitor();
      this.setupKeyboardShortcuts();
    } catch (err) { console.error('Error initializing extension:', err); }
  }
  
  setupMutationObserver() {
    let observerTimeout = null;
    const target = document.querySelector('main') || document.body;
    const observer = new MutationObserver(async () => {
      if (observerTimeout) clearTimeout(observerTimeout);
      observerTimeout = setTimeout(async () => {
        const inputBox = InputBoxHandler.getInputBox();
        if (inputBox) {
          const displayMode = await PromptStorageManager.getDisplayMode();
          // cleanupAllUIComponents method to ensure clean state
          if (!document.getElementById(SELECTORS.PROMPT_BUTTON_CONTAINER) && 
              !document.getElementById('hot-corner-container')) {
            PromptUIManager.cleanupAllUIComponents();
            const prompts = await PromptStorageManager.getPrompts();
            if (displayMode === 'standard') {
              PromptUIManager.injectPromptManagerButton(prompts);
            } else {
              PromptUIManager.injectHotCorner();
            }
          }
        }
      }, 300);
    });
    observer.observe(target, { childList: true, subtree: true });
  }
  
  setupStorageChangeMonitor() {
    PromptStorageManager.onChange(async (changes, area) => {
      if (area === 'local' && changes.prompts) {
        PromptUIManager.refreshPromptList(changes.prompts.newValue);
      }
    });
  }
  
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', async e => {
      const shortcut = await PromptStorageManager.getKeyboardShortcut();
      if (e[shortcut.modifier] && (shortcut.requiresShift ? e.shiftKey : true) && e.key.toLowerCase() === shortcut.key.toLowerCase()) {
        e.preventDefault();
        const listEl = document.getElementById(SELECTORS.PROMPT_LIST);
        if (listEl) listEl.classList.contains('visible') ? PromptUIManager.hidePromptList(listEl) : PromptUIManager.showPromptList(listEl);
      }
    });
  }
}

/* Initialize the extension */
setTimeout(() => { new PromptMediator(PromptUIManager, PromptProcessor); }, 100);
