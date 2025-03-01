console.log("Prompt Manager content script loaded.");

// --------------------
// Global Style Definitions
// --------------------
const Colors = {
  primary: '#3375b1',
  hoverPrimary: '#285d8f',
  darkBackground: '#151b27',
  lightBackground: '#ffffff',
  darkBorder: '#2a3343',
  darkShadow: '0 4px 20px rgba(0,0,0,0.3)',
  lightShadow: '0 4px 20px rgba(0,0,0,0.15)',
  inputDarkBorder: '1px solid #444',
  inputLightBorder: '1px solid #ccc',
  inputDarkBg: '#2d2d2d',
  inputLightBg: '#f5f5f5',
  inputDarkText: '#e1e1e1',
  inputLightText: '#222222',
  buttonHoverDark: '#2a5c8f',
  buttonHoverLight: '#285d8f',
  deleteButtonDarkBg: '#333',
  deleteButtonLightBg: '#f0f0f0'
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
    backgroundRepeat: 'no-repeat',
    backgroundSize: '50%',
    backgroundPosition: 'center',
    borderRadius: '50%',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
    transition: 'all 0.3s ease',
    border: 'none',
    outline: 'none',
    cursor: 'pointer'
  },
  promptList: (dark) => ({
    position: 'absolute',
    bottom: '50px',
    right: '0',
    backgroundColor: dark ? Colors.darkBackground : Colors.lightBackground,
    border: dark ? `1px solid ${Colors.darkBorder}` : 'none',
    padding: '6px',
    borderRadius: '10px',
    boxShadow: dark ? Colors.darkShadow : Colors.lightShadow,
    display: 'none',
    width: '260px',
    zIndex: '10000',
    opacity: '0',
    transition: 'opacity 0.2s ease, transform 0.2s ease',
    backdropFilter: 'blur(10px)'
  }),
  promptListItems: (dark) => ({
    maxHeight: '350px',
    overflowY: 'auto',
    marginBottom: '8px',
    backgroundColor: dark ? Colors.darkBackground : Colors.lightBackground
  }),
  promptListItem: (dark) => ({
    borderRadius: '8px',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    fontSize: '14px',
    color: dark ? Colors.inputDarkText : '#2c3e50',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    backgroundColor: 'transparent',
    border: '1px solid transparent'
  }),
  promptListItemHover: (dark) => ({
    backgroundColor: dark ? '#0c172e' : '#f0f4f8',
    border: dark ? '1px solid #555' : '1px solid #3375b1',
    transform: 'translateY(-1px)'
  }),
  bottomMenu: (dark) => ({
    position: 'sticky',
    bottom: '0',
    backgroundColor: dark ? Colors.darkBackground : Colors.lightBackground,
    borderTop: dark ? `1px solid ${Colors.darkBorder}` : '1px solid #eee',
    padding: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  }),
  searchInput: (dark) => ({
    width: '100%',
    padding: '6px 8px',
    color: dark ? Colors.inputDarkText : Colors.inputLightText,
    fontSize: '12px',
    fontFamily: 'Helvetica, Verdana, Geneva, Tahoma, sans-serif',
    borderRadius: '4px',
    border: dark ? Colors.inputDarkBorder : Colors.inputLightBorder,
    backgroundColor: dark ? Colors.inputDarkBg : Colors.inputLightBg,
    boxSizing: 'border-box',
    height: '28px',
    lineHeight: '16px',
    outline: 'none',
    transition: 'all 0.2s ease',
    margin: '0',
    display: 'none'
  }),
  button: (dark) => ({
    padding: '8px',
    backgroundColor: dark ? '#1e4976' : Colors.primary,
    width: '100%',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    transition: 'background-color 0.2s ease'
  }),
  inputField: (dark) => ({
    width: '100%',
    padding: '8px',
    borderRadius: '6px',
    border: dark ? Colors.inputDarkBorder : Colors.inputLightBorder,
    backgroundColor: dark ? Colors.inputDarkBg : Colors.lightBackground,
    color: dark ? Colors.inputDarkText : Colors.inputLightText,
    fontSize: '12px',
    boxSizing: 'border-box'
  }),
  textareaField: (dark) => ({
    width: '100%',
    padding: '8px',
    borderRadius: '6px',
    border: dark ? Colors.inputDarkBorder : Colors.inputLightBorder,
    backgroundColor: dark ? Colors.inputDarkBg : Colors.lightBackground,
    color: dark ? Colors.inputDarkText : Colors.inputLightText,
    fontSize: '12px',
    minHeight: '100px',
    resize: 'vertical',
    boxSizing: 'border-box'
  }),
  formContainer: (dark) => ({
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    backgroundColor: dark ? Colors.darkBackground : Colors.lightBackground,
    borderRadius: '8px'
  }),
  title: (dark) => ({
    fontSize: '14px',
    fontWeight: 'bold',
    color: dark ? Colors.inputDarkText : '#333',
    marginBottom: '8px'
  }),
  menuBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    margin: '0'
  },
  iconButton: (dark) => ({
    width: '24px',
    height: '24px',
    padding: '4px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.2s ease'
  })
};

