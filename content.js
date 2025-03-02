console.log("Prompt Manager content script loaded.");

// --------------------
// Global Style Definitions & Helpers
// --------------------
const Colors = {
  primary: '#5A67D8',
  primaryGradientStart: '#667EEA',
  primaryGradientEnd: '#764BA2',
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
  buttonHoverLight: '#3C4A59',
  deleteButtonDarkBg: '#E53E3E',
  deleteButtonLightBg: '#F56565'
};

const Styles = {
  promptButtonContainer: (position) => ({
    position: 'fixed',
    zIndex: '9999',
    bottom: `${position.y}px`,
    right: `${position.x}px`,
    width: '40px',
    height: '40px',
    userSelect: 'none',
    cursor: 'move'
  }),
  promptButton: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.primary,
    // Background image will be set later.
  }
};

const CLOSE_DELAY = 5000; // in milliseconds

const SELECTORS = {
  PROMPT_BUTTON_CONTAINER: 'prompt-button-container',
  PROMPT_BUTTON: 'prompt-button',
  PROMPT_LIST: 'prompt-list',
  PROMPT_SEARCH_INPUT: 'prompt-search-input',
  PROMPT_ITEMS_CONTAINER: 'prompt-items-container'
};

// A reusable element creator that also attaches event listeners.
function createEl(tag, { id, className, styles, attributes, innerHTML, eventListeners } = {}) {
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

// Inject global CSS using modern design trends
function injectGlobalStyles() {
  const style = createEl('style');
  style.textContent = `
    :root {
      --primary: ${Colors.primary};
      --primary-gradient-start: ${Colors.primaryGradientStart};
      --primary-gradient-end: ${Colors.primaryGradientEnd};
      --hover-primary: ${Colors.hoverPrimary};
      --dark-bg: ${Colors.darkBackground};
      --light-bg: ${Colors.lightBackground};
      --dark-border: ${Colors.darkBorder};
      --light-border: ${Colors.lightBorder};
      --dark-shadow: ${Colors.darkShadow};
      --light-shadow: ${Colors.lightShadow};
      --input-dark-border: ${Colors.inputDarkBorder};
      --input-light-border: ${Colors.inputLightBorder};
      --input-dark-bg: ${Colors.inputDarkBg};
      --input-light-bg: ${Colors.inputLightBg};
      --input-dark-text: ${Colors.inputDarkText};
      --input-light-text: ${Colors.inputLightText};
      --button-hover-dark: ${Colors.buttonHoverDark};
      --button-hover-light: ${Colors.buttonHoverLight};
      --delete-button-dark-bg: ${Colors.deleteButtonDarkBg};
      --delete-button-light-bg: ${Colors.deleteButtonLightBg};
      --transition-speed: 0.3s;
      --border-radius: 8px;
      --font-family: 'Roboto', sans-serif;
    }

    /* Apply the modern font */
    body {
      font-family: var(--font-family);
    }

    /* Prompt Button with gradient background, smooth scale on hover */
    .prompt-button {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      border: none;
      outline: none;
      cursor: pointer;
      background: linear-gradient(135deg, var(--primary-gradient-start), var(--primary-gradient-end));
      box-shadow: var(--light-shadow);
      transition: transform var(--transition-speed) ease, box-shadow var(--transition-speed) ease;
      background-size: 50%;
      background-position: center;
      background-repeat: no-repeat;
    }
    .prompt-button:hover {
      transform: scale(1.1);
      box-shadow: var(--dark-shadow);
    }

    /* Prompt List container with increased padding, rounded corners, and backdrop blur */
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
      transition: opacity var(--transition-speed) ease, transform var(--transition-speed) ease;
      backdrop-filter: blur(12px);
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

    /* Bottom menu with increased spacing and a refined border */
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

    /* Search input with comfortable padding and smooth transitions */
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

    /* Form fields with consistent spacing and updated sizing */
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

    /* Buttons with refined padding and smooth hover effects */
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

    /* Icon buttons with increased size and subtle hover background */
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

    /* Input focus style with a clear highlight */
    #${SELECTORS.PROMPT_LIST} input:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 2px rgba(90, 103, 216, 0.3);
      outline: none;
    }
  `;
  document.head.appendChild(style);
}
injectGlobalStyles();

// --------------------
// Improved Dark Mode Handling
// --------------------
let currentDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    currentDarkMode = e.matches;
    updateTheme();
  });
}
function isDarkMode() {
  return currentDarkMode;
}
function updateTheme() {
  const promptList = document.getElementById(SELECTORS.PROMPT_LIST);
  if (promptList) {
    UIManager.buildPromptListContainer(); 
  }
}

// --------------------
// Event Delegation Helpers
// --------------------
function attachDelegatedClick(container, selector, handler) {
  container.addEventListener('click', function(event) {
    const target = event.target.closest(selector);
    if (target && container.contains(target)) {
      handler.call(target, event);
    }
  });
}
function removeAllListeners(element) {
  const newElement = element.cloneNode(true);
  element.parentNode.replaceChild(newElement, element);
  return newElement;
}

