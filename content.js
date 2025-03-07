/* ============================================================================
   Global Constants and Helper Functions
   ============================================================================ */

/**
 * Theme colors for the extension.
 */
const THEME_COLORS = {
  primary: '#3674B5',
  primaryGradientStart: '#3674B5',
  primaryGradientEnd: '#578FCA',
  hoverPrimary: '#4C51BF',
  darkBackground: '#1A202C',
  lightBackground: '#F7FAFC',
  darkBorder: '#2D3748',
  lightBorder: '#E2E8F0',
  darkShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
  lightShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
  inputDarkBorder: '1px solid #4A5568',
  inputLightBorder: '1px solid #CBD5E0',
  inputDarkBg: '#2D3748',
  inputLightBg: '#FFFFFF',
  inputDarkText: '#E2E8F0',
  inputLightText: '#2D3748',
  buttonHoverDark: '#434C5E',
  buttonHoverLight: '#3C4A59'
};

/**
 * Styles used for various elements in the extension.
 */
const UI_STYLES = {
  getPromptButtonContainerStyle: (position) => ({
    position: 'fixed',
    zIndex: '9999',
    bottom: `${position.y}px`,
    right: `${position.x}px`,
    width: '40px',
    height: '40px',
    userSelect: 'none',
    cursor: 'move'
  }),
  promptButtonStyle: {
    width: '100%',
    height: '100%',
    backgroundColor: THEME_COLORS.primary,
  }
};

/**
 * Time (in milliseconds) before automatically closing the prompt list.
 */
const PROMPT_CLOSE_DELAY = 5000;

/**
 * Selectors for key elements.
 */
const SELECTORS = {
  PROMPT_BUTTON_CONTAINER: 'prompt-button-container',
  PROMPT_BUTTON: 'prompt-button',
  PROMPT_LIST: 'prompt-list',
  PROMPT_SEARCH_INPUT: 'prompt-search-input',
  PROMPT_ITEMS_CONTAINER: 'prompt-items-container'
};

/**
 * Creates an element with optional properties, styles, attributes, inner HTML, and event listeners.
 * @param {string} tag - The HTML tag to create.
 * @param {object} options - Options for the element.
 * @returns {HTMLElement} The newly created element.
 */
function createElementWithOptions(tag, { id, className, styles, attributes, innerHTML, eventListeners } = {}) {
  const el = document.createElement(tag);
  if (id) el.id = id;
  if (className) el.className = className;
  if (styles) Object.assign(el.style, styles);
  if (attributes) {
    for (const key in attributes) {
      el.setAttribute(key, attributes[key]);
    }
  }
  if (innerHTML) el.innerHTML = innerHTML;
  if (eventListeners) {
    for (const event in eventListeners) {
      el.addEventListener(event, eventListeners[event]);
    }
  }
  return el;
}

/* ============================================================================
   Utility Functions for DOM Updates and Theme Handling
   ============================================================================ */

/**
 * Applies the current theme (dark/light) to an element by updating its class.
 * @param {HTMLElement} el 
 */
function applyTheme(el) {
  el.classList.remove('light', 'dark');
  el.classList.add(isDarkMode() ? 'dark' : 'light');
}

/**
 * Updates the theme for the entire document by toggling a global class on the body.
 * Should be called whenever the system color scheme changes.
 */
function updateAllThemeElements() {
  document.body.classList.toggle('dark', isDarkMode());
  document.body.classList.toggle('light', !isDarkMode());
}

/**
 * Shows an element with a transition.
 * @param {HTMLElement} el 
 */
function showElement(el) {
  el.style.display = 'block';
  // Force reflow to enable transition
  void el.offsetHeight;
  el.classList.add('visible');
}

/**
 * Hides an element with a transition.
 * @param {HTMLElement} el 
 */
function hideElement(el) {
  el.classList.remove('visible');
  setTimeout(() => {
    el.style.display = 'none';
    // Reset any inline styles on child prompt items if needed
    const itemsContainer = el.querySelector(`.${SELECTORS.PROMPT_ITEMS_CONTAINER}`);
    if (itemsContainer) {
      Array.from(itemsContainer.children).forEach(item => {
        item.style.display = 'flex';
      });
    }
  }, 300);
}

/* ============================================================================
   Inject Global Styles
   ============================================================================ */