// --------------------
// Constants
// --------------------
const CLOSE_DELAY = 5000; // in milliseconds

// --------------------
// Utility Functions
// --------------------
/**
 * Creates a new element with options.
 * @param {string} tag The element tag.
 * @param {Object} options Options like id, className, styles, attributes, innerHTML.
 * @returns {HTMLElement}
 */
function createEl(tag, { id, className, styles, attributes, innerHTML } = {}) {
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
  return el;
}

/**
 * Adds a simple hover effect to an element.
 * @param {HTMLElement} element The target element.
 * @param {Object} hoverStyles The styles to apply on hover.
 */
function addHoverEffect(element, hoverStyles) {
  const originalStyles = {};
  for (const key in hoverStyles) {
    originalStyles[key] = element.style[key] || '';
  }
  element.addEventListener('mouseover', () => {
    Object.assign(element.style, hoverStyles);
  });
  element.addEventListener('mouseout', () => {
    Object.assign(element.style, originalStyles);
  });
}

/**
 * Checks if the user prefers dark mode.
 * @returns {boolean}
 */
function isDarkMode() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

// --------------------
// StorageManager Class
// --------------------
class StorageManager {
  static getData(key, defaultValue) {
    return new Promise(resolve => {
      chrome.storage.local.get(key, data => resolve(data[key] ?? defaultValue));
    });
  }
  static setData(key, value) {
    return new Promise(resolve => {
      chrome.storage.local.set({ [key]: value }, resolve);
    });
  }
  static async getPrompts() {
    return await StorageManager.getData('prompts', []);
  }
  static async savePrompt(prompt) {
    try {
      const prompts = await StorageManager.getPrompts();
      const allPrompts = [...prompts, prompt];
      
      await StorageManager.setData('prompts', allPrompts);
      console.log('Prompt saved successfully.');
      // Removed cached prompt removal code
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
// UIManager Class
// --------------------
class UIManager {
  // Injects the floating button and prompt list container into the page.
  static async injectPromptManagerButton(prompts) {
    if (document.getElementById('prompt-button-container')) {
      console.log('Button container already exists.');
      return;
    }
    const position = await StorageManager.getButtonPosition();
    const container = createEl('div', {
      id: 'prompt-button-container',
      styles: Styles.promptButtonContainer(position)
    });
    const button = createEl('button', {
      id: 'prompt-button',
      styles: Styles.promptButton,
      attributes: { title: 'Prompt Manager' }
    });
    const iconUrl = chrome.runtime.getURL('icons/icon-button.png');
    button.style.backgroundImage = `url(${iconUrl})`;
    addHoverEffect(button, { backgroundColor: isDarkMode() ? Colors.buttonHoverDark : Colors.buttonHoverLight });
    container.appendChild(button);

    // Create the prompt list using centralized styles.
    const promptList = createEl('div', {
      id: 'prompt-list',
      styles: Styles.promptList(isDarkMode())
    });
    
    container.appendChild(promptList);
    document.body.appendChild(container);
    
    if (prompts.length === 0) {
      // If no prompts exist, open the "create new prompt" view immediately.
      UIManager.showPromptCreationForm();
    } else {
      UIManager.refreshPromptList(prompts);
    }

    UIManager.attachButtonEvents(button, promptList, container);
    UIManager.makeDraggable(container);
  }

  // Sets up click and hover events for the floating button.
  static attachButtonEvents(button, promptList, container) {
    let closeTimer = null, isOpen = false;
    button.addEventListener('click', e => {
      e.stopPropagation();
      isOpen ? UIManager.hidePromptList(promptList) : UIManager.showPromptList(promptList);
      isOpen = !isOpen;
    });
    button.addEventListener('mouseenter', e => {
      e.stopPropagation();
      if (closeTimer) clearTimeout(closeTimer);
      UIManager.showPromptList(promptList);
      isOpen = true;
    });
    button.addEventListener('mouseleave', e => {
      e.stopPropagation();
      startCloseTimer(e);
    });
    promptList.addEventListener('mouseenter', () => {
      if (closeTimer) clearTimeout(closeTimer);
    });
    promptList.addEventListener('mouseleave', e => {
      startCloseTimer(e);
    });
    document.addEventListener('click', e => {
      const isMenuAction = e.target.closest('#prompt-list') || 
                          e.target.closest('.prompt-items-container') ||
                          e.target.closest('button');
      if (isOpen && !button.contains(e.target) && !promptList.contains(e.target) && !isMenuAction) {
        UIManager.hidePromptList(promptList);
        isOpen = false;
      }
    });
    function startCloseTimer(e) {
      if (closeTimer) clearTimeout(closeTimer);
      closeTimer = setTimeout(() => {
        const mouseX = e.clientX, mouseY = e.clientY;
        const buttonRect = button.getBoundingClientRect();
        const listRect = promptList.getBoundingClientRect();
        const isOverButton = (mouseX >= buttonRect.left && mouseX <= buttonRect.right &&
                              mouseY >= buttonRect.top && mouseY <= buttonRect.bottom);
        const isOverList = (mouseX >= listRect.left && mouseX <= listRect.right &&
                            mouseY >= listRect.top && mouseY <= listRect.bottom);
        if (!isOverButton && !isOverList) {
          UIManager.hidePromptList(promptList);
          isOpen = false;
        }
        closeTimer = null;
      }, CLOSE_DELAY);
    }
  }

  // Enables drag functionality on the floating button container.
  static makeDraggable(container) {
    let isDragging = false, initialX, initialY, startRight, startBottom;
    container.addEventListener('mousedown', e => {
      if (e.target.id === 'prompt-button') {
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

  // Creates the default prompt list view.
  static createPromptList(prompts) {
    const dark = isDarkMode();
    const promptList = createEl('div', {
      id: 'prompt-list',
      styles: Styles.promptList(dark)
    });

    // Create a dedicated container for prompt items.
    const promptsContainer = createEl('div', {
      className: 'prompt-items-container',
      styles: Styles.promptListItems(dark)
    });

    // Append custom scrollbar styles.
    const scrollbarStyle = createEl('style', {
      innerHTML: `
        #prompt-list > .prompt-items-container::-webkit-scrollbar { width: 6px; }
        #prompt-list > .prompt-items-container::-webkit-scrollbar-track { background: ${dark ? '#1a2235' : 'transparent'}; }
        #prompt-list > .prompt-items-container::-webkit-scrollbar-thumb { background-color: ${dark ? '#2a3343' : '#3375b1'}; border-radius: 3px; }
      `
    });
    document.head.appendChild(scrollbarStyle);

    if (prompts.length === 0) {
      const emptyStateDiv = createEl('div', {
        className: 'shortcut-container',
        innerHTML: UIManager.getEmptyStateHTML()
      });
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

  // Returns the HTML for the empty state.
  static getEmptyStateHTML() {
    return `
      <div style="display: flex; flex-direction: column; gap: 2px; font-size: 12px;">
        <div>Open prompt list buttons</div>
        <div>
          <div style="background-color: #0077B6; color: white; padding: 2px 4px; border-radius: 4px; display: inline-block; margin-bottom: 4px;">Hover/Click</div>
        </div>
        <div>Open / close prompt list</div>
        <div>
          <div style="background-color: #0077B6; color: white; padding: 2px 4px; border-radius: 4px; display: inline-block; margin-bottom: 4px;">⌘ + Shift + P or Ctrl + M</div>
        </div>
        <div>Navigate the prompt list</div>
        <div>
          <div style="background-color: #0077B6; color: white; padding: 2px 4px; border-radius: 4px; display: inline-block; margin-bottom: 4px;">↑↓</div>
        </div>
        <div>Select a prompt</div>
        <div>
          <div style="background-color: #0077B6; color: white; padding: 2px 4px; border-radius: 4px; display: inline-block; margin-bottom: 4px;">Enter</div>
        </div>
        <div>Close the prompt manager</div>
        <div>
          <div style="background-color: #0077B6; color: white; padding: 2px 4px; border-radius: 4px; display: inline-block; margin-bottom: 4px;">Esc</div>
        </div>
      </div>
    `;
  }

  // Creates a single prompt item.
  static createPromptItem(prompt) {
    const dark = isDarkMode();
    const promptItem = createEl('div', {
      styles: Styles.promptListItem(dark)
    });
    const textContainer = createEl('div', { styles: { flex: '1' } });
    textContainer.textContent = prompt.title;
    promptItem.appendChild(textContainer);
    promptItem.addEventListener('mouseover', () => {
      Object.assign(promptItem.style, Styles.promptListItemHover(dark));
    });
    promptItem.addEventListener('mouseout', () => {
      Object.assign(promptItem.style, {
        backgroundColor: 'transparent',
        border: '1px solid transparent',
        transform: 'translateY(0)'
      });
    });
    promptItem.addEventListener('click', async () => {
      const inputBox = InputBoxHandler.getInputBox();
      if (!inputBox) {
        console.error('Input box not found.');
        return;
      }
      await PromptManager.insertPrompt(inputBox, prompt.content, document.getElementById('prompt-list'));
    });
    promptItem.dataset.title = prompt.title.toLowerCase();
    promptItem.dataset.content = prompt.content.toLowerCase();
    return promptItem;
  }

  // Creates the bottom menu (search input and icon buttons).
  static createBottomMenu() {
    const dark = isDarkMode();
    const bottomMenu = createEl('div', {
      styles: Styles.bottomMenu(dark)
    });

    const searchInput = createEl('input', {
      id: 'prompt-search-input',
      attributes: { type: 'text', placeholder: 'Type to search' },
      styles: Styles.searchInput(dark)
    });

    let selectedIndex = -1;
    searchInput.addEventListener('keydown', (e) => {
      const visiblePrompts = Array.from(document.querySelectorAll('.prompt-items-container > div'))
        .filter(item => item.style.display !== 'none' && !item.classList.contains('shortcut-container'));
      
      switch(e.key) {
        case 'ArrowDown':
          e.preventDefault();
          selectedIndex = Math.min(selectedIndex + 1, visiblePrompts.length - 1);
          if (selectedIndex === -1 && visiblePrompts.length > 0) selectedIndex = 0;
          UIManager.updateSelection(visiblePrompts, selectedIndex, dark);
          break;
        case 'ArrowUp':
          e.preventDefault();
          selectedIndex = Math.max(selectedIndex - 1, -1);
          UIManager.updateSelection(visiblePrompts, selectedIndex, dark);
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
          UIManager.updateSelection(visiblePrompts, selectedIndex, dark);
          UIManager.hidePromptList(document.getElementById('prompt-list'));
          break;
      }
    });
    searchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase();
      const promptsContainer = document.querySelector('.prompt-items-container');
      if (!promptsContainer) return;
      const promptItems = promptsContainer.children;
      selectedIndex = -1;
      Array.from(promptItems).forEach(item => {
        const shouldShow = item.dataset.title.includes(searchTerm) || item.dataset.content.includes(searchTerm);
        item.style.display = shouldShow ? 'flex' : 'none';
        item.style.backgroundColor = '';
      });
    });

    const saveButton = createEl('button', {
      innerHTML: 'Save prompt',
      styles: Styles.button(dark)
    });
    addHoverEffect(saveButton, { backgroundColor: dark ? Colors.buttonHoverDark : Colors.buttonHoverLight });
    const inputBox = InputBoxHandler.getInputBox();
    if (inputBox) {
      const content = PromptManager.getInputContent(inputBox);
      saveButton.style.display = content.trim() ? 'block' : 'none';
    }
    saveButton.addEventListener('click', () => {
      const inputBox = InputBoxHandler.getInputBox();
      if (inputBox) {
        const content = PromptManager.getInputContent(inputBox);
        if (content.trim()) {
          saveButton.style.display = 'none';
          searchInput.style.display = 'none';
          const titleInputDiv = UIManager.createTitleInputDiv(content);
          document.getElementById('prompt-list').appendChild(titleInputDiv);
        } else {
          alert('Input is empty. Please enter some text before saving.');
        }
      }
    });
    const menuBar = UIManager.createMenuBar(dark);
    bottomMenu.appendChild(searchInput);
    bottomMenu.appendChild(menuBar);
    return bottomMenu;
  }

  // Creates the menu bar with icon buttons.
  static createMenuBar(dark) {
    const menuBar = createEl('div', {
      styles: Styles.menuBar
    });
    const promptListButton = UIManager.createIconButton('list', dark, () => {
      UIManager.refreshAndShowPromptList();
    });
    const messageButton = UIManager.createIconButton('message', dark, () => {
      UIManager.showPromptCreationForm();
    });
    const editButton = UIManager.createIconButton('edit', dark, () => {
      UIManager.showEditView();
    });
    const settingsButton = UIManager.createIconButton('settings', dark, e => {
      e.stopPropagation();
      UIManager.showImportExportForm();
    });
    const helpButton = UIManager.createIconButton('help', dark, e => {
      e.stopPropagation();
      UIManager.showHelp();
    });
    menuBar.append(promptListButton, messageButton, editButton, settingsButton, helpButton);
    return menuBar;
  }

  // Creates an icon button based on type.
  static createIconButton(type, dark, onClick) {
    let svgContent = '';
    // Map button types to descriptive ARIA labels.
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
        svgContent = `<svg width="14" height="14" viewBox="0 0 20 20" fill="${dark ? '#e1e1e1' : '#666'}">
                        <path d="M4 4h2v2H4V4zm0 5h2v2H4V9zm0 5h2v2H4v-2zm4-10h12v2H8V4zm0 5h12v2H8V9zm0 5h12v2H8v-2z"/>
                      </svg>`;
        break;
      case 'message':
        svgContent = `<svg width="14" height="14" viewBox="0 0 20 20" fill="${dark ? '#e1e1e1' : '#666'}">
                        <path d="M2 5.5C2 4.11929 3.11929 3 4.5 3H15.5C16.8807 3 18 4.11929 18 5.5V12.5C18 13.8807 16.8807 15 15.5 15H11.5L8 18.5L4.5 15H4.5C3.11929 15 2 13.8807 2 12.5V5.5Z"/>
                      </svg>`;
        break;
      case 'delete':
        svgContent = `<svg width="14" height="14" viewBox="0 0 20 20" fill="${dark ? '#e1e1e1' : '#666'}">
                        <path d="M6 2h8v2h4v2H2V4h4V2zm1 0h6v2H7V2zm-3 4h12l-1 12H5L4 6z"/>
                      </svg>`;
        break;
      case 'edit':
        svgContent = `<svg width="14" height="14" viewBox="0 0 20 20" fill="${dark ? '#e1e1e1' : '#666'}">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-8.793 8.793-3.536.707.707-3.536 8.794-8.792z"/>
                      </svg>`;
        break;
      case 'settings':
        svgContent = `<svg width="14" height="14" viewBox="0 0 24 24" fill="${dark ? '#e1e1e1' : '#666'}">
                        <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/>
                      </svg>`;
        break;
      case 'help':
        svgContent = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${dark ? '#e1e1e1' : '#666'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="16" x2="12" y2="12"></line>
                        <line x1="12" y1="8" x2="12" y2="8"></line>
                      </svg>`;
        break;
    }
    const btn = createEl('button', {
      styles: Styles.iconButton(dark),
      innerHTML: svgContent
    });
    addHoverEffect(btn, { backgroundColor: dark ? Colors.deleteButtonDarkBg : Colors.deleteButtonLightBg });
    btn.addEventListener('click', onClick);
    return btn;
  }

  // Shows the prompt list view (with animation) and focuses the search input.
  static showPromptList(promptList) {
    if (!promptList) return;
    const itemsContainer = promptList.querySelector('.prompt-items-container');
    if (itemsContainer) {
      itemsContainer.querySelectorAll('div').forEach(item => {
        Object.assign(item.style, {
          display: 'flex',
          padding: '2px 4px',
          margin: '4px 0',
          borderRadius: '8px',
          backgroundColor: 'transparent',
          border: '1px solid transparent'
        });
      });
    }
    promptList.style.display = 'block';
    setTimeout(() => {
      promptList.style.opacity = '1';
      promptList.style.transform = 'translateY(0)';
      UIManager.focusSearchInput();
    }, 0);
  }

  // Hides the prompt list view (with animation) and resets items' styles.
  static hidePromptList(promptList) {
    if (!promptList) return;
    promptList.style.opacity = '0';
    const searchInput = document.getElementById('prompt-search-input');
    if (searchInput) searchInput.value = '';
    setTimeout(() => {
      if (promptList) {
        promptList.style.display = 'none';
        const itemsContainer = promptList.querySelector('.prompt-items-container');
        if (itemsContainer) {
          itemsContainer.querySelectorAll('div').forEach(item => {
            Object.assign(item.style, {
              display: 'flex',
              padding: '8px 12px',
              margin: '4px 0',
              borderRadius: '8px',
              backgroundColor: 'transparent',
              border: '1px solid transparent'
            });
          });
        }
      }
    }, 300);
  }

  static buildPromptListContainer(prompts = null) {
    const promptList = document.getElementById('prompt-list');
    if (!promptList) {
      console.error('Prompt list not found.');
      return;
    }
    
    const dark = isDarkMode();
    Object.assign(promptList.style, {
      backgroundColor: dark ? Colors.darkBackground : Colors.lightBackground,
      border: dark ? `1px solid ${Colors.darkBorder}` : 'none',
      boxShadow: dark ? Colors.darkShadow : Colors.lightShadow
    });
    
    promptList.innerHTML = '';
    
    const promptsContainer = createEl('div', {
      className: 'prompt-items-container',
      styles: Styles.promptListItems(dark)
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
    const searchInput = document.getElementById('prompt-search-input');
    if (searchInput) {
      searchInput.style.display = 'block';
    }
  }

  static resetPromptListContainer() {
    UIManager.buildPromptListContainer();
  }

  static focusSearchInput() {
    const searchInput = document.getElementById('prompt-search-input');
    if (searchInput) {
      window.requestAnimationFrame(() => {
        searchInput.focus();
        searchInput.select();
      });
    }
  }

  static createTitleInputDiv(content) {
    return UIManager.createPromptCreationForm(content);
  }

  static createPromptCreationForm(prefillContent = '', showMissingNote = false) {
    const dark = isDarkMode();
    const searchInput = document.getElementById('prompt-search-input');
    if (searchInput) searchInput.style.display = 'none';
    const formContainer = createEl('div', {
      styles: Styles.formContainer(dark)
    });
    const title = createEl('div', {
      innerHTML: 'Create New Prompt',
      styles: Styles.title(dark)
    });
    const titleInput = createEl('input', {
      attributes: { placeholder: 'Prompt Title' },
      styles: Styles.inputField(dark)
    });
    const contentTextarea = createEl('textarea', {
      attributes: { placeholder: 'Enter your prompt here. Use #variablename# for dynamic content' },
      styles: Styles.textareaField(dark)
    });
    contentTextarea.value = prefillContent;
    const saveButton = createEl('button', {
      innerHTML: 'Save Prompt',
      styles: Styles.button(dark)
    });
    addHoverEffect(saveButton, { backgroundColor: dark ? Colors.buttonHoverDark : Colors.buttonHoverLight });
    const buttonContainer = createEl('div', {
      styles: { display: 'flex', gap: '8px', marginTop: '8px' }
    });
    buttonContainer.appendChild(saveButton);
    formContainer.append(title, titleInput, contentTextarea, buttonContainer);
    if (showMissingNote) {
      const missingText = createEl('div', {
        styles: {
          marginTop: '8px',
          fontSize: '12px',
          fontFamily: 'Helvetica, Verdana, Geneva, Tahoma, sans-serif',
          color: dark ? Colors.inputDarkText : '#333'
        },
        innerHTML: '<strong>Prompts missing?</strong><br>Fix available : click the extension icon in the menu bar for instructions'
      });
      formContainer.appendChild(missingText);
    }
    
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
      const prompts = await StorageManager.getPrompts();
      UIManager.refreshAndShowPromptList();
    });
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
        backgroundColor: dark ? '#1a1a1a' : Colors.lightBackground,
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: '10001',
        maxWidth: '400px',
        width: '90%'
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
    const searchInput = document.getElementById('prompt-search-input');
    if (searchInput) searchInput.style.display = 'none';
    const formContainer = createEl('div', {
      styles: Styles.formContainer(dark)
    });
    const title = createEl('div', {
      innerHTML: 'Import/Export Prompts',
      styles: Styles.title(dark)
    });
    const exportButton = createEl('button', {
      innerHTML: 'Export Prompts',
      styles: Styles.button(dark)
    });
    addHoverEffect(exportButton, { backgroundColor: dark ? Colors.buttonHoverDark : Colors.buttonHoverLight });
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
      styles: Object.assign({}, Styles.button(dark), { marginTop: '8px' })
    });
    addHoverEffect(importButton, { backgroundColor: dark ? Colors.buttonHoverDark : Colors.buttonHoverLight });
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
    formContainer.append(title, exportButton, importButton);
    return formContainer;
  }

  static async createEditView() {
    const dark = isDarkMode();
    const prompts = await StorageManager.getPrompts();
    const editContainer = createEl('div', {
      styles: Styles.formContainer(dark)
    });
    const title = createEl('div', {
      innerHTML: 'Edit Prompts',
      styles: Styles.title(dark)
    });
    const promptsContainer = createEl('div', {
      styles: {
        maxHeight: '300px',
        overflowY: 'auto',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
      }
    });
    prompts.forEach((prompt, index) => {
      const promptItem = createEl('div', {
        styles: {
          display: 'flex',
          alignItems: 'center',
          padding: '8px',
          borderRadius: '6px',
          backgroundColor: dark ? '#1E293B' : '#f5f5f5',
          width: '100%',
          boxSizing: 'border-box',
          gap: '8px'
        }
      });
      const promptTitle = createEl('div', {
        styles: { flex: '1', fontSize: '12px', color: dark ? Colors.inputDarkText : '#333' }
      });
      promptTitle.textContent = prompt.title;
      const editIcon = UIManager.createIconButton('edit', dark, () => {
        UIManager.showEditForm(prompt, index);
      });
      const deleteIcon = UIManager.createIconButton('delete', dark, () => {
        if (confirm(`Are you sure you want to delete "${prompt.title}"?`)) {
          UIManager.deletePrompt(index);
        }
      });
      promptItem.append(promptTitle, editIcon, deleteIcon);
      promptsContainer.appendChild(promptItem);
    });
    editContainer.append(title, promptsContainer);
    return editContainer;
  }

  static async showEditForm(prompt, index) {
    const dark = isDarkMode();
    const promptList = document.getElementById('prompt-list');
    if (!promptList) return;
    UIManager.resetPromptListContainer();
    const editForm = createEl('div', {
      styles: Styles.formContainer(dark)
    });
    const titleInput = createEl('input', {
      styles: Styles.inputField(dark)
    });
    titleInput.value = prompt.title;
    const contentTextarea = createEl('textarea', {
      styles: Styles.textareaField(dark)
    });
    contentTextarea.value = prompt.content;
    const saveButton = createEl('button', {
      innerHTML: 'Save Changes',
      styles: Styles.button(dark)
    });
    saveButton.addEventListener('click', async (e) => {
      e.stopPropagation();
      const prompts = await StorageManager.getPrompts();
      prompts[index] = {
        title: titleInput.value.trim(),
        content: contentTextarea.value.trim()
      };
      await StorageManager.setData('prompts', prompts);
      UIManager.showEditView();
    });
    editForm.append(titleInput, contentTextarea, saveButton);
    editForm.addEventListener('click', e => e.stopPropagation());
    promptList.insertBefore(editForm, promptList.firstChild);
  }

  static async deletePrompt(index) {
    const prompts = await StorageManager.getPrompts();
    prompts.splice(index, 1);
    await StorageManager.setData('prompts', prompts);
    const promptList = document.getElementById('prompt-list');
    if (promptList) {
      UIManager.resetPromptListContainer();
    }
  }

  static refreshAndShowPromptList() {
    (async () => {
      const prompts = await StorageManager.getPrompts();
      UIManager.refreshPromptList(prompts);
      const promptList = document.getElementById('prompt-list');
      if (promptList) UIManager.showPromptList(promptList);
    })();
  }

  static async showPromptCreationForm() {
    const promptList = document.getElementById('prompt-list');
    if (!promptList) return;
    UIManager.resetPromptListContainer();
    const searchInput = promptList.querySelector('#prompt-search-input');
    if (searchInput) {
      searchInput.style.display = 'none';
    }
    const prompts = await StorageManager.getPrompts();
    const creationForm = UIManager.createPromptCreationForm('', prompts.length === 0);
    promptList.insertBefore(creationForm, promptList.firstChild);
    const titleInput = creationForm.querySelector('input');
    if (titleInput) titleInput.focus();
  }

  static showImportExportForm() {
    const promptList = document.getElementById('prompt-list');
    if (!promptList) return;
    UIManager.resetPromptListContainer();
    const importExportForm = UIManager.createImportExportForm();
    promptList.insertBefore(importExportForm, promptList.firstChild);
  }

  static showEditView() {
    const promptList = document.getElementById('prompt-list');
    if (!promptList) return;
    UIManager.resetPromptListContainer();
    (async () => {
      const editView = await UIManager.createEditView();
      promptList.insertBefore(editView, promptList.firstChild);
    })();
  }

  static showHelp() {
    const promptList = document.getElementById('prompt-list');
    if (!promptList) return;
    UIManager.resetPromptListContainer();
    const dark = isDarkMode();
    const helpContainer = createEl('div', {
      styles: Styles.formContainer(dark)
    });
    const title = createEl('div', {
      innerHTML: 'Keyboard Shortcuts',
      styles: Styles.title(dark)
    });
    const content = createEl('div', {
      innerHTML: `
        <div style="display: flex; flex-direction: column; gap: 2px; font-size: 12px;">
          <div>Open prompt list buttons</div>
          <div>
            <div style="background-color: #0077B6; color: white; padding: 2px 4px; border-radius: 4px; display: inline-block; margin-bottom: 4px;">Hover/Click</div>
          </div>
          <div>Open / close prompt list</div>
          <div>
            <div style="background-color: #0077B6; color: white; padding: 2px 4px; border-radius: 4px; display: inline-block; margin-bottom: 4px;">⌘ + Shift + P or Ctrl + M</div>
          </div>
          <div>Navigate the prompt list</div>
          <div>
            <div style="background-color: #0077B6; color: white; padding: 2px 4px; border-radius: 4px; display: inline-block; margin-bottom: 4px;">Arrow Keys + Enter to submit</div>
          </div>
          <div>Close the prompt manager</div>
          <div>
            <div style="background-color: #0077B6; color: white; padding: 2px 4px; border-radius: 4px; display: inline-block; margin-bottom: 4px;">Esc</div>
          </div>
        </div>
      `
    });
    helpContainer.append(title, content);
    promptList.insertBefore(helpContainer, promptList.firstChild);
  }

  static updateSelection(visiblePrompts, selectedIndex, dark = isDarkMode()) {
    visiblePrompts.forEach((item, index) => {
      Object.assign(item.style, {
        backgroundColor: 'transparent',
        border: '1px solid transparent',
        transform: 'translateY(0)'
      });
      
      if (index === selectedIndex) {
        Object.assign(item.style, Styles.promptListItemHover(dark));
        
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

  // method to show variable input form
  static showVariableInputForm(inputBox, promptContent, variables, promptList) {
    promptList.innerHTML = '';
    
    const dark = isDarkMode();
    const formContainer = createEl('div', {
      styles: Styles.formContainer(dark)
    });
    
    const title = createEl('div', {
      innerHTML: 'Variables',
      styles: Styles.title(dark)
    });
    
    formContainer.appendChild(title);
    
    const variablesContainer = createEl('div', {
      styles: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        maxHeight: '300px',
        overflowY: 'auto',
        backgroundColor: dark ? Colors.darkBackground : Colors.lightBackground
      }
    });
    
    const variableValues = {};
    variables.forEach(variable => {
      const row = createEl('div', {
        styles: {
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }
      });
      
      const label = createEl('label', {
        innerHTML: variable,
        styles: {
          fontSize: '12px',
          color: dark ? Colors.inputDarkText : '#333',
          fontWeight: 'bold'
        }
      });
      
      const input = createEl('input', {
        attributes: { 
          type: 'text',
          placeholder: `${variable} value`
        },
        styles: Styles.inputField(dark)
      });
      input.addEventListener('input', () => {
        variableValues[variable] = input.value;
      });
      
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          submitButton.click();
        }
      });
      
      row.append(label, input);
      variablesContainer.appendChild(row);
      
      variableValues[variable] = '';
    });
    
    formContainer.appendChild(variablesContainer);
    
    const buttonsContainer = createEl('div', {
      styles: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }
    });
    
    const submitButton = createEl('button', {
      innerHTML: 'Submit',
      styles: Styles.button(isDarkMode())
    });
    
    const returnButton = createEl('button', {
      innerHTML: 'Back',
      styles: Object.assign({}, Styles.button(isDarkMode()), { backgroundColor: isDarkMode() ? Colors.deleteButtonDarkBg : Colors.deleteButtonLightBg, marginTop: '4px', color: isDarkMode() ? Colors.inputDarkText : '#333' })
    });
    
    addHoverEffect(submitButton, { backgroundColor: isDarkMode() ? Colors.buttonHoverDark : Colors.buttonHoverLight });
    addHoverEffect(returnButton, { backgroundColor: isDarkMode() ? '#444' : '#ccc' });
    
    submitButton.addEventListener('click', () => {
      const processedContent = PromptManager.replaceVariables(promptContent, variableValues);
      const fakePrompt = {
        title: "Variable Prompt", 
        content: processedContent  
      };
      const promptItem = UIManager.createPromptItem(fakePrompt);
      promptItem.click();
      UIManager.hidePromptList(promptList);
      setTimeout(() => {
        StorageManager.getPrompts().then(prompts => {
          UIManager.refreshPromptList(prompts);
        });
      }, 400);
    });
    
    returnButton.addEventListener('click', () => {
      UIManager.refreshAndShowPromptList();
    });
    
    buttonsContainer.append(submitButton, returnButton);
    formContainer.appendChild(buttonsContainer);
    promptList.appendChild(formContainer);
    UIManager.showPromptList(promptList);
    const firstInput = variablesContainer.querySelector('input');
    if (firstInput) {
      firstInput.focus();
    }
  }
}

// --------------------
// PromptManager Class
// --------------------
class PromptManager {
  static initialized = false;
  
  static async initialize() {
    if (PromptManager.initialized) {
      console.log('PromptManager already initialized, skipping.');
      return;
    }
    
    try {
      PromptManager.initialized = true;
      
      await InputBoxHandler.waitForInputBox();
      console.log('Input box found.');
      // Removed checkForCachedPrompt call
      
      const prompts = await StorageManager.getPrompts();
      UIManager.injectPromptManagerButton(prompts);
      
      let observerTimeout = null;
      const observer = new MutationObserver(async (mutations) => {
        if (document.getElementById('prompt-button-container')) {
          return;
        }
        if (observerTimeout) clearTimeout(observerTimeout);
        observerTimeout = setTimeout(async () => {
          const inputBox = InputBoxHandler.getInputBox();
          if (inputBox && !document.getElementById('prompt-button-container')) {
            console.log('Reinjecting prompt manager button via MutationObserver.');
            const updatedPrompts = await StorageManager.getPrompts();
            UIManager.injectPromptManagerButton(updatedPrompts);
          }
        }, 300);
      });
      
      const chatContainer = document.querySelector('main') || document.body;
      observer.observe(chatContainer, { childList: true, subtree: true });
      
      StorageManager.onChange(async (changes, area) => {
        if (area === 'local' && changes.prompts) {
          console.log('Prompts updated in storage.');
          UIManager.refreshPromptList(changes.prompts.newValue);
        }
      });
      
      document.addEventListener('keydown', async (e) => {
        const shortcut = await StorageManager.getKeyboardShortcut();
        const modifierPressed = e[shortcut.modifier];
        const shiftPressed = shortcut.requiresShift ? e.shiftKey : true;
        if (modifierPressed && shiftPressed && e.key.toLowerCase() === shortcut.key.toLowerCase()) {
          e.preventDefault();
          const promptList = document.getElementById('prompt-list');
          if (promptList) {
            promptList.style.display === 'none' ? UIManager.showPromptList(promptList) : UIManager.hidePromptList(promptList);
          }
        }
      });
    } catch (error) {
      console.error('Error initializing PromptManager:', error);
      PromptManager.initialized = false;
    }
  }
  
  static async insertPrompt(inputBox, content, promptList) {
    const variables = PromptManager.extractVariables(content);
    
    if (variables.length === 0) {
      await InputBoxHandler.insertPrompt(inputBox, content, promptList);
    } else {
      UIManager.showVariableInputForm(inputBox, content, variables, promptList);
    }
  }
  
  static getInputContent(inputBox) {
    return InputBoxHandler.getInputContent(inputBox);
  }
  
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
}

// --------------------
// Initialize the Prompt Manager
// --------------------
setTimeout(() => {
  PromptManager.initialize();
}, 200);

// Add custom style for input focus
const style = document.createElement('style');
style.textContent = `
  #prompt-list input:focus {
    border-color: ${isDarkMode() ? '#3375b1' : '#3375b1'} !important;
    box-shadow: 0 0 0 1px ${isDarkMode() ? 'rgba(51, 117, 177, 0.4)' : 'rgba(51, 117, 177, 0.2)'} !important;
    outline: none !important;
  }
`;
document.head.appendChild(style);