// --------------------
// Simple Event Emitter
// --------------------
class EventEmitter {
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

// --------------------
// StorageManager Class with Error Handling & Validation
// --------------------
class StorageManager {
  static getData(key, defaultValue) {
    return new Promise(resolve => {
      try {
        chrome.storage.local.get(key, data => {
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
        chrome.storage.local.set({ [key]: value }, () => resolve());
      } catch (error) {
        console.error(`Error setting data for key ${key}:`, error);
        resolve();
      }
    });
  }
  static async getPrompts() {
    const prompts = await StorageManager.getData('prompts', []);
    return Array.isArray(prompts) ? prompts : [];
  }
  static async savePrompt(prompt) {
    try {
      const prompts = await StorageManager.getPrompts();
      const allPrompts = [...prompts, prompt];
      await StorageManager.setData('prompts', allPrompts);
      console.log('Prompt saved successfully.');
      return { success: true };
    } catch (error) {
      console.error('Error saving prompt:', error);
      return { success: false, error: error.message };
    }
  }
  static onChange(callback) {
    chrome.storage.onChanged.addListener(callback);
  }
  static async getButtonPosition() {
    return await StorageManager.getData('buttonPosition', { x: 75, y: 100 });
  }
  static async saveButtonPosition(position) {
    return await StorageManager.setData('buttonPosition', position);
  }
  static async getKeyboardShortcut() {
    const isMac = navigator.platform.toUpperCase().includes('MAC');
    return await StorageManager.getData('keyboardShortcut', { 
      key: isMac ? 'p' : 'm',
      modifier: isMac ? 'metaKey' : 'ctrlKey',
      requiresShift: isMac 
    });
  }
  static async saveKeyboardShortcut(shortcut) {
    return await StorageManager.setData('keyboardShortcut', shortcut);
  }
}

// --------------------
// UIManager Class (Presentation Layer)
// --------------------
class UIManager {
  // Set up an event emitter to broadcast UI events
  static eventEmitter = new EventEmitter();

  // Allow external subscriptions
  static onPromptSelect(callback) {
    UIManager.eventEmitter.on('promptSelect', callback);
  }
  static emitPromptSelect(prompt) {
    UIManager.eventEmitter.emit('promptSelect', prompt);
  }

  static injectPromptManagerButton(prompts) {
    if (document.getElementById(SELECTORS.PROMPT_BUTTON_CONTAINER)) {
      console.log('Button container already exists.');
      return;
    }
    StorageManager.getButtonPosition().then(position => {
      const container = createEl('div', {
        id: SELECTORS.PROMPT_BUTTON_CONTAINER,
        styles: Styles.promptButtonContainer(position)
      });
      const button = createEl('button', {
        id: SELECTORS.PROMPT_BUTTON,
        className: 'prompt-button',
        eventListeners: {
          click: e => {
            e.stopPropagation();
            const promptList = document.getElementById(SELECTORS.PROMPT_LIST);
            if (promptList) {
              promptList.style.display = promptList.style.display === 'none' ? 'block' : 'none';
            }
          },
          mouseenter: e => {
            e.stopPropagation();
            const promptList = document.getElementById(SELECTORS.PROMPT_LIST);
            if (promptList) { promptList.style.display = 'block'; }
          },
          mouseleave: e => {
            e.stopPropagation();
            UIManager.startCloseTimer(e, document.getElementById(SELECTORS.PROMPT_LIST), button, () => {});
          }
        },
        styles: Styles.promptButton
      });
      const iconUrl = chrome.runtime.getURL('icons/icon-button.png');
      button.style.backgroundImage = `url(${iconUrl})`;
      container.appendChild(button);
      const promptList = createEl('div', {
        id: SELECTORS.PROMPT_LIST,
        className: `prompt-list ${isDarkMode() ? 'dark' : 'light'}`
      });
      container.appendChild(promptList);
      document.body.appendChild(container);
      
      if (prompts.length === 0) {
        UIManager.showPromptCreationForm();
      } else {
        UIManager.refreshPromptList(prompts);
      }
      
      UIManager.attachButtonEvents(button, promptList, container);
      UIManager.makeDraggable(container);
    });
  }

  static attachButtonEvents(button, promptList, container) {
    let isOpen = false;
    
    button.addEventListener('click', e => {
      e.stopPropagation();
      isOpen ? UIManager.hidePromptList(promptList) : UIManager.showPromptList(promptList);
      isOpen = !isOpen;
    });
    
    button.addEventListener('mouseenter', e => {
      e.stopPropagation();
      UIManager.cancelCloseTimer();
      UIManager.showPromptList(promptList);
      isOpen = true;
    });
    
    button.addEventListener('mouseleave', e => {
      e.stopPropagation();
      UIManager.startCloseTimer(e, promptList, button, () => { isOpen = false; });
    });
    
    promptList.addEventListener('mouseenter', () => {
      UIManager.cancelCloseTimer();
    });
    
    promptList.addEventListener('mouseleave', e => {
      UIManager.startCloseTimer(e, promptList, button, () => { isOpen = false; });
    });
    
    document.addEventListener('click', e => {
      const isMenuAction = e.target.closest('#prompt-list') || 
                           e.target.closest(`.${SELECTORS.PROMPT_ITEMS_CONTAINER}`) ||
                           e.target.closest('button');
      if (isOpen && !button.contains(e.target) && !promptList.contains(e.target) && !isMenuAction) {
        UIManager.hidePromptList(promptList);
        isOpen = false;
      }
    });
  }
  
  static startCloseTimer(e, promptList, button, callback) {
    if (UIManager.closeTimer) {
      clearTimeout(UIManager.closeTimer);
    }
    UIManager.closeTimer = setTimeout(() => {
      UIManager.hidePromptList(promptList);
      if (callback) callback();
      UIManager.closeTimer = null;
    }, CLOSE_DELAY);
  }
  
  static cancelCloseTimer() {
    if (UIManager.closeTimer) {
      clearTimeout(UIManager.closeTimer);
      UIManager.closeTimer = null;
    }
  }
  
  static makeDraggable(container) {
    let isDragging = false, initialX, initialY, startRight, startBottom;
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
        await StorageManager.saveButtonPosition({
          x: parseInt(container.style.right, 10),
          y: parseInt(container.style.bottom, 10)
        });
      }
    });
  }
  