function injectGlobalStyles() {
  const styleEl = createElementWithOptions('style');
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
      padding: 8px 10px;
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
  `;
  document.head.appendChild(styleEl);
}
injectGlobalStyles();

/* ============================================================================
   Dark Mode Handling
   ============================================================================ */

/**
 * Flag indicating if dark mode is active.
 */
let isDarkModeActive = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

// Listen for changes in the system color scheme.
if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    isDarkModeActive = e.matches;
    updateAllThemeElements();
    PromptUIManager.updateThemeForUI();
  });
}

/**
 * Returns whether dark mode is currently active.
 * @returns {boolean}
 */
function isDarkMode() {
  return isDarkModeActive;
}

/* ============================================================================
   Simple Event Bus
   ============================================================================ */

/**
 * A simple event bus for broadcasting and listening to events.
 */
class EventBus {
  constructor() {
    this.events = {};
  }
  on(event, listener) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
  }
  emit(event, ...args) {
    if (this.events[event]) {
      this.events[event].forEach(listener => listener(...args));
    }
  }
}

/* ============================================================================
   Storage Manager (Handles Data Persistence)
   ============================================================================ */

/**
 * Manages storage operations for prompts and UI configurations.
 */
class PromptStorageManager {
  static getData(key, defaultValue) {
    return new Promise(resolve => {
      try {
        chrome.storage.local.get(key, data => {
          if (chrome.runtime.lastError) {
            console.warn(`Storage get error: ${chrome.runtime.lastError.message}`);
            resolve(defaultValue);
            return;
          }
          const value = data[key];
          resolve(value !== undefined && value !== null ? value : defaultValue);
        });
      } catch (error) {
        console.error(`Error getting data for key ${key}:`, error);
        resolve(defaultValue);
      }
    });
  }

  static setData(key, value) {
    return new Promise(resolve => {
      try {
        // Check if extension context is still valid before proceeding
        if (!chrome.runtime || !chrome.storage) {
          console.warn('Extension context appears to be invalid');
          resolve(false);
          return;
        }
        
        chrome.storage.local.set({ [key]: value }, () => {
          if (chrome.runtime.lastError) {
            console.warn(`Storage set error: ${chrome.runtime.lastError.message}`);
            resolve(false);
            return;
          }
          resolve(true);
        });
      } catch (error) {
        console.error(`Error setting data for key ${key}:`, error);
        resolve(false);
      }
    });
  }

  static async getPrompts() {
    const prompts = await PromptStorageManager.getData('prompts', []);
    return Array.isArray(prompts) ? prompts : [];
  }

  static async savePrompt(prompt) {
    try {
      // Assign a uuid if the prompt doesn't have one
      if (!prompt.uuid) {
        prompt.uuid = crypto.randomUUID();
      }
      const prompts = await PromptStorageManager.getPrompts();
      const allPrompts = [...prompts, prompt];
      await PromptStorageManager.setData('prompts', allPrompts);
      console.log('Prompt saved successfully.');
      return { success: true };
    } catch (error) {
      console.error('Error saving prompt:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Merges imported prompts with the existing ones based on uuid.
   * - If an imported prompt lacks a uuid, it is assigned one.
   * - If an imported prompt's uuid matches an existing prompt, the existing prompt is updated.
   * - Otherwise, the imported prompt is appended.
   * @param {Array} importedPrompts 
   * @returns {Array} The merged prompts array.
   */
  static async mergeImportedPrompts(importedPrompts) {
    let existingPrompts = await PromptStorageManager.getPrompts();
    // Create a lookup of existing prompts by uuid
    const existingByUuid = {};
    existingPrompts.forEach(prompt => {
      if (prompt.uuid) {
        existingByUuid[prompt.uuid] = prompt;
      }
    });
    
    importedPrompts.forEach(imported => {
      // Handle old format with 'id' instead of 'uuid'
      if (imported.id && !imported.uuid) {
        imported.uuid = imported.id;
        delete imported.id;
      }
      
      // Remove createdAt if present (from old format)
      if (imported.createdAt) {
        delete imported.createdAt;
      }
      
      // Assign uuid if missing
      if (!imported.uuid) {
        imported.uuid = crypto.randomUUID();
      }
      
      if (existingByUuid[imported.uuid]) {
        // Update the existing prompt with the imported one
        const index = existingPrompts.findIndex(p => p.uuid === imported.uuid);
        if (index !== -1) {
          existingPrompts[index] = imported;
        }
      } else {
        // Append new prompt
        existingPrompts.push(imported);
      }
    });
    
    // Ensure all prompts have a uuid
    existingPrompts = existingPrompts.map(prompt => {
      if (!prompt.uuid) {
        prompt.uuid = crypto.randomUUID();
      }
      return prompt;
    });
    
    await PromptStorageManager.setData('prompts', existingPrompts);
    return existingPrompts;
  }

  static onChange(callback) {
    chrome.storage.onChanged.addListener(callback);
  }

  static async getButtonPosition() {
    return await PromptStorageManager.getData('buttonPosition', { x: 75, y: 100 });
  }

  static async saveButtonPosition(position) {
    try {
      // Only try to save if the position actually changed
      const currentPosition = await PromptStorageManager.getButtonPosition();
      if (currentPosition.x === position.x && currentPosition.y === position.y) {
        return true; // No change, no need to save
      }
      
      return await PromptStorageManager.setData('buttonPosition', position);
    } catch (error) {
      console.warn('Failed to save button position:', error);
      return false;
    }
  }

  static async getKeyboardShortcut() {
    const isMac = navigator.platform.toUpperCase().includes('MAC');
    return await PromptStorageManager.getData('keyboardShortcut', { 
      key: isMac ? 'p' : 'm',
      modifier: isMac ? 'metaKey' : 'ctrlKey',
      requiresShift: isMac 
    });
  }

  static async saveKeyboardShortcut(shortcut) {
    return await PromptStorageManager.setData('keyboardShortcut', shortcut);
  }
}

/* ============================================================================
   UI Manager (Handles User Interface)
   ============================================================================ */

/**
 * Manages the user interface for the prompt manager.
 */
class PromptUIManager {
  // Event bus for broadcasting UI events.
  static eventBus = new EventBus();

  static onPromptSelect(callback) {
    PromptUIManager.eventBus.on('promptSelect', callback);
  }

  static emitPromptSelect(prompt) {
    PromptUIManager.eventBus.emit('promptSelect', prompt);
  }

  static injectPromptManagerButton(prompts) {
    if (document.getElementById(SELECTORS.PROMPT_BUTTON_CONTAINER)) {
      console.log('Button container already exists.');
      return;
    }
    PromptStorageManager.getButtonPosition().then(position => {
      const container = createElementWithOptions('div', {
        id: SELECTORS.PROMPT_BUTTON_CONTAINER,
        styles: UI_STYLES.getPromptButtonContainerStyle(position)
      });
      // Create prompt button without inline event listeners; they will be attached in attachButtonEvents.
      const button = createElementWithOptions('button', {
        id: SELECTORS.PROMPT_BUTTON,
        className: 'prompt-button'
      });
      container.appendChild(button);
      const promptListEl = createElementWithOptions('div', {
        id: SELECTORS.PROMPT_LIST,
        className: `prompt-list ${isDarkMode() ? 'dark' : 'light'}`
      });
      container.appendChild(promptListEl);
      document.body.appendChild(container);
      if (prompts.length === 0) {
        PromptUIManager.showPromptCreationForm();
      } else {
        PromptUIManager.refreshPromptList(prompts);
      }
      PromptUIManager.attachButtonEvents(button, promptListEl, container);
      PromptUIManager.makeDraggable(container);
    });
  }

  static attachButtonEvents(button, promptListEl, container) {
    let isOpen = false;
    // Consolidated event listeners for the button
    button.addEventListener('click', e => {
      e.stopPropagation();
      isOpen ? PromptUIManager.hidePromptList(promptListEl) : PromptUIManager.showPromptList(promptListEl);
      isOpen = !isOpen;
    });
    button.addEventListener('mouseenter', e => {
      e.stopPropagation();
      PromptUIManager.cancelCloseTimer();
      PromptUIManager.showPromptList(promptListEl);
      isOpen = true;
    });
    button.addEventListener('mouseleave', e => {
      e.stopPropagation();
      PromptUIManager.startCloseTimer(e, promptListEl, button, () => { isOpen = false; });
    });
    promptListEl.addEventListener('mouseenter', () => {
      PromptUIManager.cancelCloseTimer();
    });
    promptListEl.addEventListener('mouseleave', e => {
      PromptUIManager.startCloseTimer(e, promptListEl, button, () => { isOpen = false; });
    });
    document.addEventListener('click', e => {
      const isMenuAction = e.target.closest(`#${SELECTORS.PROMPT_LIST}`) || 
                           e.target.closest(`.${SELECTORS.PROMPT_ITEMS_CONTAINER}`) ||
                           e.target.closest('.icon-button') ||
                           e.target.closest('.form-container') ||
                           e.target.closest('.button') ||
                           button.contains(e.target);
      if (isOpen && !isMenuAction) {
        PromptUIManager.hidePromptList(promptListEl);
        isOpen = false;
      }
    });
  }

  static startCloseTimer(e, promptListEl, button, callback) {
    if (PromptUIManager.closeTimer) {
      clearTimeout(PromptUIManager.closeTimer);
    }
    PromptUIManager.closeTimer = setTimeout(() => {
      PromptUIManager.hidePromptList(promptListEl);
      if (callback) callback();
      PromptUIManager.closeTimer = null;
    }, PROMPT_CLOSE_DELAY);
  }

  static cancelCloseTimer() {
    if (PromptUIManager.closeTimer) {
      clearTimeout(PromptUIManager.closeTimer);
      PromptUIManager.closeTimer = null;
    }
  }

  static makeDraggable(container) {
    let isDragging = false, initialX, initialY, startRight, startBottom;
    let lastSavedPosition = { x: 0, y: 0 };
    
    // Try to get initial position from storage
    PromptStorageManager.getButtonPosition().then(position => {
      lastSavedPosition = { ...position };
    });
    
    container.addEventListener('mousedown', e => {
      if (e.target.id === SELECTORS.PROMPT_BUTTON) {
        isDragging = true;
        initialX = e.clientX;
        initialY = e.clientY;
        startRight = parseInt(container.style.right, 10);
        startBottom = parseInt(container.style.bottom, 10);
        container.style.transition = 'none';
      }
    });
    
    document.addEventListener('mousemove', e => {
      if (isDragging) {
        const deltaX = initialX - e.clientX;
        const deltaY = initialY - e.clientY;
        let newX = startRight + deltaX;
        let newY = startBottom + deltaY;
        newX = Math.min(Math.max(newX, 0), window.innerWidth - container.offsetWidth);
        newY = Math.min(Math.max(newY, 0), window.innerHeight - container.offsetHeight);
        container.style.right = `${newX}px`;
        container.style.bottom = `${newY}px`;
      }
    });
    
    document.addEventListener('mouseup', async () => {
      if (isDragging) {
        isDragging = false;
        container.style.transition = 'all 0.3s ease';
        
        // Get the new position
        const newPosition = {
          x: parseInt(container.style.right, 10),
          y: parseInt(container.style.bottom, 10)
        };
        
        // Only save if position has changed significantly
        if (Math.abs(newPosition.x - lastSavedPosition.x) > 5 || 
            Math.abs(newPosition.y - lastSavedPosition.y) > 5) {
          const success = await PromptStorageManager.saveButtonPosition(newPosition);
          if (success) {
            lastSavedPosition = { ...newPosition };
          } else {
            // Position failed to save, consider reverting UI
            console.warn('Position save failed, but keeping UI in new position');
          }
        }
      }
    });
  }

  static refreshPromptList(prompts) {
    PromptUIManager.buildPromptListContainer(prompts);
    const searchInput = document.getElementById(SELECTORS.PROMPT_SEARCH_INPUT);
    if (searchInput) {
      searchInput.style.display = 'block';
    }
  }

  static buildPromptListContainer(prompts = null) {
    const promptListEl = document.getElementById(SELECTORS.PROMPT_LIST);
    if (!promptListEl) {
      console.error('Prompt list not found.');
      return;
    }
    applyTheme(promptListEl);
    promptListEl.innerHTML = '';
    const promptsContainer = createElementWithOptions('div', {
      className: `${SELECTORS.PROMPT_ITEMS_CONTAINER} prompt-list-items ${isDarkMode() ? 'dark' : 'light'}`
    });
    if (Array.isArray(prompts)) {
      prompts.forEach(prompt => {
        const promptItem = PromptUIManager.createPromptItem(prompt);
        promptsContainer.appendChild(promptItem);
      });
    }
    promptListEl.appendChild(promptsContainer);
    promptListEl.appendChild(PromptUIManager.createBottomMenu());
  }

  static resetPromptListContainer() {
    const promptListEl = document.getElementById(SELECTORS.PROMPT_LIST);
    const wasVisible = promptListEl && promptListEl.classList.contains('visible');
    PromptUIManager.buildPromptListContainer();
    if (wasVisible) {
      const updatedPromptListEl = document.getElementById(SELECTORS.PROMPT_LIST);
      if (updatedPromptListEl) {
        updatedPromptListEl.style.display = 'block';
        void updatedPromptListEl.offsetHeight;
        updatedPromptListEl.classList.add('visible');
      }
    }
  }

  static createPromptItem(prompt) {
    const item = createElementWithOptions('div', {
      className: `prompt-list-item ${isDarkMode() ? 'dark' : 'light'}`,
      eventListeners: {
        click: () => {
          PromptUIManager.emitPromptSelect(prompt);
        },
        mouseenter: (e) => {
          const allItems = document.querySelectorAll('.prompt-list-item');
          allItems.forEach(item => item.classList.remove('keyboard-selected'));
          PromptUIManager.cancelCloseTimer();
        }
      }
    });
    const textContainer = createElementWithOptions('div', { styles: { flex: '1' } });
    textContainer.textContent = prompt.title;
    item.appendChild(textContainer);
    item.dataset.title = prompt.title.toLowerCase();
    item.dataset.content = prompt.content.toLowerCase();
    return item;
  }

  static createBottomMenu() {
    const bottomMenu = createElementWithOptions('div', { 
      className: `bottom-menu ${isDarkMode() ? 'dark' : 'light'}`,
      styles: { display: 'flex', flexDirection: 'column', gap: '10px', padding: '10px', borderTop: '1px solid var(--light-border)' }
    });
    const searchInput = createElementWithOptions('input', {
      id: SELECTORS.PROMPT_SEARCH_INPUT,
      className: `search-input ${isDarkMode() ? 'dark' : 'light'}`,
      attributes: { type: 'text', placeholder: 'Type to search' }
    });
    let selectedIndex = -1;
    searchInput.addEventListener('keydown', (e) => {
      const promptsContainer = document.querySelector(`.${SELECTORS.PROMPT_ITEMS_CONTAINER}`);
      if (!promptsContainer) return;
      const visiblePrompts = Array.from(promptsContainer.querySelectorAll('.prompt-list-item'))
        .filter(item => item.style.display !== 'none' && !item.classList.contains('shortcut-container'));
      switch(e.key) {
        case 'ArrowDown':
          e.preventDefault();
          selectedIndex = Math.min(selectedIndex + 1, visiblePrompts.length - 1);
          if (selectedIndex === -1 && visiblePrompts.length > 0) selectedIndex = 0;
          PromptUIManager.updateSelection(visiblePrompts, selectedIndex);
          break;
        case 'ArrowUp':
          e.preventDefault();
          selectedIndex = Math.max(selectedIndex - 1, -1);
          PromptUIManager.updateSelection(visiblePrompts, selectedIndex);
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < visiblePrompts.length) {
            visiblePrompts[selectedIndex].click();
          } else if (visiblePrompts.length === 1) {
            visiblePrompts[0].click();
          }
          break;
        case 'Escape':
          e.preventDefault();
          selectedIndex = -1;
          PromptUIManager.updateSelection(visiblePrompts, selectedIndex);
          PromptUIManager.hidePromptList(document.getElementById(SELECTORS.PROMPT_LIST));
          break;
      }
    });
    searchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase();
      const promptsContainer = document.querySelector(`.${SELECTORS.PROMPT_ITEMS_CONTAINER}`);
      if (!promptsContainer) return;
      const promptItems = promptsContainer.children;
      selectedIndex = -1;
      Array.from(promptItems).forEach(item => {
        const shouldShow = item.dataset.title.includes(searchTerm) || item.dataset.content.includes(searchTerm);
        item.style.display = shouldShow ? 'flex' : 'none';
      });
    });
    const menuBar = PromptUIManager.createMenuBar();
    bottomMenu.appendChild(searchInput);
    bottomMenu.appendChild(menuBar);
    return bottomMenu;
  }

  static createMenuBar() {
    const menuBar = createElementWithOptions('div', { styles: { display: 'flex', alignItems: 'center', gap: '8px' } });
    const listButton = PromptUIManager.createIconButton('list', (e) => {
      e.stopPropagation();
      PromptUIManager.refreshAndShowPromptList();
    });
    const newPromptButton = PromptUIManager.createIconButton('message', (e) => {
      e.stopPropagation();
      PromptUIManager.showPromptCreationForm();
    });
    const editButton = PromptUIManager.createIconButton('edit', (e) => {
      e.stopPropagation();
      PromptUIManager.showEditView();
    });
    const settingsButton = PromptUIManager.createIconButton('settings', e => {
      e.stopPropagation();
      PromptUIManager.showImportExportForm();
    });
    const helpButton = PromptUIManager.createIconButton('help', e => {
      e.stopPropagation();
      PromptUIManager.showHelp();
    });
    const changelogButton = PromptUIManager.createIconButton('changelog', e => {
      e.stopPropagation();
      PromptUIManager.showChangelog();
    });
    menuBar.append(listButton, newPromptButton, editButton, settingsButton, helpButton, changelogButton);
    return menuBar;
  }

  static createIconButton(type, onClick) {
    let svgContent = '';
    switch (type) {
      case 'list':
        svgContent = `<svg width="14" height="14" viewBox="0 0 20 20" fill="${isDarkMode() ? '#e1e1e1' : '#666'}">
                        <path d="M4 4h2v2H4V4zm0 5h2v2H4V9zm0 5h2v2H4v-2zm4-10h12v2H8V4zm0 5h12v2H8V9zm0 5h12v2H8v-2z"/>
                      </svg>`;
        break;
      case 'message':
        svgContent = `<svg width="14" height="14" viewBox="0 0 20 20" fill="${isDarkMode() ? '#e1e1e1' : '#666'}">
                        <path d="M2 5.5C2 4.11929 3.11929 3 4.5 3H15.5C16.8807 3 18 4.11929 18 5.5V12.5C18 13.8807 16.8807 15 15.5 15H11.5L8 18.5L4.5 15H4.5C3.11929 15 2 13.8807 2 12.5V5.5Z"/>
                      </svg>`;
        break;
      case 'delete':
        svgContent = `<svg width="14" height="14" viewBox="0 0 20 20" fill="${isDarkMode() ? '#e1e1e1' : '#666'}">
                        <path d="M6 2h8v2h4v2H2V4h4V2zm1 0h6v2H7V2zm-3 4h12l-1 12H5L4 6z"/>
                      </svg>`;
        break;
      case 'edit':
        svgContent = `<svg width="14" height="14" viewBox="0 0 20 20" fill="${isDarkMode() ? '#e1e1e1' : '#666'}">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-8.793 8.793-3.536.707.707-3.536 8.794-8.792z"/>
                      </svg>`;
        break;
      case 'settings':
        svgContent = `<svg width="14" height="14" viewBox="0 0 24 24" fill="${isDarkMode() ? '#e1e1e1' : '#666'}">
                        <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/>
                      </svg>`;
        break;
      case 'help':
        svgContent = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${isDarkMode() ? '#e1e1e1' : '#666'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="16" x2="12" y2="12"></line>
                        <line x1="12" y1="8" x2="12" y2="8"></line>
                      </svg>`;
        break;
      case 'changelog':
        svgContent = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${isDarkMode() ? '#e1e1e1' : '#666'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                      </svg>`;
        break;
    }
    const btn = createElementWithOptions('button', {
      className: 'icon-button',
      eventListeners: {
        click: onClick
      },
      innerHTML: svgContent
    });
    return btn;
  }

  static showPromptList(promptListEl) {
    if (!promptListEl) return;
    showElement(promptListEl);
    document.addEventListener('keydown', PromptUIManager.handleKeyNavigation);
    const firstItem = promptListEl.querySelector('.prompt-list-item');
    if (firstItem) setTimeout(() => firstItem.focus(), 50);
    PromptUIManager.focusSearchInput();
  }

  static hidePromptList(promptListEl) {
    if (!promptListEl) return;
    hideElement(promptListEl);
    const searchInput = document.getElementById(SELECTORS.PROMPT_SEARCH_INPUT);
    if (searchInput) searchInput.value = '';
    document.removeEventListener('keydown', PromptUIManager.handleKeyNavigation);
  }

  static handleKeyNavigation(e) {
    const promptList = document.getElementById(SELECTORS.PROMPT_LIST);
    if (!promptList || !promptList.classList.contains('visible')) return;

    PromptUIManager.cancelCloseTimer();
    
    const items = Array.from(promptList.querySelectorAll('.prompt-list-item'));
    if (items.length === 0) return;
    let currentIndex = items.indexOf(document.activeElement);
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (currentIndex === -1 || currentIndex === items.length - 1) {
          items[0].focus();
        } else {
          items[currentIndex + 1].focus();
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (currentIndex === -1 || currentIndex === 0) {
          items[items.length - 1].focus();
        } else {
          items[currentIndex - 1].focus();
        }
        break;
      case 'Enter':
        e.preventDefault();
        if (currentIndex !== -1) {
          items[currentIndex].click();
        }
        break;
      case 'Escape':
        e.preventDefault();
        PromptUIManager.hidePromptList(promptList);
        break;
      default:
        return;
    }
  }

  static updateThemeForUI() {
    // Simplified global theme update by toggling classes on body
    document.body.classList.toggle('dark', isDarkMode());
    document.body.classList.toggle('light', !isDarkMode());
    
    // Update button container styling if necessary
    const buttonContainer = document.getElementById(SELECTORS.PROMPT_BUTTON_CONTAINER);
    if (buttonContainer) {
      const promptButton = buttonContainer.querySelector(`.${SELECTORS.PROMPT_BUTTON}`);
      if (promptButton) {
        promptButton.style.boxShadow = isDarkMode() ? THEME_COLORS.darkShadow : THEME_COLORS.lightShadow;
      }
    }
  }

  static refreshAndShowPromptList() {
    (async () => {
      const prompts = await PromptStorageManager.getPrompts();
      PromptUIManager.refreshPromptList(prompts);
      const promptListEl = document.getElementById(SELECTORS.PROMPT_LIST);
      if (promptListEl) PromptUIManager.showPromptList(promptListEl);
    })();
  }

  static focusSearchInput() {
    const searchInput = document.getElementById(SELECTORS.PROMPT_SEARCH_INPUT);
    if (searchInput) {
      applyTheme(searchInput);
      window.requestAnimationFrame(() => {
        searchInput.focus();
        searchInput.select();
      });
    }
  }

  static showPromptCreationForm() {
    const promptListEl = document.getElementById(SELECTORS.PROMPT_LIST);
    if (!promptListEl) return;
    PromptUIManager.showPromptList(promptListEl);
    PromptUIManager.resetPromptListContainer();
    const searchInput = promptListEl.querySelector(`#${SELECTORS.PROMPT_SEARCH_INPUT}`);
    if (searchInput) searchInput.style.display = 'none';
    PromptStorageManager.getPrompts().then(prompts => {
      const creationForm = PromptUIManager.createPromptCreationForm('', prompts.length === 0);
      promptListEl.insertBefore(creationForm, promptListEl.firstChild);
      const titleInput = creationForm.querySelector('input');
      if (titleInput) titleInput.focus();
    });
  }

  static showVariableInputForm(inputBox, promptContent, variables, promptListEl, onSubmit) {
    promptListEl.innerHTML = '';
    const darkMode = isDarkMode();
    const formContainer = createElementWithOptions('div', {
      className: `form-container ${darkMode ? 'dark' : 'light'}`,
      styles: { padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }
    });
    const variablesContainer = createElementWithOptions('div', {
      styles: { display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '300px', overflowY: 'auto' }
    });
    const variableValues = {};
    variables.forEach(variable => {
      const row = createElementWithOptions('div', { styles: { display: 'flex', flexDirection: 'column', gap: '4px' } });
      const label = createElementWithOptions('label', {
        innerHTML: variable,
        styles: { fontSize: '12px', fontWeight: 'bold', color: darkMode ? THEME_COLORS.inputDarkText : '#333' }
      });
      const inputField = createElementWithOptions('input', {
        attributes: { type: 'text', placeholder: `${variable} value` },
        className: `input-field ${darkMode ? 'dark' : 'light'}`
      });
      inputField.addEventListener('input', () => {
        variableValues[variable] = inputField.value;
      });
      inputField.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { submitButton.click(); }
      });
      row.append(label, inputField);
      variablesContainer.appendChild(row);
      variableValues[variable] = '';
    });
    formContainer.appendChild(variablesContainer);
    const buttonsContainer = createElementWithOptions('div', { styles: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' } });
    const submitButton = createElementWithOptions('button', {
      innerHTML: 'Submit',
      className: `button ${isDarkMode() ? 'dark' : 'light'}`
    });
    submitButton.addEventListener('click', () => {
      onSubmit(variableValues);
    });
    const backButton = createElementWithOptions('button', {
      innerHTML: 'Back',
      className: `button ${isDarkMode() ? 'dark' : 'light'}`,
      styles: { marginTop: '4px', backgroundColor: isDarkMode() ? '#4A5568' : '#CBD5E0', color: isDarkMode() ? THEME_COLORS.inputDarkText : '#333' }
    });
    backButton.addEventListener('click', () => {
      PromptUIManager.refreshAndShowPromptList();
    });
    buttonsContainer.append(submitButton, backButton);
    formContainer.appendChild(buttonsContainer);
    promptListEl.appendChild(formContainer);
    PromptUIManager.showPromptList(promptListEl);
    const firstInput = variablesContainer.querySelector('input');
    if (firstInput) { firstInput.focus(); }
  }

  static createPromptCreationForm(prefillContent = '', showMissingNote = false) {
    const searchInput = document.getElementById(SELECTORS.PROMPT_SEARCH_INPUT);
    if (searchInput) searchInput.style.display = 'none';
    const formContainer = createElementWithOptions('div', {
      className: `form-container ${isDarkMode() ? 'dark' : 'light'}`,
      styles: { padding: '0px', display: 'flex', flexDirection: 'column', gap: '8px' }
    });
    const titleInput = createElementWithOptions('input', {
      attributes: { placeholder: 'Prompt Title' },
      className: `input-field ${isDarkMode() ? 'dark' : 'light'}`
    });
    const contentTextarea = createElementWithOptions('textarea', {
      attributes: { placeholder: 'Enter your prompt here. Add variables with #examplevariable#' },
      className: `textarea-field ${isDarkMode() ? 'dark' : 'light'}`,
      styles: { minHeight: '220px' }
    });
    contentTextarea.value = prefillContent;
    const saveButton = createElementWithOptions('button', {
      innerHTML: 'Create Prompt',
      className: `button ${isDarkMode() ? 'dark' : 'light'}`
    });
    saveButton.addEventListener('click', async (e) => {
      e.stopPropagation();
      const titleVal = titleInput.value.trim();
      const contentVal = contentTextarea.value.trim();
      if (!titleVal || !contentVal) {
        alert('Please fill in both title and content.');
        return;
      }
      const result = await PromptStorageManager.savePrompt({ title: titleVal, content: contentVal });
      if (!result.success) {
        PromptUIManager.showSaveErrorDialog(result.error);
        return;
      }
      PromptStorageManager.getPrompts().then(prompts => {
        PromptUIManager.refreshAndShowPromptList();
      });
    });
    formContainer.append(titleInput, contentTextarea, saveButton);
    if (showMissingNote) {
      const missingText = createElementWithOptions('div', {
        styles: { marginTop: '8px', fontSize: '12px', color: isDarkMode() ? THEME_COLORS.inputDarkText : '#333' },
        innerHTML: '<strong>Prompts missing?</strong><br>Fix available: click the extension icon in the menu bar for instructions'
      });
      formContainer.appendChild(missingText);
    }
    formContainer.addEventListener('click', e => e.stopPropagation());
    return formContainer;
  }

  static showSaveErrorDialog(errorMsg) {
    alert(errorMsg);
  }

  static createImportExportForm() {
    const darkMode = isDarkMode();
    const searchInput = document.getElementById(SELECTORS.PROMPT_SEARCH_INPUT);
    if (searchInput) searchInput.style.display = 'none';
    const formContainer = createElementWithOptions('div', {
      className: `form-container ${darkMode ? 'dark' : 'light'}`,
      styles: { padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }
    });
    const exportButton = createElementWithOptions('button', {
      innerHTML: 'Export Prompts',
      className: `button ${darkMode ? 'dark' : 'light'}`
    });
    exportButton.addEventListener('click', async (e) => {
      e.stopPropagation();
      const prompts = await PromptStorageManager.getPrompts();
      const json = JSON.stringify(prompts, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = createElementWithOptions('a', { attributes: { href: url, download: `prompts-${new Date().toISOString().split('T')[0]}.json` } });
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
    const importButton = createElementWithOptions('button', {
      innerHTML: 'Import Prompts',
      className: `button ${darkMode ? 'dark' : 'light'}`,
      styles: { marginTop: '8px' }
    });
    importButton.addEventListener('click', async (e) => {
      e.stopPropagation();
      const fileInput = createElementWithOptions('input', { attributes: { type: 'file', accept: '.json' } });
      fileInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (file) {
          try {
            const text = await file.text();
            const importedPrompts = JSON.parse(text);
            if (!Array.isArray(importedPrompts)) throw new Error('Invalid format');
            // Merge imported prompts with the existing ones using uuid logic
            const mergedPrompts = await PromptStorageManager.mergeImportedPrompts(importedPrompts);
            PromptUIManager.refreshPromptList(mergedPrompts);
            importButton.textContent = 'Import successful!';
            setTimeout(() => importButton.textContent = 'Import Prompts', 2000);
          } catch (error) {
            alert('Invalid JSON file format. Please check your file.');
          }
        }
      });
      fileInput.click();
    });
    formContainer.append(exportButton, importButton);
    return formContainer;
  }

  static async createEditView() {
    const darkMode = isDarkMode();
    const prompts = await PromptStorageManager.getPrompts();
    const editContainer = createElementWithOptions('div', {
      className: `form-container ${darkMode ? 'dark' : 'light'}`,
      styles: { padding: '0px', display: 'flex', flexDirection: 'column' }
    });
    const promptsContainer = createElementWithOptions('div', {
      className: `${SELECTORS.PROMPT_ITEMS_CONTAINER} prompt-list-items ${darkMode ? 'dark' : 'light'}`,
      styles: { maxHeight: '350px', overflowY: 'auto', marginBottom: '4px' }
    });
    prompts.forEach((prompt, index) => {
      const promptItem = createElementWithOptions('div', {
        className: `prompt-list-item ${darkMode ? 'dark' : 'light'}`,
        styles: { justifyContent: 'space-between' }
      });
      promptItem.setAttribute('draggable', 'true');
      promptItem.dataset.index = index;
      promptItem.addEventListener('dragstart', (e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', index);
        promptItem.classList.add('dragging');
      });
      promptItem.addEventListener('dragend', (e) => {
        promptItem.classList.remove('dragging');
      });
      promptItem.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });
      promptItem.addEventListener('drop', (e) => {
        e.preventDefault();
        const draggedIndex = e.dataTransfer.getData('text/plain');
        const targetIndex = promptItem.dataset.index;
        if (draggedIndex === targetIndex) return;
        const newPrompts = [...prompts];
        const [movedPrompt] = newPrompts.splice(draggedIndex, 1);
        newPrompts.splice(targetIndex, 0, movedPrompt);
        PromptStorageManager.setData('prompts', newPrompts).then(() => {
          PromptUIManager.showEditView();
        });
      });
      const textContainer = createElementWithOptions('div', { styles: { flex: '1' } });
      textContainer.textContent = prompt.title;
      const actionButtons = createElementWithOptions('div', {
        styles: { display: 'flex', gap: '4px' }
      });
      const editIcon = PromptUIManager.createIconButton('edit', () => {
        PromptUIManager.showEditForm(prompt, index);
      });
      const deleteIcon = PromptUIManager.createIconButton('delete', () => {
        if (confirm(`Are you sure you want to delete "${prompt.title}"?`)) {
          PromptUIManager.deletePrompt(index);
        }
      });
      actionButtons.append(editIcon, deleteIcon);
      promptItem.append(textContainer, actionButtons);
      promptsContainer.appendChild(promptItem);
    });
    editContainer.appendChild(promptsContainer);
    return editContainer;
  }

  static async showEditForm(prompt, index) {
    const darkMode = isDarkMode();
    const promptListEl = document.getElementById(SELECTORS.PROMPT_LIST);
    if (!promptListEl) return;
    PromptUIManager.resetPromptListContainer();
    const editForm = createElementWithOptions('div', {
      className: `form-container ${darkMode ? 'dark' : 'light'}`,
      styles: { padding: '0px', display: 'flex', flexDirection: 'column', gap: '8px' }
    });
    
    // Add title input field
    const titleInput = createElementWithOptions('input', {
      className: `input-field ${darkMode ? 'dark' : 'light'}`,
      attributes: { type: 'text', placeholder: 'Prompt Title' }
    });
    titleInput.value = prompt.title;
    
    const contentTextarea = createElementWithOptions('textarea', {
      className: `textarea-field ${darkMode ? 'dark' : 'light'}`,
      styles: { minHeight: '250px' }
    });
    contentTextarea.value = prompt.content;
    const saveButton = createElementWithOptions('button', {
      innerHTML: 'Save Changes',
      className: `button ${darkMode ? 'dark' : 'light'}`
    });
    saveButton.addEventListener('click', async (e) => {
      e.stopPropagation();
      const prompts = await PromptStorageManager.getPrompts();
      prompts[index] = {
        title: titleInput.value.trim(),
        content: contentTextarea.value.trim(),
        uuid: prompt.uuid // Preserve the uuid when editing
      };
      await PromptStorageManager.setData('prompts', prompts);
      PromptUIManager.showEditView();
    });
    
    editForm.append(titleInput, contentTextarea, saveButton);
    editForm.addEventListener('click', e => e.stopPropagation());
    promptListEl.insertBefore(editForm, promptListEl.firstChild);
  }

  static async deletePrompt(index) {
    const prompts = await PromptStorageManager.getPrompts();
    prompts.splice(index, 1);
    await PromptStorageManager.setData('prompts', prompts);
    const promptListEl = document.getElementById(SELECTORS.PROMPT_LIST);
    if (promptListEl) {
      PromptUIManager.resetPromptListContainer();
      PromptUIManager.showEditView();
    }
  }

  static showImportExportForm() {
    const promptListEl = document.getElementById(SELECTORS.PROMPT_LIST);
    if (!promptListEl) return;
    PromptUIManager.showPromptList(promptListEl);
    PromptUIManager.resetPromptListContainer();
    const importExportForm = PromptUIManager.createImportExportForm();
    promptListEl.insertBefore(importExportForm, promptListEl.firstChild);
  }

  static showEditView() {
    const promptListEl = document.getElementById(SELECTORS.PROMPT_LIST);
    if (!promptListEl) return;
    PromptUIManager.showPromptList(promptListEl);
    PromptUIManager.resetPromptListContainer();
    (async () => {
      const editView = await PromptUIManager.createEditView();
      promptListEl.insertBefore(editView, promptListEl.firstChild);
    })();
  }

  static showHelp() {
    const promptListEl = document.getElementById(SELECTORS.PROMPT_LIST);
    if (!promptListEl) return;
    PromptUIManager.showPromptList(promptListEl);
    PromptUIManager.resetPromptListContainer();
    const darkMode = isDarkMode();
    const helpContainer = createElementWithOptions('div', {
      className: `form-container ${darkMode ? 'dark' : 'light'}`,
      styles: { padding: '0px', display: 'flex', flexDirection: 'column', gap: '4px' }
    });

    const title = createElementWithOptions('div', {
      styles: { fontWeight: 'bold', fontSize: '16px', marginBottom: '6px' },
      innerHTML: 'Navigation'
    });

    const scrollableContainer = createElementWithOptions('div', {
      id: 'info-content',
      styles: { 
        maxHeight: '300px', 
        overflowY: 'auto', 
        padding: '4px',
        borderRadius: '6px',
        color: darkMode ? THEME_COLORS.inputDarkText : THEME_COLORS.inputLightText
      }
    });
    
    // Load the info content
    fetch(chrome.runtime.getURL('info.html'))
      .then(response => response.text())
      .then(html => {
        scrollableContainer.innerHTML = html;
      });
    
    helpContainer.appendChild(title);
    helpContainer.appendChild(scrollableContainer);
    promptListEl.insertBefore(helpContainer, promptListEl.firstChild);
  }

  static updateSelection(visiblePrompts, selectedIndex) {
    visiblePrompts.forEach((item, index) => {
      // Remove any inline styles that might interfere with hover
      item.style.backgroundColor = '';
      item.style.border = '';
      item.style.transform = '';
      
      // Remove any previously added selection class
      item.classList.remove('keyboard-selected');
      
      if (index === selectedIndex) {
        // Add a class instead of inline styles
        item.classList.add('keyboard-selected');
        
        // Handle scrolling
        const container = item.parentElement;
        const itemTop = item.offsetTop;
        const itemBottom = itemTop + item.offsetHeight;
        const containerTop = container.scrollTop;
        const containerBottom = containerTop + container.offsetHeight;
        
        if (itemTop < containerTop) {
          container.scrollTop = itemTop;
        } else if (itemBottom > containerBottom) {
          container.scrollTop = itemBottom - container.offsetHeight;
        }
      }
    });
  }

  static showChangelog() {
    const promptListEl = document.getElementById(SELECTORS.PROMPT_LIST);
    if (!promptListEl) return;
    PromptUIManager.showPromptList(promptListEl);
    PromptUIManager.resetPromptListContainer();
    const darkMode = isDarkMode();
    const changelogContainer = createElementWithOptions('div', {
      className: `form-container ${darkMode ? 'dark' : 'light'}`,
      styles: { padding: '0px', display: 'flex', flexDirection: 'column', gap: '8px' }
    });
    
    const title = createElementWithOptions('div', {
      styles: { fontWeight: 'bold', fontSize: '16px', marginBottom: '6px' },
      innerHTML: 'Changelog'
    });
    
    const scrollableContainer = createElementWithOptions('div', {
      id: 'changelog-content',
      styles: { 
        maxHeight: '250px', 
        overflowY: 'auto', 
        padding: '4px',
        borderRadius: '6px',
        color: darkMode ? THEME_COLORS.inputDarkText : THEME_COLORS.inputLightText
      }
    });
    
    // Load and display changelog content
    fetch(chrome.runtime.getURL('changelog.html'))
      .then(response => response.text())
      .then(html => {
        scrollableContainer.innerHTML = html;
      });
    
    changelogContainer.append(title, scrollableContainer);
    promptListEl.insertBefore(changelogContainer, promptListEl.firstChild);
  }
}

