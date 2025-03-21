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
  promptButtonStyle: { width: '100%', height: '100%', backgroundColor: THEME_COLORS.primary }
};

// Time delay for auto close
const PROMPT_CLOSE_DELAY = 5000;

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
  }, 200); // 200ms delay for smooth transition for closing container
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
    
    /* New scrollbar styling for our specific containers - apparently, firefox styling works best?*/
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
    /* Keyboard navigation styling - matches hover styling */
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
    
    /* Allow both hover and keyboard selection to work together */
    .prompt-list-item:hover,
    .prompt-list-item.keyboard-selected:hover {
      background-color: var(--dark-bg);
      transform: translateY(-2px);
    }
    .prompt-list-item.light:hover,
    .prompt-list-item.light.keyboard-selected:hover {
      background-color: #e2e8f0;
      transform: translateY(-2px);
    }
    .prompt-list-item.dark:hover,
    .prompt-list-item.dark.keyboard-selected:hover {
      background-color: #2d3748;
      transform: translateY(-2px);
    }
    
    /* Make keyboard focus match hover styling for prompt items */
    .prompt-list-item:focus,
    .prompt-list-item:focus-visible {
      outline: none;
    }
    .prompt-list-item.light:focus,
    .prompt-list-item.light:focus-visible {
      background-color: #e2e8f0;
      transform: translateY(-2px);
    }
    .prompt-list-item.dark:focus,
    .prompt-list-item.dark:focus-visible {
      background-color: #2d3748;
      transform: translateY(-2px);
    }
    /* Ensure the prompt-list stays visible during keyboard navigation */
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
  `;
  document.head.appendChild(styleEl);
}
injectGlobalStyles();

// Dark Mode Handling - Initialize based on system preference
let isDarkModeActive = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
if (window.matchMedia) { //listen for theme changes
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

/* Storage Manager - Handles all chrome.storage operations and data management
 * methods for:
 * - Getting/setting data from chrome.storage
 * - Managing prompts (get, save, merge imported)
 * - Managing button position and keyboard shortcuts
 * - Handling storage change events
 */
class PromptStorageManager {
  // Get data from chrome storage with fallback default value
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

  // Save data to chrome storage
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

  // Get all saved prompts, ensuring return value is an array
  static async getPrompts() { const p = await PromptStorageManager.getData('prompts', []); return Array.isArray(p) ? p : []; }

  // Save a new prompt, generating UUID if needed
  static async savePrompt(prompt) {
    if (!prompt.uuid) prompt.uuid = crypto.randomUUID();
    const prompts = await PromptStorageManager.getPrompts();
    prompts.push(prompt);
    await PromptStorageManager.setData('prompts', prompts);
    return { success: true };
  }

  // Merge imported prompts with existing ones, handling duplicates and missing UUIDs
  static async mergeImportedPrompts(imported) {
    let prompts = await PromptStorageManager.getPrompts();
    const byUuid = Object.fromEntries(prompts.filter(p => p.uuid).map(p => [p.uuid, p]));
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

  // Register callback for storage changes
  static onChange(cb) { chrome.storage.onChanged.addListener(cb); }

  // Get the floating button position
  static async getButtonPosition() { return await PromptStorageManager.getData('buttonPosition', { x: 75, y: 100 }); }
  static async saveButtonPosition(pos) {
    const current = await PromptStorageManager.getButtonPosition();
    if (current.x === pos.x && current.y === pos.y) return true;
    return await PromptStorageManager.setData('buttonPosition', pos);
  }

  // keyboard shortcut settings with platform-specific defaults
  static async getKeyboardShortcut() {
    const isMac = navigator.platform.toUpperCase().includes('MAC');
    return await PromptStorageManager.getData('keyboardShortcut', {
      key: isMac ? 'p' : 'm',
      modifier: isMac ? 'metaKey' : 'ctrlKey',
      requiresShift: isMac
    });
  }
  static async saveKeyboardShortcut(shortcut) { return await PromptStorageManager.setData('keyboardShortcut', shortcut); }
  // Check if the user has completed onboarding
  static async getOnboardingCompleted() {
    return await PromptStorageManager.getData('onboardingCompleted', false);
  }

  // Mark onboarding as completed
  static async setOnboardingCompleted() {
    return await PromptStorageManager.setData('onboardingCompleted', true);
  }
}

/* Icon SVGs */
// Get theme color for icons based on current mode
const ICON_COLOR = () => (getMode() === 'dark' ? '#e1e1e1' : '#3674B5');

// Define SVG icons with theme color
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

/* UI Manager - Handles all UI-related operations and interactions */
class PromptUIManager {
  // Event bus for handling prompt selection events
  static eventBus = new EventBus();

  // Event subscription methods
  static onPromptSelect(cb) { this.eventBus.on('promptSelect', cb); }
  static emitPromptSelect(prompt) { this.eventBus.emit('promptSelect', prompt); }

  // Injects the main prompt button and list container into the page
  static injectPromptManagerButton(prompts) {
    if (document.getElementById(SELECTORS.PROMPT_BUTTON_CONTAINER)) return;
    PromptStorageManager.getButtonPosition().then(pos => {
      // Create main container
      const container = createEl('div', { id: SELECTORS.PROMPT_BUTTON_CONTAINER, styles: UI_STYLES.getPromptButtonContainerStyle(pos) });
      const button = createEl('button', { id: SELECTORS.PROMPT_BUTTON, className: 'prompt-button' });
      container.appendChild(button);
      const listEl = createEl('div', { id: SELECTORS.PROMPT_LIST, className: `prompt-list ${getMode()}` });
      container.appendChild(listEl);
      document.body.appendChild(container);

      // Always refresh the prompt list initially, regardless of whether it's empty
      PromptUIManager.refreshPromptList(prompts);

      // Setup event handlers
      PromptUIManager.attachButtonEvents(button, listEl, container, prompts);
      PromptUIManager.makeDraggable(container);

      // Check if onboarding should be shown
      PromptUIManager.checkAndShowOnboarding(container);
    });
  }

  // Check if onboarding should be shown and display it if needed
  static async checkAndShowOnboarding(container) {
    const onboardingCompleted = await PromptStorageManager.getOnboardingCompleted();
    if (!onboardingCompleted) {
      PromptUIManager.showOnboardingPopup(container);
    }
  }

  // Create and show the onboarding popup
  static showOnboardingPopup(container) {
    // Remove any existing popup first
    const existingPopup = document.getElementById(SELECTORS.ONBOARDING_POPUP);
    if (existingPopup) existingPopup.remove();

    // Create the popup with solid primary color 
    const popup = createEl('div', {
      id: SELECTORS.ONBOARDING_POPUP,
      className: `onboarding-popup ${getMode()}`,
      styles: {
        position: 'absolute',
        top: '-42px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: `${THEME_COLORS.primary}dd`,
        color: 'white',
        padding: '6px 10px',
        borderRadius: '6px',
        fontSize: '13px',
        fontWeight: 'bold',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.15)',
        zIndex: '10000',
        textAlign: 'center',
        whiteSpace: 'nowrap',
        transition: 'opacity 0.3s ease'
      },
      innerHTML: 'Hover to Start'
    });

    // little triangle pointing down with primary color
    const triangle = createEl('div', {
      styles: {
        position: 'absolute',
        bottom: '-4px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '0',
        height: '0',
        borderLeft: '5px solid transparent',
        borderRight: '5px solid transparent',
        borderTop: `5px solid ${THEME_COLORS.primary}dd`
      }
    });

    popup.appendChild(triangle);
    container.appendChild(popup);

    // Automatically hide after 10 seconds
    setTimeout(() => {
      if (popup && popup.parentNode) {
        popup.style.opacity = '0';
        setTimeout(() => {
          if (popup && popup.parentNode) popup.remove();
        }, 300);
      }
    }, 10000);
  }

  // Attaches click and hover events to the prompt button
  static attachButtonEvents(button, listEl, container, prompts) {
    let isOpen = false;

    // Shared handler for starting the close timer
    const startCloseTimerHandler = (e) => {
      if (e) e.stopPropagation();
      PromptUIManager.startCloseTimer(e, listEl, () => (isOpen = false));
    };

    // Toggle list on click
    button.addEventListener('click', e => {
      e.stopPropagation();
      isOpen ? PromptUIManager.hidePromptList(listEl) : PromptUIManager.showPromptList(listEl);
      isOpen = !isOpen;
    });

    // Show appropriate content on hover - dynamically check prompts count
    button.addEventListener('mouseenter', async e => {
      e.stopPropagation();
      PromptUIManager.cancelCloseTimer();

      // Get current prompts instead of using a stale reference
      const currentPrompts = await PromptStorageManager.getPrompts();

      // If no prompts exist, show the creation form instead of the prompt list
      if (currentPrompts.length === 0) {
        PromptUIManager.showPromptCreationForm();
      } else {
        PromptUIManager.showPromptList(listEl);
      }
      isOpen = true;
    });

    // Start close timer on mouse leave
    button.addEventListener('mouseleave', startCloseTimerHandler);
    // Cancel close timer when mouse enters list
    listEl.addEventListener('mouseenter', PromptUIManager.cancelCloseTimer.bind(PromptUIManager));
    // Start close timer when mouse leaves list  
    listEl.addEventListener('mouseleave', startCloseTimerHandler);

    // Close list when clicking outside
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

  // Timer management for auto-closing the prompt list
  static startCloseTimer(e, listEl, callback) {
    if (this.closeTimer) clearTimeout(this.closeTimer);
    this.closeTimer = setTimeout(() => { hideEl(listEl); callback && callback(); this.closeTimer = null; }, PROMPT_CLOSE_DELAY);
  }
  static cancelCloseTimer() { if (this.closeTimer) { clearTimeout(this.closeTimer); this.closeTimer = null; } }

  // Makes the prompt button draggable and saves its position - simplified version
  static makeDraggable(container) {
    let pos = { x: 0, y: 0 };

    // Load the initial position
    PromptStorageManager.getButtonPosition().then(savedPos => {
      pos = savedPos;
      Object.assign(container.style, {
        right: `${pos.x}px`,
        bottom: `${pos.y}px`
      });
    });

    // Single mousedown event with all logic contained
    container.addEventListener('mousedown', startEvent => {
      if (startEvent.target.id !== SELECTORS.PROMPT_BUTTON) return;

      // Initial values
      const startX = startEvent.clientX;
      const startY = startEvent.clientY;
      const startRight = parseInt(container.style.right, 10) || 0;
      const startBottom = parseInt(container.style.bottom, 10) || 0;
      container.style.transition = 'none';
      // Define move and end handlers within this scope
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
        // Only save if position changed significantly
        if (Math.abs(newPos.x - pos.x) > 5 || Math.abs(newPos.y - pos.y) > 5) {
          PromptStorageManager.saveButtonPosition(newPos)
            .then(success => {
              if (success) pos = newPos;
            });
        }
      };
      // Add temporary listeners
      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleEnd);
    });
  }

  // Refreshes the prompt list UI
  static refreshPromptList(prompts) { this.buildPromptListContainer(prompts); const input = document.getElementById(SELECTORS.PROMPT_SEARCH_INPUT); if (input) input.style.display = 'block'; }

  // Builds the container for the prompt list
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

  // Resets and rebuilds the prompt list container
  static resetPromptListContainer() {
    const listEl = document.getElementById(SELECTORS.PROMPT_LIST);
    const wasVisible = listEl && listEl.classList.contains('visible');
    PromptUIManager.buildPromptListContainer();
    if (wasVisible) {
      const updated = document.getElementById(SELECTORS.PROMPT_LIST);
      if (updated) { updated.style.display = 'block'; void updated.offsetHeight; updated.classList.add('visible'); }
    }
  }

  // Creates a single prompt item in the list
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

  // Creates the bottom menu with search and action buttons
  static createBottomMenu() {
    const menu = createEl('div', {
      className: `bottom-menu ${getMode()}`,
      styles: { display: 'flex', flexDirection: 'column', gap: '10px', padding: '10px 10px 5px 10px', borderTop: '1px solid var(--light-border)' }
    });

    // Create search input 
    const search = createEl('input', {
      id: SELECTORS.PROMPT_SEARCH_INPUT,
      className: `search-input ${getMode()}`,
      attributes: { type: 'text', placeholder: 'Type to search', style: 'border-radius: 4px;' }
    });

    // Use the unified keyboard handler for search
    search.addEventListener('keydown', e => {
      PromptUIManager.handleKeyboardNavigation(e, 'search');
    });

    // Filter prompts on search input
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

  // Creates the menu bar with action buttons
  static createMenuBar() {
    const bar = createEl('div', { styles: { display: 'flex', alignItems: 'center', gap: '8px' } });
    const btns = ['list', 'add', 'edit', 'import_export', 'help', 'changelog'/*, 'settings'*/];
    const actions = {
      list: e => { e.stopPropagation(); PromptUIManager.refreshAndShowPromptList(); },
      add: e => { e.stopPropagation(); PromptUIManager.showPromptCreationForm(); },
      edit: e => { e.stopPropagation(); PromptUIManager.showEditView(); },
      settings: e => { e.stopPropagation(); PromptUIManager.showSettingsForm(); },
      import_export: e => { e.stopPropagation(); PromptUIManager.showImportExportForm(); },
      help: e => { e.stopPropagation(); PromptUIManager.showHelp(); },
      changelog: e => { e.stopPropagation(); PromptUIManager.showChangelog(); },
    };
    btns.forEach(type => bar.appendChild(PromptUIManager.createIconButton(type, actions[type])));
    return bar;
  }

  // Creates an icon button with specified type and click handler for the menu bar
  static createIconButton(type, onClick) {
    return createEl('button', { className: 'icon-button', eventListeners: { click: onClick }, innerHTML: ICON_SVGS[type] || '' });
  }

  // Shows the prompt list and sets up keyboard navigation
  static showPromptList(listEl) {
    if (!listEl) return;
    showEl(listEl);
    listEl.classList.add('visible');

    // separate event listeners for navigation within the prompt list and container-wide Escape key handling
    document.addEventListener('keydown', PromptUIManager.handleKeyboardNavigation);
    document.addEventListener('keydown', PromptUIManager.handleGlobalEscape);

    const first = listEl.querySelector('.prompt-list-item');
    if (first) setTimeout(() => first.focus(), 50);
    PromptUIManager.focusSearchInput();

    // Mark onboarding as completed when the user opens the prompt list
    PromptStorageManager.setOnboardingCompleted();

    // Remove the onboarding popup if it exists
    const popup = document.getElementById(SELECTORS.ONBOARDING_POPUP);
    if (popup) popup.remove();
  }

  // Hides the prompt list and cleans up
  static hidePromptList(listEl) {
    if (!listEl) return;
    hideEl(listEl);
    const input = document.getElementById(SELECTORS.PROMPT_SEARCH_INPUT);
    if (input) input.value = '';
    document.removeEventListener('keydown', PromptUIManager.handleKeyboardNavigation);
    document.removeEventListener('keydown', PromptUIManager.handleGlobalEscape);
  }

  // Unified keyboard navigation handler
  static handleKeyboardNavigation(e, context = 'list') {
    const list = document.getElementById(SELECTORS.PROMPT_LIST);
    if (!list || !list.classList.contains('visible')) return;

    PromptUIManager.cancelCloseTimer();

    // Escape key is now handled by handleGlobalEscape
    // Get items based on context
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

    // Get current index based on context
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

  // Enhanced method to handle Escape globally with search reset functionality
  static handleGlobalEscape(e) {
    if (e.key === 'Escape') {
      const listEl = document.getElementById(SELECTORS.PROMPT_LIST);
      if (listEl && listEl.classList.contains('visible')) {
        e.preventDefault();
        
        // Reset search selection if needed
        PromptUIManager.selectedSearchIndex = -1;
        const container = document.querySelector(`.${SELECTORS.PROMPT_ITEMS_CONTAINER}`);
        if (container) {
          const items = Array.from(container.querySelectorAll('.prompt-list-item'))
            .filter(item => item.style.display !== 'none' && !item.classList.contains('shortcut-container'));
          PromptUIManager.updateSelection(items, -1);
        }
        
        // Hide the prompt list
        PromptUIManager.hidePromptList(listEl);
      }
    }
  }

  // Updates theme-related UI elements
  static updateThemeForUI() {
    // Update body classes
    document.body.classList.toggle('dark', isDarkMode());
    document.body.classList.toggle('light', !isDarkMode());

    // Update all theme-dependent elements
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

    // Update button shadow
    const container = document.getElementById(SELECTORS.PROMPT_BUTTON_CONTAINER);
    if (container) {
        const btn = container.querySelector(`.${SELECTORS.PROMPT_BUTTON}`);
        if (btn) {
            btn.style.boxShadow = isDarkMode() ? THEME_COLORS.darkShadow : THEME_COLORS.lightShadow;
        }
    }

    // Update icon colors
    const icons = document.querySelectorAll('.icon-button img');
    icons.forEach(icon => {
        icon.style.filter = isDarkMode() 
            ? 'invert(93%) sepia(0%) saturate(0%) hue-rotate(213deg) brightness(107%) contrast(87%)'
            : 'invert(37%) sepia(74%) saturate(380%) hue-rotate(175deg) brightness(93%) contrast(88%)';
    });
  }

  // Refreshes and shows the prompt list
  static refreshAndShowPromptList() {
    (async () => {
      const prompts = await PromptStorageManager.getPrompts();
      PromptUIManager.refreshPromptList(prompts);
      const list = document.getElementById(SELECTORS.PROMPT_LIST);
      if (list) PromptUIManager.showPromptList(list);
    })();
  }

  // Focuses the search input
  static focusSearchInput() {
    const input = document.getElementById(SELECTORS.PROMPT_SEARCH_INPUT);
    if (input) { applyTheme(input); requestAnimationFrame(() => { input.focus(); input.select(); }); }
  }

  // Shows the prompt creation form
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

  // Shows the variable input form for prompts with variables
  static showVariableInputForm(inputBox, content, variables, listEl, onSubmit) {
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
    submitBtn.addEventListener('click', () => { onSubmit(varValues); });
    const backBtn = createEl('button', {
      innerHTML: 'Back', className: `button ${getMode()}`,
      styles: { marginTop: '4px', backgroundColor: dark ? '#4A5568' : '#CBD5E0', color: dark ? THEME_COLORS.inputDarkText : '#333' }
    });
    backBtn.addEventListener('click', () => { PromptUIManager.refreshAndShowPromptList(); });
    btnContainer.append(submitBtn, backBtn);
    form.appendChild(btnContainer);
    listEl.appendChild(form);
    PromptUIManager.showPromptList(listEl);
    const firstInput = varContainer.querySelector('input');
    if (firstInput) firstInput.focus();
  }

  // Creates the prompt creation form
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

  // Shows error dialog for save failures
  static showSaveErrorDialog(msg) { alert(msg); }

  // Creates the import/export form
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

  // Shows the import/export form
  static showImportExportForm() {
    const list = document.getElementById(SELECTORS.PROMPT_LIST);
    if (!list) return;
    PromptUIManager.showPromptList(list);
    PromptUIManager.resetPromptListContainer();
    const form = PromptUIManager.createImportExportForm();
    list.insertBefore(form, list.firstChild);
  }

  // Edit view for prompt list items
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
          padding: '4px 10px',  // Increased horizontal padding while keeping vertical padding
          margin: '6px 0'      // Explicitly set the same margin
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

  // Shows the edit form for a specific prompt
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

  // Deletes a prompt at the specified index
  static async deletePrompt(index) {
    const prompts = await PromptStorageManager.getPrompts();
    prompts.splice(index, 1);
    await PromptStorageManager.setData('prompts', prompts);
    const list = document.getElementById(SELECTORS.PROMPT_LIST);
    if (list) { PromptUIManager.resetPromptListContainer(); PromptUIManager.showEditView(); }
  }

  // Shows the edit view
  static showEditView() {
    const list = document.getElementById(SELECTORS.PROMPT_LIST);
    if (!list) return;
    PromptUIManager.showPromptList(list);
    PromptUIManager.resetPromptListContainer();
    (async () => { const view = await PromptUIManager.createEditView(); list.insertBefore(view, list.firstChild); })();
  }

  // Shows the help view
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
    const toggleRow = createEl('div', { styles: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } });
    const toggleLabel = createEl('label', { innerHTML: 'Example Setting', styles: { fontSize: '14px' } });
    const toggleSwitch = createEl('div', { className: `toggle-switch ${getMode()}`, eventListeners: { click: e => { e.stopPropagation(); toggleSwitch.classList.toggle('active'); } } });
    toggleRow.append(toggleLabel, toggleSwitch);
    settings.appendChild(toggleRow);
    form.append(title, settings);
    return form;
  }

  // Updates the selection in the prompt list during keyboard navigation
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

  // Class property to store the selected search index
  static selectedSearchIndex = -1;
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

/* Prompt Mediator - Coordinates interactions between UI, storage, and prompt processing
 * Handles:
 * - Event binding for prompt selection and variable replacement
 * - Initialization of UI components and observers
 * - Keyboard shortcut handling
 * - Storage change monitoring
 */
class PromptMediator {
  constructor(ui, processor) {
    this.ui = ui;
    this.processor = processor;
    this.eventBus = new EventBus(); // Move EventBus instance here
    this.bindEvents();
    this.initialize();
  }

  // Bind event handlers for prompt selection and variable processing
  bindEvents() {
    // Use the existing static event bus from PromptUIManager
    PromptUIManager.onPromptSelect(async prompt => {
      const inputBox = InputBoxHandler.getInputBox();
      if (!inputBox) { console.error('Input box not found.'); return; }

      // Extract variables from prompt content
      const vars = this.processor.extractVariables(prompt.content);
      const listEl = document.getElementById(SELECTORS.PROMPT_LIST);

      // Handle prompts with and without variables differently
      if (vars.length === 0) {
        // For prompts without variables, insert directly
        await InputBoxHandler.insertPrompt(inputBox, prompt.content, listEl);
        PromptUIManager.hidePromptList(listEl);
      } else {
        // For prompts with variables, show input form and process values
        PromptUIManager.showVariableInputForm(inputBox, prompt.content, vars, listEl, async values => {
          const processed = this.processor.replaceVariables(prompt.content, values);
          await InputBoxHandler.insertPrompt(inputBox, processed, listEl);
          PromptUIManager.hidePromptList(listEl);
          // Refresh prompt list after short delay
          setTimeout(() => { PromptStorageManager.getPrompts().then(prompts => { PromptUIManager.refreshPromptList(prompts); }); }, 300);
        });
      }
    });
    
  }

  // Initialize extension components and set up observers
  async initialize() {
    try {
      // Wait for input box to be available before proceeding
      await InputBoxHandler.waitForInputBox();
      const prompts = await PromptStorageManager.getPrompts();
      PromptUIManager.injectPromptManagerButton(prompts);

      this.setupMutationObserver();
      this.setupStorageChangeMonitor();
      this.setupKeyboardShortcuts();
    } catch (err) { console.error('Error initializing extension:', err); }
  }
  
  //  mutation observer
  setupMutationObserver() {
    let observerTimeout = null;
    const target = document.querySelector('main') || document.body;
    const observer = new MutationObserver(async () => {
      if (document.getElementById(SELECTORS.PROMPT_BUTTON_CONTAINER)) return;
      if (observerTimeout) clearTimeout(observerTimeout);
      observerTimeout = setTimeout(async () => {
        const inputBox = InputBoxHandler.getInputBox();
        if (inputBox && !document.getElementById(SELECTORS.PROMPT_BUTTON_CONTAINER)) {
          const updated = await PromptStorageManager.getPrompts();
          PromptUIManager.injectPromptManagerButton(updated);
        }
      }, 300);
    });
    observer.observe(target, { childList: true, subtree: true });
  }
  
  //  storage change monitor   
  setupStorageChangeMonitor() {
    PromptStorageManager.onChange(async (changes, area) => {
      if (area === 'local' && changes.prompts) {
        PromptUIManager.refreshPromptList(changes.prompts.newValue);
      }
    });
  }
  
  // keyboard shortcut handler 
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