  static createPromptList(prompts) {
    const promptList = createEl('div', {
      id: SELECTORS.PROMPT_LIST,
      className: `prompt-list ${isDarkMode() ? 'dark' : 'light'}`
    });
    const promptsContainer = createEl('div', {
      className: `${SELECTORS.PROMPT_ITEMS_CONTAINER} prompt-list-items ${isDarkMode() ? 'dark' : 'light'}`
    });
    if (prompts.length === 0) {
      const emptyStateDiv = createEl('div', { className: 'shortcut-container', innerHTML: UIManager.getEmptyStateHTML() });
      promptsContainer.appendChild(emptyStateDiv);
    } else {
      prompts.forEach(prompt => {
        const promptItem = UIManager.createPromptItem(prompt);
        promptsContainer.appendChild(promptItem);
      });
    }
    promptList.appendChild(promptsContainer);
    promptList.appendChild(UIManager.createBottomMenu());
    return promptList;
  }
  
  static getEmptyStateHTML() {
    return `
      <div style="display: flex; flex-direction: column; gap: 2px; font-size: 12px;">
        <div>Open prompt list buttons</div>
        <div>
          <div style="background-color: ${Colors.primary}; color: white; padding: 2px 4px; border-radius: 4px; display: inline-block; margin-bottom: 4px;">Hover/Click</div>
        </div>
        <div>Open / close prompt list</div>
        <div>
          <div style="background-color: ${Colors.primary}; color: white; padding: 2px 4px; border-radius: 4px; display: inline-block; margin-bottom: 4px;">⌘ + Shift + P or Ctrl + M</div>
        </div>
        <div>Navigate the prompt list</div>
        <div>
          <div style="background-color: ${Colors.primary}; color: white; padding: 2px 4px; border-radius: 4px; display: inline-block; margin-bottom: 4px;">↑↓</div>
        </div>
        <div>Select a prompt</div>
        <div>
          <div style="background-color: ${Colors.primary}; color: white; padding: 2px 4px; border-radius: 4px; display: inline-block; margin-bottom: 4px;">Enter</div>
        </div>
        <div>Close the prompt manager</div>
        <div>
          <div style="background-color: ${Colors.primary}; color: white; padding: 2px 4px; border-radius: 4px; display: inline-block; margin-bottom: 4px;">Esc</div>
        </div>
      </div>
    `;
  }
  
  // Instead of directly calling PromptManager.insertPrompt, we emit a prompt selection event.
  static createPromptItem(prompt) {
    const item = createEl('div', {
      className: `prompt-list-item ${isDarkMode() ? 'dark' : 'light'}`,
      eventListeners: {
        click: () => {
          UIManager.emitPromptSelect(prompt);
        }
      }
    });
    const textContainer = createEl('div', { styles: { flex: '1' } });
    textContainer.textContent = prompt.title;
    item.appendChild(textContainer);
    item.dataset.title = prompt.title.toLowerCase();
    item.dataset.content = prompt.content.toLowerCase();
    return item;
  }
  