/* ============================================================================
   Prompt Processor (Handles Prompt Variable Extraction & Replacement)
   ============================================================================ */

class PromptProcessor {
  static extractVariables(content) {
    const variableRegex = /#([a-zA-Z0-9_]+)#/g;
    const matches = [...content.matchAll(variableRegex)];
    return [...new Set(matches.map(match => match[1]))];
  }
  
  static replaceVariables(content, variableValues) {
    let result = content;
    for (const [name, value] of Object.entries(variableValues)) {
      const regex = new RegExp(`#${name}#`, 'g');
      result = result.replace(regex, value);
    }
    return result;
  }
  
  static async insertPrompt(inputBox, content, promptListEl) {
    const variables = PromptProcessor.extractVariables(content);
    if (variables.length === 0) {
      await InputBoxHandler.insertPrompt(inputBox, content, promptListEl);
      PromptUIManager.hidePromptList(promptListEl);
    } else {
      console.error('Prompts with variables should be handled by PromptMediator.');
    }
  }
}

/* ============================================================================
   Prompt Mediator (Bridges UI and Prompt Processing)
   ============================================================================ */

class PromptMediator {
  constructor(uiManager, promptProcessor) {
    this.uiManager = uiManager;
    this.promptProcessor = promptProcessor;
    this.bindEvents();
    this.initialize();
  }
  
  bindEvents() {
    PromptUIManager.onPromptSelect(async (prompt) => {
      const inputBox = InputBoxHandler.getInputBox();
      if (!inputBox) {
        console.error('Input box not found.');
        return;
      }
      const variables = this.promptProcessor.extractVariables(prompt.content);
      const promptListEl = document.getElementById(SELECTORS.PROMPT_LIST);
      if (variables.length === 0) {
        await InputBoxHandler.insertPrompt(inputBox, prompt.content, promptListEl);
        PromptUIManager.hidePromptList(promptListEl);
      } else {
        PromptUIManager.showVariableInputForm(inputBox, prompt.content, variables, promptListEl, async (variableValues) => {
          const processedContent = this.promptProcessor.replaceVariables(prompt.content, variableValues);
          await InputBoxHandler.insertPrompt(inputBox, processedContent, promptListEl);
          PromptUIManager.hidePromptList(promptListEl);
          setTimeout(() => {
            PromptStorageManager.getPrompts().then(prompts => {
              PromptUIManager.refreshPromptList(prompts);
            });
          }, 300);
        });
      }
    });
  }
  
  async initialize() {
    try {
      await InputBoxHandler.waitForInputBox();
      console.log('Input box found.');
      const prompts = await PromptStorageManager.getPrompts();
      PromptUIManager.injectPromptManagerButton(prompts);
      
      // Refine MutationObserver scope by observing a specific container
      let observerTimeout = null;
      const chatContainer = document.querySelector('main');
      const observerTarget = chatContainer || document.body;
      const observer = new MutationObserver(async (mutations) => {
        if (document.getElementById(SELECTORS.PROMPT_BUTTON_CONTAINER)) { return; }
        if (observerTimeout) clearTimeout(observerTimeout);
        observerTimeout = setTimeout(async () => {
          const inputBox = InputBoxHandler.getInputBox();
          if (inputBox && !document.getElementById(SELECTORS.PROMPT_BUTTON_CONTAINER)) {
            console.log('Reinjecting prompt manager button via MutationObserver.');
            const updatedPrompts = await PromptStorageManager.getPrompts();
            PromptUIManager.injectPromptManagerButton(updatedPrompts);
          }
        }, 300);
      });
      observer.observe(observerTarget, { childList: true, subtree: true });
      
      PromptStorageManager.onChange(async (changes, area) => {
        if (area === 'local' && changes.prompts) {
          console.log('Prompts updated in storage.');
          PromptUIManager.refreshPromptList(changes.prompts.newValue);
        }
      });
      
      document.addEventListener('keydown', async (e) => {
        const shortcut = await PromptStorageManager.getKeyboardShortcut();
        const modifierPressed = e[shortcut.modifier];
        const shiftPressed = shortcut.requiresShift ? e.shiftKey : true;
        if (modifierPressed && shiftPressed && e.key.toLowerCase() === shortcut.key.toLowerCase()) {
          e.preventDefault();
          const promptListEl = document.getElementById(SELECTORS.PROMPT_LIST);
          if (promptListEl) {
            promptListEl.classList.contains('visible')
              ? PromptUIManager.hidePromptList(promptListEl)
              : PromptUIManager.showPromptList(promptListEl);
          }
        }
      });
    } catch (error) {
      console.error('Error initializing extension:', error);
    }
  }
}

/* ============================================================================
   Initialize the extension via the PromptMediator after a short delay.
   ============================================================================ */
setTimeout(() => {
  new PromptMediator(PromptUIManager, PromptProcessor);
}, 200);