  static createBottomMenu() {
    const bottomMenu = createEl('div', {
      className: `bottom-menu ${isDarkMode() ? 'dark' : 'light'}`
    });
    const searchInput = createEl('input', {
      id: SELECTORS.PROMPT_SEARCH_INPUT,
      className: `search-input ${isDarkMode() ? 'dark' : 'light'}`,
      attributes: { type: 'text', placeholder: 'Type to search' }
    });
    let selectedIndex = -1;
    searchInput.addEventListener('keydown', (e) => {
      const visiblePrompts = Array.from(document.querySelectorAll(`.${SELECTORS.PROMPT_ITEMS_CONTAINER} > .prompt-list-item`))
        .filter(item => item.style.display !== 'none' && !item.classList.contains('shortcut-container'));
      switch(e.key) {
        case 'ArrowDown':
          e.preventDefault();
          selectedIndex = Math.min(selectedIndex + 1, visiblePrompts.length - 1);
          if (selectedIndex === -1 && visiblePrompts.length > 0) selectedIndex = 0;
          UIManager.updateSelection(visiblePrompts, selectedIndex);
          break;
        case 'ArrowUp':
          e.preventDefault();
          selectedIndex = Math.max(selectedIndex - 1, -1);
          UIManager.updateSelection(visiblePrompts, selectedIndex);
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
          UIManager.updateSelection(visiblePrompts, selectedIndex);
          UIManager.hidePromptList(document.getElementById(SELECTORS.PROMPT_LIST));
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
    const menuBar = UIManager.createMenuBar();
    bottomMenu.appendChild(searchInput);
    bottomMenu.appendChild(menuBar);
    return bottomMenu;
  }
  
  static createMenuBar() {
    const menuBar = createEl('div', { styles: { display: 'flex', alignItems: 'center', gap: '8px', margin: '0' } });
    const promptListButton = UIManager.createIconButton('list', () => {
      UIManager.refreshAndShowPromptList();
    });
    const messageButton = UIManager.createIconButton('message', () => {
      UIManager.showPromptCreationForm();
    });
    const editButton = UIManager.createIconButton('edit', () => {
      UIManager.showEditView();
    });
    const settingsButton = UIManager.createIconButton('settings', e => {
      e.stopPropagation();
      UIManager.showImportExportForm();
    });
    const helpButton = UIManager.createIconButton('help', e => {
      e.stopPropagation();
      UIManager.showHelp();
    });
    menuBar.append(promptListButton, messageButton, editButton, settingsButton, helpButton);
    return menuBar;
  }
  
  static createIconButton(type, onClick) {
    let svgContent = '';
    const ariaLabels = {
      list: 'Show Prompt List',
      message: 'Create New Prompt',
      delete: 'Delete Prompt',
      edit: 'Edit Prompt',
      settings: 'Import/Export Prompts',
      help: 'Show Help'
    };
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
    }
    const btn = createEl('button', {
      className: 'icon-button',
      eventListeners: {
        click: onClick
      },
      innerHTML: svgContent
    });
    return btn;
  }
  
  static showPromptList(promptList) {
    if (!promptList) return;
    const itemsContainer = promptList.querySelector(`.${SELECTORS.PROMPT_ITEMS_CONTAINER}`);
    if (itemsContainer) {
      Array.from(itemsContainer.children).forEach(item => {
        item.style.display = 'flex';
      });
    }
    promptList.style.display = 'block';
    setTimeout(() => {
      promptList.style.opacity = '1';
      promptList.style.transform = 'translateY(0)';
      UIManager.focusSearchInput();
    }, 0);
  }
  
  static hidePromptList(promptList) {
    if (!promptList) return;
    promptList.style.opacity = '0';
    const searchInput = document.getElementById(SELECTORS.PROMPT_SEARCH_INPUT);
    if (searchInput) searchInput.value = '';
    setTimeout(() => {
      if (promptList) {
        promptList.style.display = 'none';
        const itemsContainer = promptList.querySelector(`.${SELECTORS.PROMPT_ITEMS_CONTAINER}`);
        if (itemsContainer) {
          Array.from(itemsContainer.children).forEach(item => {
            item.style.display = 'flex';
          });
        }
      }
    }, 300);
  }
  
  static buildPromptListContainer(prompts = null) {
    const promptList = document.getElementById(SELECTORS.PROMPT_LIST);
    if (!promptList) {
      console.error('Prompt list not found.');
      return;
    }
    promptList.className = `prompt-list ${isDarkMode() ? 'dark' : 'light'}`;
    promptList.innerHTML = '';
    const promptsContainer = createEl('div', {
      className: `${SELECTORS.PROMPT_ITEMS_CONTAINER} prompt-list-items ${isDarkMode() ? 'dark' : 'light'}`
    });
    if (Array.isArray(prompts)) {
      prompts.forEach(prompt => {
        const promptItem = UIManager.createPromptItem(prompt);
        promptsContainer.appendChild(promptItem);
      });
    }
    promptList.appendChild(promptsContainer);
    promptList.appendChild(UIManager.createBottomMenu());
  }
  
  static refreshPromptList(prompts) {
    UIManager.buildPromptListContainer(prompts);
    const searchInput = document.getElementById(SELECTORS.PROMPT_SEARCH_INPUT);
    if (searchInput) {
      searchInput.style.display = 'block';
    }
  }
  
  static resetPromptListContainer() {
    UIManager.buildPromptListContainer();
  }
  
  static focusSearchInput() {
    const searchInput = document.getElementById(SELECTORS.PROMPT_SEARCH_INPUT);
    if (searchInput) {
      searchInput.className = `search-input ${isDarkMode() ? 'dark' : 'light'}`;
      window.requestAnimationFrame(() => {
        searchInput.focus();
        searchInput.select();
      });
    }
  }
  
  static showPromptCreationForm() {
    const promptList = document.getElementById(SELECTORS.PROMPT_LIST);
    if (!promptList) return;
    UIManager.resetPromptListContainer();
    const searchInput = promptList.querySelector(`#${SELECTORS.PROMPT_SEARCH_INPUT}`);
    if (searchInput) searchInput.style.display = 'none';
    StorageManager.getPrompts().then(prompts => {
      const creationForm = UIManager.createPromptCreationForm('', prompts.length === 0);
      promptList.insertBefore(creationForm, promptList.firstChild);
      const titleInput = creationForm.querySelector('input');
      if (titleInput) titleInput.focus();
    });
  }
  
  // Now accepts an onSubmit callback for variable handling.
  static showVariableInputForm(inputBox, promptContent, variables, promptList, onSubmit) {
    promptList.innerHTML = '';
    const dark = isDarkMode();
    const formContainer = createEl('div', {
      className: `form-container ${dark ? 'dark' : 'light'}`,
      styles: { padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }
    });
    const variablesContainer = createEl('div', {
      styles: { display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '300px', overflowY: 'auto' }
    });
    const variableValues = {};
    variables.forEach(variable => {
      const row = createEl('div', { styles: { display: 'flex', flexDirection: 'column', gap: '4px' } });
      const label = createEl('label', {
        innerHTML: variable,
        styles: { fontSize: '12px', fontWeight: 'bold', color: dark ? Colors.inputDarkText : '#333' }
      });
      const input = createEl('input', {
        attributes: { type: 'text', placeholder: `${variable} value` },
        className: `input-field ${dark ? 'dark' : 'light'}`
      });
      input.addEventListener('input', () => {
        variableValues[variable] = input.value;
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { submitButton.click(); }
      });
      row.append(label, input);
      variablesContainer.appendChild(row);
      variableValues[variable] = '';
    });
    formContainer.appendChild(variablesContainer);
    const buttonsContainer = createEl('div', { styles: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' } });
    const submitButton = createEl('button', {
      innerHTML: 'Submit',
      className: `button ${isDarkMode() ? 'dark' : 'light'}`
    });
    submitButton.addEventListener('click', () => {
      onSubmit(variableValues);
    });
    const returnButton = createEl('button', {
      innerHTML: 'Back',
      className: `button ${isDarkMode() ? 'dark' : 'light'}`,
      styles: { 
        marginTop: '4px', 
        backgroundColor: isDarkMode() ? '#4A5568' : '#CBD5E0', 
        color: isDarkMode() ? Colors.inputDarkText : '#333' 
      }
    });
    returnButton.addEventListener('click', () => {
      UIManager.refreshAndShowPromptList();
    });
    buttonsContainer.append(submitButton, returnButton);
    formContainer.appendChild(buttonsContainer);
    promptList.appendChild(formContainer);
    UIManager.showPromptList(promptList);
    const firstInput = variablesContainer.querySelector('input');
    if (firstInput) { firstInput.focus(); }
  }
  
  static createPromptCreationForm(prefillContent = '', showMissingNote = false) {
    const searchInput = document.getElementById(SELECTORS.PROMPT_SEARCH_INPUT);
    if (searchInput) searchInput.style.display = 'none';
    const formContainer = createEl('div', {
      className: `form-container ${isDarkMode() ? 'dark' : 'light'}`,
      styles: { padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }
    });
    const titleInput = createEl('input', {
      attributes: { placeholder: 'Prompt Title' },
      className: `input-field ${isDarkMode() ? 'dark' : 'light'}`
    });
    const contentTextarea = createEl('textarea', {
      attributes: { placeholder: 'Add variables with #name#' },
      className: `textarea-field ${isDarkMode() ? 'dark' : 'light'}`
    });
    contentTextarea.value = prefillContent;
    const saveButton = createEl('button', {
      innerHTML: 'Create',
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
      const result = await StorageManager.savePrompt({ title: titleVal, content: contentVal });
      if (!result.success) {
        UIManager.showSaveErrorDialog(result.error);
        return;
      }
      StorageManager.getPrompts().then(prompts => {
        UIManager.refreshAndShowPromptList();
      });
    });
    formContainer.append(titleInput, contentTextarea, saveButton);
    if (showMissingNote) {
      const missingText = createEl('div', {
        styles: { marginTop: '8px', fontSize: '12px', color: isDarkMode() ? Colors.inputDarkText : '#333' },
        innerHTML: '<strong>Prompts missing?</strong><br>Fix available : click the extension icon in the menu bar for instructions'
      });
      formContainer.appendChild(missingText);
    }
    formContainer.addEventListener('click', e => e.stopPropagation());
    return formContainer;
  }
  
  static showSaveErrorDialog(errorMsg) {
    const dark = isDarkMode();
    const dialog = createEl('div', {
      styles: {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: '10001',
        maxWidth: '400px',
        width: '90%',
        backgroundColor: dark ? '#1a1a1a' : Colors.lightBackground
      }
    });
    dialog.innerHTML = `
      <h3 style="margin-top: 0; color: ${dark ? Colors.inputDarkText : '#333'}">Unable to Save Prompt</h3>
      <p style="color: ${dark ? Colors.inputDarkText : '#333'}">${errorMsg}</p>
      <div style="text-align: right; margin-top: 15px;">
        <button id="dialog-close" style="padding: 8px 16px; background-color: ${dark ? '#1e4976' : Colors.primary}; color: #ffffff; border: none; border-radius: 6px; cursor: pointer;">Close</button>
      </div>
    `;
    document.body.appendChild(dialog);
    dialog.querySelector('#dialog-close').onclick = () => dialog.remove();
  }
  
  static createImportExportForm() {
    const dark = isDarkMode();
    const searchInput = document.getElementById(SELECTORS.PROMPT_SEARCH_INPUT);
    if (searchInput) searchInput.style.display = 'none';
    const formContainer = createEl('div', {
      className: `form-container ${dark ? 'dark' : 'light'}`,
      styles: { padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }
    });
    const exportButton = createEl('button', {
      innerHTML: 'Export Prompts',
      className: `button ${dark ? 'dark' : 'light'}`
    });
    exportButton.addEventListener('click', async (e) => {
      e.stopPropagation();
      const prompts = await StorageManager.getPrompts();
      const json = JSON.stringify(prompts, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = createEl('a', { attributes: { href: url, download: `prompts-${new Date().toISOString().split('T')[0]}.json` } });
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      exportButton.textContent = 'Prompts exported!';
      setTimeout(() => exportButton.textContent = 'Export Prompts', 2000);
    });
    const importButton = createEl('button', {
      innerHTML: 'Import Prompts',
      className: `button ${dark ? 'dark' : 'light'}`,
      styles: { marginTop: '8px' }
    });
    importButton.addEventListener('click', async (e) => {
      e.stopPropagation();
      const fileInput = createEl('input', { attributes: { type: 'file', accept: '.json' } });
      fileInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (file) {
          try {
            const text = await file.text();
            const prompts = JSON.parse(text);
            if (!Array.isArray(prompts)) throw new Error('Invalid format');
            await StorageManager.setData('prompts', prompts);
            UIManager.refreshPromptList(prompts);
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
  
  // EDIT VIEW with Drag & Drop Reordering
  static async createEditView() {
    const dark = isDarkMode();
    const prompts = await StorageManager.getPrompts();
    const editContainer = createEl('div', {
      className: `form-container ${dark ? 'dark' : 'light'}`,
      styles: { padding: '10px', display: 'flex', flexDirection: 'column' }
    });
    const promptsContainer = createEl('div', {
      className: `${SELECTORS.PROMPT_ITEMS_CONTAINER} prompt-list-items ${dark ? 'dark' : 'light'}`,
      styles: { maxHeight: '350px', overflowY: 'auto', marginBottom: '8px' }
    });
    prompts.forEach((prompt, index) => {
      const promptItem = createEl('div', {
        className: `prompt-list-item ${dark ? 'dark' : 'light'}`,
        styles: { justifyContent: 'space-between' }
      });
      // Make the item draggable and store its index
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
        // Reorder prompts array: remove dragged item and insert it at the drop position.
        const newPrompts = [...prompts];
        const [movedPrompt] = newPrompts.splice(draggedIndex, 1);
        newPrompts.splice(targetIndex, 0, movedPrompt);
        StorageManager.setData('prompts', newPrompts).then(() => {
          UIManager.showEditView();
        });
      });
      
      const textContainer = createEl('div', { styles: { flex: '1' } });
      textContainer.textContent = prompt.title;
      const actionButtons = createEl('div', {
        styles: { display: 'flex', gap: '4px' }
      });
      const editIcon = UIManager.createIconButton('edit', () => {
        UIManager.showEditForm(prompt, index);
      });
      const deleteIcon = UIManager.createIconButton('delete', () => {
        if (confirm(`Are you sure you want to delete "${prompt.title}"?`)) {
          UIManager.deletePrompt(index);
        }
      });
      actionButtons.append(editIcon, deleteIcon);
      promptItem.append(textContainer, actionButtons);
      promptsContainer.appendChild(promptItem);
    });
    editContainer.append(promptsContainer);
    return editContainer;
  }
  
  static async showEditForm(prompt, index) {
    const dark = isDarkMode();
    const promptList = document.getElementById(SELECTORS.PROMPT_LIST);
    if (!promptList) return;
    UIManager.resetPromptListContainer();
    const editForm = createEl('div', {
      className: `form-container ${dark ? 'dark' : 'light'}`,
      styles: { padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }
    });
    const contentTextarea = createEl('textarea', {
      className: `textarea-field ${dark ? 'dark' : 'light'}`
    });
    contentTextarea.value = prompt.content;
    const saveButton = createEl('button', {
      innerHTML: 'Save Changes',
      className: `button ${dark ? 'dark' : 'light'}`
    });
    saveButton.addEventListener('click', async (e) => {
      e.stopPropagation();
      const prompts = await StorageManager.getPrompts();
      prompts[index] = {
        title: prompt.title,
        content: contentTextarea.value.trim()
      };
      await StorageManager.setData('prompts', prompts);
      UIManager.showEditView();
    });
    editForm.append(contentTextarea, saveButton);
    editForm.addEventListener('click', e => e.stopPropagation());
    promptList.insertBefore(editForm, promptList.firstChild);
  }
  
  static async deletePrompt(index) {
    const prompts = await StorageManager.getPrompts();
    prompts.splice(index, 1);
    await StorageManager.setData('prompts', prompts);
    const promptList = document.getElementById(SELECTORS.PROMPT_LIST);
    if (promptList) {
      UIManager.resetPromptListContainer();
      UIManager.showEditView();
    }
  }
  
  static refreshAndShowPromptList() {
    (async () => {
      const prompts = await StorageManager.getPrompts();
      UIManager.refreshPromptList(prompts);
      const promptList = document.getElementById(SELECTORS.PROMPT_LIST);
      if (promptList) UIManager.showPromptList(promptList);
    })();
  }
  
  static showImportExportForm() {
    const promptList = document.getElementById(SELECTORS.PROMPT_LIST);
    if (!promptList) return;
    UIManager.resetPromptListContainer();
    const importExportForm = UIManager.createImportExportForm();
    promptList.insertBefore(importExportForm, promptList.firstChild);
  }
  
  static showEditView() {
    const promptList = document.getElementById(SELECTORS.PROMPT_LIST);
    if (!promptList) return;
    UIManager.resetPromptListContainer();
    (async () => {
      const editView = await UIManager.createEditView();
      promptList.insertBefore(editView, promptList.firstChild);
    })();
  }
  
  static showHelp() {
    const promptList = document.getElementById(SELECTORS.PROMPT_LIST);
    if (!promptList) return;
    UIManager.resetPromptListContainer();
    const dark = isDarkMode();
    const helpContainer = createEl('div', {
      className: `form-container ${dark ? 'dark' : 'light'}`,
      styles: { padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }
    });
    const content = createEl('div', {
      innerHTML: `
        <div style="display: flex; flex-direction: column; gap: 2px; font-size: 12px;">
          <div>Open prompt list buttons</div>
          <div>
            <div style="background-color: ${Colors.primary}; color: white; padding: 2px 4px; border-radius: 4px; display: inline-block; margin-bottom: 4px;">Hover/Click</div>
          </div>
          <div>Open / close prompt list</div>
          <div>
            <div style="background-color: ${Colors.primary}; color: white; padding: 2px 4px; border-radius: 4px; display: inline-block; margin-bottom: 4px;">⌘ + Shift + P or Ctrl + M</div>
          </div>
          <div>Navigate the prompt list</div>
          <div>
            <div style="background-color: ${Colors.primary}; color: white; padding: 2px 4px; border-radius: 4px; display: inline-block; margin-bottom: 4px;">↑ ↓ + Enter</div>
          </div>
          <div>Close the prompt manager</div>
          <div>
            <div style="background-color: ${Colors.primary}; color: white; padding: 2px 4px; border-radius: 4px; display: inline-block; margin-bottom: 4px;">Esc</div>
          </div>
        </div>
      `
    });
    helpContainer.append(content);
    promptList.insertBefore(helpContainer, promptList.firstChild);
  }
  
  static updateSelection(visiblePrompts, selectedIndex) {
    visiblePrompts.forEach((item, index) => {
      item.style.backgroundColor = 'transparent';
      item.style.border = '1px solid transparent';
      item.style.transform = 'translateY(0)';
      if (index === selectedIndex) {
        item.style.backgroundColor = isDarkMode() ? '#0c172e' : '#f0f4f8';
        item.style.border = isDarkMode() ? '1px solid #555' : '1px solid #3375b1';
        item.style.transform = 'translateY(-1px)';
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
}

// --------------------
// PromptManager Class (Logic Layer)
// --------------------
class PromptManager {
  // Focus solely on prompt data operations.
  
  // Extract variables from prompt content.
  static extractVariables(content) {
    const variableRegex = /#([a-zA-Z0-9_]+)#/g;
    const matches = [...content.matchAll(variableRegex)];
    return [...new Set(matches.map(match => match[1]))];
  }
  
  // Replace variables in prompt content.
  static replaceVariables(content, variableValues) {
    let result = content;
    for (const [name, value] of Object.entries(variableValues)) {
      const regex = new RegExp(`#${name}#`, 'g');
      result = result.replace(regex, value);
    }
    return result;
  }
  
  // (Optional) Add additional prompt data validation methods here.
  
  // Retain insertPrompt for backward compatibility if needed.
  static async insertPrompt(inputBox, content, promptList) {
    const variables = PromptManager.extractVariables(content);
    if (variables.length === 0) {
      await InputBoxHandler.insertPrompt(inputBox, content, promptList);
    } else {
      console.error('Prompts with variables should be handled by PromptController.');
    }
  }
}

// --------------------
// PromptController (Mediator between UI and Prompt Data)
// --------------------
class PromptController {
  constructor(uiManager, promptManager) {
    this.uiManager = uiManager;
    this.promptManager = promptManager;
    this.bindEvents();
    this.initialize();
  }
  
  // Bind UI events to prompt data operations.
  bindEvents() {
    UIManager.onPromptSelect(async (prompt) => {
      const inputBox = InputBoxHandler.getInputBox();
      if (!inputBox) {
        console.error('Input box not found.');
        return;
      }
      const variables = this.promptManager.extractVariables(prompt.content);
      const promptList = document.getElementById(SELECTORS.PROMPT_LIST);
      if (variables.length === 0) {
        await InputBoxHandler.insertPrompt(inputBox, prompt.content, promptList);
        UIManager.hidePromptList(promptList);
      } else {
        // Show variable input form and process variables on submission.
        UIManager.showVariableInputForm(inputBox, prompt.content, variables, promptList, async (variableValues) => {
          const processedContent = this.promptManager.replaceVariables(prompt.content, variableValues);
          await InputBoxHandler.insertPrompt(inputBox, processedContent, promptList);
          UIManager.hidePromptList(promptList);
          
          // Just rebuild the list but don't show it - will be ready for next hover
          setTimeout(() => {
            StorageManager.getPrompts().then(prompts => {
              UIManager.refreshPromptList(prompts);
            });
          }, 300);
        });
      }
    });
  }
  
  // Handle extension initialization, DOM observation, and keyboard shortcuts.
  async initialize() {
    try {
      await InputBoxHandler.waitForInputBox();
      console.log('Input box found.');
      const prompts = await StorageManager.getPrompts();
      UIManager.injectPromptManagerButton(prompts);
      
      // Set up DOM observation to reinject UI if needed.
      let observerTimeout = null;
      const observer = new MutationObserver(async (mutations) => {
        if (document.getElementById(SELECTORS.PROMPT_BUTTON_CONTAINER)) { return; }
        if (observerTimeout) clearTimeout(observerTimeout);
        observerTimeout = setTimeout(async () => {
          const inputBox = InputBoxHandler.getInputBox();
          if (inputBox && !document.getElementById(SELECTORS.PROMPT_BUTTON_CONTAINER)) {
            console.log('Reinjecting prompt manager button via MutationObserver.');
            const updatedPrompts = await StorageManager.getPrompts();
            UIManager.injectPromptManagerButton(updatedPrompts);
          }
        }, 300);
      });
      const chatContainer = document.querySelector('main') || document.body;
      observer.observe(chatContainer, { childList: true, subtree: true });
      
      // Listen for storage changes to update prompts.
      StorageManager.onChange(async (changes, area) => {
        if (area === 'local' && changes.prompts) {
          console.log('Prompts updated in storage.');
          UIManager.refreshPromptList(changes.prompts.newValue);
        }
      });
      
      // Keyboard shortcut handling.
      document.addEventListener('keydown', async (e) => {
        const shortcut = await StorageManager.getKeyboardShortcut();
        const modifierPressed = e[shortcut.modifier];
        const shiftPressed = shortcut.requiresShift ? e.shiftKey : true;
        if (modifierPressed && shiftPressed && e.key.toLowerCase() === shortcut.key.toLowerCase()) {
          e.preventDefault();
          const promptList = document.getElementById(SELECTORS.PROMPT_LIST);
          if (promptList) {
            promptList.style.display === 'none' ? UIManager.showPromptList(promptList) : UIManager.hidePromptList(promptList);
          }
        }
      });
    } catch (error) {
      console.error('Error initializing extension:', error);
    }
  }
}

// --------------------
// Initialize the Extension via PromptController
// --------------------
setTimeout(() => {
  new PromptController(UIManager, PromptManager);
}, 200);
