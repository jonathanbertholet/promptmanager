// content.js
console.log("Prompt Manager content script loaded.");

// --------------------
// Constants
// --------------------
const CHROME_STORAGE_LIMIT = 10485760; // 10 MB 
const CHROME_STORAGE_ITEM_LIMIT = 10485760; // (Set as needed)
const CLOSE_DELAY = 1000; // in milliseconds

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
  static cachePrompt(prompt) {
    window.localStorage.setItem('cachedPrompt', JSON.stringify(prompt));
  }
  static async savePrompt(prompt) {
    try {
      const prompts = await StorageManager.getPrompts();
      const allPrompts = [...prompts, prompt];
      const totalSize = new TextEncoder().encode(JSON.stringify(allPrompts)).length;
      
      if (totalSize > CHROME_STORAGE_LIMIT) {
        StorageManager.cachePrompt(prompt);
        throw new Error(`Total storage limit exceeded. Used ${Math.round(totalSize/1024)}KB of ${Math.round(CHROME_STORAGE_LIMIT/1024)}KB.`);
      }
      const promptSize = new TextEncoder().encode(JSON.stringify(prompt)).length;
      if (promptSize > CHROME_STORAGE_ITEM_LIMIT) {
        StorageManager.cachePrompt(prompt);
        throw new Error(`Individual prompt size exceeded. Used ${Math.round(promptSize/1024)}KB (limit: ${Math.round(CHROME_STORAGE_ITEM_LIMIT/1024)}KB).`);
      }
      
      await StorageManager.setData('prompts', allPrompts);
      console.log('Prompt saved successfully.');
      window.localStorage.removeItem('cachedPrompt');
      return { success: true };
    } catch (error) {
      console.error('Error saving prompt:', error);
      const errorMessage = error.message.includes('QUOTA_BYTES_PER_ITEM')
        ? 'Storage quota exceeded. Reduce prompt size or remove some prompts.'
        : error.message;
      return { success: false, error: errorMessage };
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
  static async getStorageUsage() {
    const prompts = await StorageManager.getPrompts();
    const used = new TextEncoder().encode(JSON.stringify(prompts)).length;
    const total = CHROME_STORAGE_LIMIT;
    const percentage = Math.round((used / total) * 100);
    return { used, total, percentage };
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
      styles: {
        position: 'fixed',
        zIndex: '9999',
        bottom: `${position.y}px`,
        right: `${position.x}px`,
        width: '40px',
        height: '40px',
        userSelect: 'none',
        cursor: 'move'
      }
    });
    const button = createEl('button', {
      id: 'prompt-button',
      styles: {
        width: '100%',
        height: '100%',
        backgroundColor: '#3375b1',
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
      attributes: { title: 'Prompt Manager' }
    });
    const iconUrl = chrome.runtime.getURL('icons/icon-button.png');
    button.style.backgroundImage = `url(${iconUrl})`;
    addHoverEffect(button, { backgroundColor: '#285d8f' });
    container.appendChild(button);

    // Add tooltip that shows on first load
    const hasSeenTooltip = await StorageManager.getData('hasSeenTooltip', false);
    if (!hasSeenTooltip) {
      const tooltip = createEl('div', {
        id: 'prompt-tooltip',
        innerHTML: 'Hover to start',
        styles: {
          position: 'absolute',
          top: '-40px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#3375b1',
          color: 'white',
          padding: '6px 12px',
          borderRadius: '16px',
          fontSize: '12px',
          fontWeight: 'bold',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
          whiteSpace: 'nowrap',
          opacity: '1',
          transition: 'opacity 0.3s ease',
          pointerEvents: 'none',
          zIndex: '10000'
        }
      });
      
      // Add a small triangle pointer at the bottom of the tooltip
      const tooltipPointer = createEl('div', {
        styles: {
          position: 'absolute',
          bottom: '-6px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '0',
          height: '0',
          borderLeft: '6px solid transparent',
          borderRight: '6px solid transparent',
          borderTop: '6px solid #3375b1'
        }
      });
      
      tooltip.appendChild(tooltipPointer);
      container.appendChild(tooltip);
      
      // Hide tooltip on first hover and save that user has seen it
      button.addEventListener('mouseenter', async () => {
        const tooltip = document.getElementById('prompt-tooltip');
        if (tooltip) {
          tooltip.style.opacity = '0';
          setTimeout(() => {
            if (tooltip && tooltip.parentNode) {
              tooltip.parentNode.removeChild(tooltip);
            }
          }, 300);
          await StorageManager.setData('hasSeenTooltip', true);
        }
      }, { once: true });
    }

    // Create the prompt list using refreshPromptList instead of createPromptList
    const promptList = createEl('div', {
      id: 'prompt-list',
      styles: {
        position: 'absolute',
        bottom: '50px',
        right: '0',
        backgroundColor: isDarkMode() ? '#151b27' : '#ffffff',
        border: isDarkMode() ? '1px solid #2a3343' : 'none',
        padding: '6px',
        borderRadius: '10px',
        boxShadow: isDarkMode() ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(0,0,0,0.15)',
        display: 'none',
        width: '260px',
        zIndex: '10000',
        opacity: '0',
        transition: 'opacity 0.2s ease, transform 0.2s ease',
        backdropFilter: 'blur(10px)'
      }
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
      // Add check for menu items and their containers
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
      styles: {
        position: 'absolute',
        bottom: '50px',
        right: '0',
        backgroundColor: dark ? '#151b27' : '#ffffff',
        border: dark ? '1px solid #2a3343' : 'none',
        padding: '6px',
        borderRadius: '10px',
        boxShadow: dark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(0,0,0,0.15)',
        display: 'none',
        width: '260px',
        zIndex: '10000',
        opacity: '0',
        transform: 'translateY(20px)',
        transition: 'opacity 0.2s ease, transform 0.2s ease',
        backdropFilter: 'blur(10px)'
      }
    });

    // Create a dedicated container for prompt items.
    const promptsContainer = createEl('div', {
      className: 'prompt-items-container',
      styles: {
        maxHeight: '350px',
        overflowY: 'auto',
        marginBottom: '8px',
        scrollbarWidth: 'thin',
        scrollbarColor: '#3375b1 transparent'
      }
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
      <div style="display: flex; flex-direction: column; gap: 2px;">
        <div style="font-size: 12px;">Open prompt list buttons</div>
        <div style="font-size: 12px;">
          <div style="background-color: #0077B6; color: white; padding: 2px 4px; border-radius: 4px; display: inline-block; margin-bottom: 4px;">Hover/Click</div>
        </div>
        <div style="font-size: 12px;">Open / close prompt list</div>
        <div style="font-size: 12px;">
          <div style="background-color: #0077B6; color: white; padding: 2px 4px; border-radius: 4px; display: inline-block; margin-bottom: 4px;">⌘ + Shift + P or Ctrl + M</div>
        </div>
        <div style="font-size: 12px;">Navigate the prompt list</div>
        <div style="font-size: 12px;">
          <div style="background-color: #0077B6; color: white; padding: 2px 4px; border-radius: 4px; display: inline-block; margin-bottom: 4px;">↑↓</div>
        </div>
        <div style="font-size: 12px;">Select a prompt</div>
        <div style="font-size: 12px;">
          <div style="background-color: #0077B6; color: white; padding: 2px 4px; border-radius: 4px; display: inline-block; margin-bottom: 4px;">Enter</div>
        </div>
        <div style="font-size: 12px;">Close the prompt manager</div>
        <div style="font-size: 12px;">
          <div style="background-color: #0077B6; color: white; padding: 2px 4px; border-radius: 4px; display: inline-block; margin-bottom: 4px;">Esc</div>
        </div>
      </div>
    `;
  }

  // Creates a single prompt item.
  static createPromptItem(prompt) {
    const dark = isDarkMode();
    const promptItem = createEl('div', {
      styles: {
        borderRadius: '8px',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        fontSize: '14px',
        color: dark ? '#e1e1e1' : '#2c3e50',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        backgroundColor: 'transparent',
        border: '1px solid transparent'
      }
    });
    const textContainer = createEl('div', { styles: { flex: '1' } });
    textContainer.textContent = prompt.title;
    promptItem.appendChild(textContainer);
    promptItem.addEventListener('mouseover', () => {
      Object.assign(promptItem.style, {
        backgroundColor: dark ? '#0c172e' : '#f0f4f8',
        border: dark ? '1px solid #555' : '1px solid #3375b1',
        transform: 'translateY(-1px)'
      });
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
      styles: {
        position: 'sticky',
        bottom: '0',
        backgroundColor: dark ? '#151b27' : '#fff',
        borderTop: dark ? '1px solid #2a3343' : '1px solid #eee',
        padding: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }
    });

    // Create search input but don't append it yet - it will be managed by the views
    const searchInput = createEl('input', {
      id: 'prompt-search-input',
      attributes: { type: 'text', placeholder: 'Type to search' },
      styles: {
        width: '100%',
        padding: '6px 8px',
        color: dark ? '#e1e1e1' : '#222222',
        fontSize: '12px',
        fontFamily: 'Helvetica, Verdana, Geneva, Tahoma, sans-serif',
        borderRadius: '4px',
        border: dark ? '1px solid #444' : '1px solid #ccc',
        backgroundColor: dark ? '#2d2d2d' : '#f5f5f5',
        boxSizing: 'border-box',
        height: '28px',
        lineHeight: '16px',
        outline: 'none',
        transition: 'all 0.2s ease',
        margin: '0',
        display: 'none' // Hide by default
      }
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
      styles: {
        width: '100%',
        padding: '5px',
        backgroundColor: dark ? '#1e4976' : '#3375b1',
        fontSize: '12px',
        fontFamily: 'Helvetica, Verdana, Geneva, Tahoma, sans-serif',
        color: '#ffffff',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        marginBottom: '8px',
        display: 'none',
        transition: 'background-color 0.2s ease'
      }
    });
    addHoverEffect(saveButton, { backgroundColor: dark ? '#2a5c8f' : '#285d8f' });
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
      styles: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        margin: '0'
      }
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
      styles: {
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
      },
      innerHTML: svgContent
    });
    addHoverEffect(btn, { backgroundColor: dark ? '#333' : '#f0f0f0' });
    btn.addEventListener('click', onClick);
    return btn;
  }

  // Shows the prompt list view (with animation) and focuses the search input.
  static showPromptList(promptList) {
    if (!promptList) return;
    // Reset the default structure if needed.
    const itemsContainer = promptList.querySelector('.prompt-items-container');
    if (itemsContainer) {
      // Reset any inline styles for items.
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

  // NEW HELPER: Build (or rebuild) the prompt list container.
  // If an array of prompts is provided, it will add the prompt items.
  static buildPromptListContainer(prompts = null) {
    const promptList = document.getElementById('prompt-list');
    if (!promptList) {
      console.error('Prompt list not found.');
      return;
    }
    
    // Set dark mode styling for the prompt list container itself
    const dark = isDarkMode();
    Object.assign(promptList.style, {
      backgroundColor: dark ? '#151b27' : '#ffffff',
      border: dark ? '1px solid #2a3343' : 'none',
      boxShadow: dark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(0,0,0,0.15)'
    });
    
    // Clear the container.
    promptList.innerHTML = '';
    
    // Create the container for prompt items with proper dark mode
    const promptsContainer = createEl('div', {
      className: 'prompt-items-container',
      styles: {
        maxHeight: '350px',
        overflowY: 'auto',
        marginBottom: '8px',
        backgroundColor: dark ? '#151b27' : '#ffffff'
      }
    });
    
    // If prompts are provided, populate the container.
    if (Array.isArray(prompts)) {
      prompts.forEach(prompt => {
        const promptItem = UIManager.createPromptItem(prompt);
        promptsContainer.appendChild(promptItem);
      });
    }
    promptList.appendChild(promptsContainer);
    // Append the bottom menu.
    promptList.appendChild(UIManager.createBottomMenu());
  }

  // UPDATED: Refreshes the prompt list using the new builder.
  static refreshPromptList(prompts) {
    UIManager.buildPromptListContainer(prompts);
    // Show search input when in prompt list view.
    const searchInput = document.getElementById('prompt-search-input');
    if (searchInput) {
      searchInput.style.display = 'block';
    }
  }

  // UPDATED: Resets the prompt list container using the new builder.
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

  // Placeholder: delegates to createPromptCreationForm.
  static createTitleInputDiv(content) {
    return UIManager.createPromptCreationForm(content);
  }

  static createPromptCreationForm(prefillContent = '', showMissingNote = false) {
    const dark = isDarkMode();
    const searchInput = document.getElementById('prompt-search-input');
    if (searchInput) searchInput.style.display = 'none';
    const formContainer = createEl('div', {
      styles: {
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        backgroundColor: dark ? '#151b27' : '#ffffff',
        borderRadius: '8px'
      }
    });
    const title = createEl('div', {
      innerHTML: 'Create New Prompt',
      styles: {
        fontSize: '14px',
        fontWeight: 'bold',
        color: dark ? '#e1e1e1' : '#333',
        marginBottom: '8px'
      }
    });
    const titleInput = createEl('input', {
      attributes: { placeholder: 'Prompt Title' },
      styles: {
        width: '100%',
        padding: '8px',
        borderRadius: '6px',
        border: dark ? '1px solid #444' : '1px solid #ccc',
        backgroundColor: dark ? '#2d2d2d' : '#ffffff',
        color: dark ? '#e1e1e1' : '#222222',
        fontSize: '12px',
        boxSizing: 'border-box'
      }
    });
    const contentTextarea = createEl('textarea', {
      attributes: { placeholder: 'Enter your prompt here. Use #variablename# for dynamic content' },
      styles: {
        width: '100%',
        padding: '8px',
        borderRadius: '6px',
        border: dark ? '1px solid #444' : '1px solid #ccc',
        backgroundColor: dark ? '#2d2d2d' : '#ffffff',
        color: dark ? '#e1e1e1' : '#222222',
        fontSize: '12px',
        minHeight: '100px',
        resize: 'vertical',
        boxSizing: 'border-box'
      }
    });
    contentTextarea.value = prefillContent;
    const saveButton = createEl('button', {
      innerHTML: 'Save Prompt',
      styles: {
        padding: '8px',
        backgroundColor: dark ? '#1e4976' : '#3375b1',
        width: '100%',
        color: '#ffffff',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '12px',
        transition: 'background-color 0.2s ease'
      }
    });
    addHoverEffect(saveButton, { backgroundColor: dark ? '#2a5c8f' : '#285d8f' });
    const buttonContainer = createEl('div', {
      styles: {
        display: 'flex',
        gap: '8px',
        marginTop: '8px'
      }
    });
    buttonContainer.appendChild(saveButton);
    formContainer.append(title, titleInput, contentTextarea, buttonContainer);
    if (showMissingNote) {
      const missingText = createEl('div', {
        styles: {
          marginTop: '8px',
          fontSize: '12px',
          fontFamily: 'Helvetica, Verdana, Geneva, Tahoma, sans-serif',
          color: dark ? '#e1e1e1' : '#333'
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
        backgroundColor: dark ? '#1a1a1a' : '#ffffff',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: '10001',
        maxWidth: '400px',
        width: '90%'
      }
    });
    StorageManager.getStorageUsage().then(usage => {
      dialog.innerHTML = `
        <h3 style="margin-top: 0; color: ${dark ? '#e1e1e1' : '#333'}">Unable to Save Prompt</h3>
        <p style="color: ${dark ? '#e1e1e1' : '#333'}">${errorMsg}</p>
        <div style="margin: 15px 0; padding: 10px; background: ${dark ? '#2a2a2a' : '#f5f5f5'}; border-radius: 4px;">
          <p style="color: ${dark ? '#e1e1e1' : '#333'}; margin: 0 0 8px 0;">Storage Usage: ${usage.percentage}%</p>
          <div style="height: 8px; background: ${dark ? '#444' : '#ddd'}; border-radius: 4px; overflow: hidden;">
            <div style="width: ${usage.percentage}%; height: 100%; background: ${usage.percentage > 90 ? '#ff4444' : '#3375b1'}; transition: width 0.3s ease;"></div>
          </div>
          <p style="color: ${dark ? '#999' : '#666'}; font-size: 12px; margin: 8px 0 0 0;">${(usage.used / 1024).toFixed(1)}KB used of ${(usage.total / 1024).toFixed(1)}KB total</p>
          <p style="color: ${dark ? '#999' : '#666'}; font-size: 12px; margin: 4px 0 0 0;">Maximum prompt size: 8KB</p>
        </div>
        <p style="color: ${dark ? '#e1e1e1' : '#333'}">Your prompt has been temporarily cached. You can try:</p>
        <ul style="color: ${dark ? '#e1e1e1' : '#333'}">
          <li>Shorten the prompt content</li>
          <li>Split the prompt into smaller prompts</li>
        </ul>
        <div style="text-align: right; margin-top: 15px;">
          <button id="dialog-close" style="padding: 8px 16px; background-color: ${dark ? '#1e4976' : '#3375b1'}; color: #ffffff; border: none; border-radius: 6px; cursor: pointer;">Close</button>
        </div>
      `;
      document.body.appendChild(dialog);
      dialog.querySelector('#dialog-close').onclick = () => dialog.remove();
    });
  }

  static createImportExportForm() {
    const dark = isDarkMode();
    const searchInput = document.getElementById('prompt-search-input');
    if (searchInput) searchInput.style.display = 'none';
    const formContainer = createEl('div', {
      styles: {
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        backgroundColor: dark ? '#151b27' : '#ffffff',
        borderRadius: '8px'
      }
    });
    const title = createEl('div', {
      innerHTML: 'Import/Export Prompts',
      styles: {
        fontSize: '14px',
        fontWeight: 'bold',
        color: dark ? '#e1e1e1' : '#333',
        marginBottom: '8px'
      }
    });
    const exportButton = createEl('button', {
      innerHTML: 'Export Prompts',
      styles: {
        padding: '8px',
        backgroundColor: dark ? '#1e4976' : '#3375b1',
        color: '#ffffff',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '12px',
        transition: 'background-color 0.2s ease',
        width: '100%'
      }
    });
    addHoverEffect(exportButton, { backgroundColor: dark ? '#2a5c8f' : '#285d8f' });
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
      styles: {
        padding: '8px',
        backgroundColor: dark ? '#1e4976' : '#3375b1',
        color: '#ffffff',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '12px',
        transition: 'background-color 0.2s ease',
        width: '100%',
        marginTop: '8px'
      }
    });
    addHoverEffect(importButton, { backgroundColor: dark ? '#2a5c8f' : '#285d8f' });
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
      styles: {
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        width: '100%',
        boxSizing: 'border-box',
        backgroundColor: dark ? '#151b27' : '#ffffff',
        borderRadius: '8px'
      }
    });
    const title = createEl('div', {
      innerHTML: 'Edit Prompts',
      styles: {
        fontSize: '14px',
        fontWeight: 'bold',
        color: dark ? '#e1e1e1' : '#333',
        marginBottom: '8px',
        width: '100%'
      }
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
        styles: { flex: '1', fontSize: '12px', color: dark ? '#e1e1e1' : '#333' }
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
    // Reset container first to ensure a clean slate.
    UIManager.resetPromptListContainer();
    const editForm = createEl('div', {
      styles: {
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        backgroundColor: dark ? '#151b27' : '#ffffff',
        borderRadius: '8px'
      }
    });
    const titleInput = createEl('input', {
      styles: {
        width: '100%',
        padding: '8px',
        borderRadius: '6px',
        border: dark ? '1px solid #444' : '1px solid #ccc',
        backgroundColor: dark ? '#2d2d2d' : '#ffffff',
        color: dark ? '#e1e1e1' : '#222222',
        fontSize: '12px'
      }
    });
    titleInput.value = prompt.title;
    const contentTextarea = createEl('textarea', {
      styles: {
        width: '100%',
        padding: '8px',
        borderRadius: '6px',
        border: dark ? '1px solid #444' : '1px solid #ccc',
        backgroundColor: dark ? '#2d2d2d' : '#ffffff',
        color: dark ? '#e1e1e1' : '#222222',
        fontSize: '12px',
        minHeight: '100px',
        resize: 'vertical'
      }
    });
    contentTextarea.value = prompt.content;
    const saveButton = createEl('button', {
      innerHTML: 'Save Changes',
      styles: {
        padding: '8px',
        backgroundColor: dark ? '#1e4976' : '#3375b1',
        color: '#ffffff',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '12px'
      }
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
      // Reset to the default view after deletion.
      UIManager.resetPromptListContainer();
    }
  }

  static async checkForCachedPrompt() {
    const cached = window.localStorage.getItem('cachedPrompt');
    if (cached) {
      try {
        const prompt = JSON.parse(cached);
        const dark = isDarkMode();
        const dialog = createEl('div', {
          styles: {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: dark ? '#1a1a1a' : '#ffffff',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: '10001',
            maxWidth: '400px',
            width: '90%'
          }
        });
        dialog.innerHTML = `
          <h3 style="margin-top: 0; color: ${dark ? '#e1e1e1' : '#333'}">Recovered Unsaved Prompt</h3>
          <p style="color: ${dark ? '#e1e1e1' : '#333'}">A prompt that couldn't be saved was found:</p>
          <p style="color: ${dark ? '#e1e1e1' : '#333'}"><strong>Title:</strong> ${prompt.title}</p>
          <div style="text-align: right; margin-top: 15px;">
            <button id="dialog-retry" style="padding: 8px 16px; background-color: ${dark ? '#1e4976' : '#3375b1'}; color: #ffffff; border: none; border-radius: 6px; cursor: pointer; margin-right: 8px;">Try Saving Again</button>
            <button id="dialog-discard" style="padding: 8px 16px; background-color: ${dark ? '#444' : '#ddd'}; color: ${dark ? '#fff' : '#333'}; border: none; border-radius: 6px; cursor: pointer;">Discard</button>
          </div>
        `;
        document.body.appendChild(dialog);
        dialog.querySelector('#dialog-retry').onclick = async () => {
          dialog.remove();
          const promptList = document.getElementById('prompt-list');
          if (promptList) {
            UIManager.resetPromptListContainer();
            const creationForm = UIManager.createPromptCreationForm();
            promptList.insertBefore(creationForm, promptList.firstChild);
            const titleInput = creationForm.querySelector('input');
            const contentTextarea = creationForm.querySelector('textarea');
            if (titleInput && contentTextarea) {
              titleInput.value = prompt.title;
              contentTextarea.value = prompt.content;
            }
          }
        };
        dialog.querySelector('#dialog-discard').onclick = () => {
          window.localStorage.removeItem('cachedPrompt');
          dialog.remove();
        };
      } catch (error) {
        console.error('Error handling cached prompt:', error);
        window.localStorage.removeItem('cachedPrompt');
      }
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
    // Reset the container to its default structure.
    UIManager.resetPromptListContainer();
    // Hide the search input since we are in creation mode.
    const searchInput = promptList.querySelector('#prompt-search-input');
    if (searchInput) {
      searchInput.style.display = 'none';
    }
    // Check stored prompts to see if any exist.
    const prompts = await StorageManager.getPrompts();
    // Pass a flag to display the extra "missing prompts" text only if there are no prompts.
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
      styles: {
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        backgroundColor: dark ? '#151b27' : '#ffffff',
        borderRadius: '8px'
      }
    });
    const title = createEl('div', {
      innerHTML: 'Keyboard Shortcuts',
      styles: {
        fontSize: '14px',
        fontWeight: 'bold',
        color: dark ? '#e1e1e1' : '#333',
        marginBottom: '8px'
      }
    });
    const content = createEl('div', {
      innerHTML: `
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <div style="font-size: 12px;">Open prompt list buttons</div>
          <div style="font-size: 12px;">
            <div style="background-color: #0077B6; color: white; padding: 2px 4px; border-radius: 4px; display: inline-block; margin-bottom: 4px;">Hover/Click</div>
          </div>
          <div style="font-size: 12px;">Open / close prompt list</div>
          <div style="font-size: 12px;">
            <div style="background-color: #0077B6; color: white; padding: 2px 4px; border-radius: 4px; display: inline-block; margin-bottom: 4px;">⌘ + Shift + P or Ctrl + M</div>
          </div>
          <div style="font-size: 12px;">Navigate the prompt list</div>
          <div style="font-size: 12px;">
            <div style="background-color: #0077B6; color: white; padding: 2px 4px; border-radius: 4px; display: inline-block; margin-bottom: 4px;">Enter</div>
          </div>
          <div style="font-size: 12px;">Close the prompt manager</div>
          <div style="font-size: 12px;">
            <div style="background-color: #0077B6; color: white; padding: 2px 4px; border-radius: 4px; display: inline-block; margin-bottom: 4px;">Esc</div>
          </div>
        </div>
      `
    });
    helpContainer.append(title, content);
    promptList.insertBefore(helpContainer, promptList.firstChild);
  }

  static updateSelection(visiblePrompts, selectedIndex, dark = isDarkMode()) {
    // Remove highlight from all items
    visiblePrompts.forEach((item, index) => {
      Object.assign(item.style, {
        backgroundColor: 'transparent',
        border: '1px solid transparent',
        transform: 'translateY(0)'
      });
      
      // Add highlight to selected item
      if (index === selectedIndex) {
        Object.assign(item.style, {
          backgroundColor: dark ? '#0c172e' : '#f0f4f8',
          border: dark ? '1px solid #555' : '1px solid #3375b1',
          transform: 'translateY(-1px)'
        });
        
        // Ensure selected item is visible in the scroll container
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
    // Clear the prompt list first to make room for our variable form
    promptList.innerHTML = '';
    
    const dark = isDarkMode();
    const formContainer = createEl('div', {
      styles: {
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        backgroundColor: dark ? '#151b27' : '#ffffff',
        borderRadius: '8px'
      }
    });
    
    const title = createEl('div', {
      innerHTML: 'Variables',
      styles: {
        fontSize: '14px',
        fontWeight: 'bold',
        color: dark ? '#e1e1e1' : '#333',
        marginBottom: '4px'
      }
    });
    
    formContainer.appendChild(title);
    
    // Container for variable inputs
    const variablesContainer = createEl('div', {
      styles: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        maxHeight: '300px',
        overflowY: 'auto',
        backgroundColor: dark ? '#151b27' : '#ffffff'
      }
    });
    
    // Create inputs for each variable
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
          color: dark ? '#e1e1e1' : '#333',
          fontWeight: 'bold'
        }
      });
      
      const input = createEl('input', {
        attributes: { 
          type: 'text',
          placeholder: `${variable} value`
        },
        styles: {
          width: '100%',
          padding: '8px',
          borderRadius: '6px',
          border: dark ? '1px solid #444' : '1px solid #ccc',
          backgroundColor: dark ? '#2d2d2d' : '#ffffff',
          color: dark ? '#e1e1e1' : '#222222',
          fontSize: '12px',
          boxSizing: 'border-box',
          outline: 'none' // Remove default focus outline
        }
      });
      // Store the variable value when input changes
      input.addEventListener('input', () => {
        variableValues[variable] = input.value;
      });
      
      // Also handle Enter key to submit
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          submitButton.click();
        }
      });
      
      row.append(label, input);
      variablesContainer.appendChild(row);
      
      // Initialize empty values
      variableValues[variable] = '';
    });
    
    formContainer.appendChild(variablesContainer);
    
    // Buttons container
    const buttonsContainer = createEl('div', {
      styles: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        marginTop: '8px'
      }
    });
    
    // Submit button
    const submitButton = createEl('button', {
      innerHTML: 'Submit',
      styles: {
        padding: '8px',
        backgroundColor: dark ? '#1e4976' : '#3375b1',
        color: '#ffffff',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '12px',
        transition: 'background-color 0.2s ease'
      }
    });
    
    // Return to list button
    const returnButton = createEl('button', {
      innerHTML: 'Back',
      styles: {
        padding: '8px',
        backgroundColor: dark ? '#333' : '#e0e0e0',
        color: dark ? '#e1e1e1' : '#333',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '12px',
        transition: 'background-color 0.2s ease',
        marginTop: '4px'
      }
    });
    
    addHoverEffect(submitButton, { backgroundColor: dark ? '#2a5c8f' : '#285d8f' });
    addHoverEffect(returnButton, { backgroundColor: dark ? '#444' : '#ccc' });
    
    // Handle submit action
    submitButton.addEventListener('click', () => {
      // Replace variables in prompt content
      const processedContent = PromptManager.replaceVariables(promptContent, variableValues);
      
      // NEW APPROACH: Create a fake prompt object that mimics what createPromptItem uses
      const fakePrompt = {
        title: "Variable Prompt", 
        content: processedContent  
      };
      
      // Create a prompt item just like we do for regular prompts
      const promptItem = UIManager.createPromptItem(fakePrompt);
      
      // Now simulate a click on this item - this should use exactly the same code path
      // as regular prompts
      promptItem.click();
      
      // Reset the UI state for next time
      UIManager.hidePromptList(promptList);
      
      // Reset the prompt list container to default state
      setTimeout(() => {
        StorageManager.getPrompts().then(prompts => {
          UIManager.refreshPromptList(prompts);
        });
      }, 400); // Wait a bit longer than the hide animation (300ms)
    });
    
    // Handle return action
    returnButton.addEventListener('click', () => {
      // Return to prompt list - properly rebuild the entire list
      UIManager.refreshAndShowPromptList();
    });
    
    buttonsContainer.append(submitButton, returnButton);
    formContainer.appendChild(buttonsContainer);
    
    // Append the form to the prompt list
    promptList.appendChild(formContainer);
    
    // Show the prompt list (which now contains our variable form)
    UIManager.showPromptList(promptList);
    
    // Focus the first input field
    const firstInput = variablesContainer.querySelector('input');
    if (firstInput) {
      firstInput.focus();
    }
  }
  
  // Replace variables in content with their values
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
// PromptManager Class
// --------------------
class PromptManager {
  static initialized = false; // Track initialization state
  
  static async initialize() {
    // Prevent multiple initializations
    if (PromptManager.initialized) {
      console.log('PromptManager already initialized, skipping.');
      return;
    }
    
    try {
      // Set initialization flag immediately to prevent race conditions
      PromptManager.initialized = true;
      
      // Wait for the input box to appear
      await InputBoxHandler.waitForInputBox();
      console.log('Input box found.');
      await UIManager.checkForCachedPrompt();
      
      const prompts = await StorageManager.getPrompts();
      UIManager.injectPromptManagerButton(prompts);
      
      // Use a debounced observer to prevent rapid firing
      let observerTimeout = null;
      const observer = new MutationObserver(async (mutations) => {
        // Skip processing if button already exists
        if (document.getElementById('prompt-button-container')) {
          return;
        }
        
        // Debounce the observer callback to avoid multiple calls
        if (observerTimeout) clearTimeout(observerTimeout);
        observerTimeout = setTimeout(async () => {
          const inputBox = InputBoxHandler.getInputBox();
          if (inputBox && !document.getElementById('prompt-button-container')) {
            console.log('Reinjecting prompt manager button via MutationObserver.');
            const updatedPrompts = await StorageManager.getPrompts();
            UIManager.injectPromptManagerButton(updatedPrompts);
          }
        }, 300); // Debounce for 300ms
      });
      
      // More specific targeting for the observer
      const chatContainer = document.querySelector('main') || document.body;
      observer.observe(chatContainer, { childList: true, subtree: true });
      
      // Listen for storage changes
      StorageManager.onChange(async (changes, area) => {
        if (area === 'local' && changes.prompts) {
          console.log('Prompts updated in storage.');
          UIManager.refreshPromptList(changes.prompts.newValue);
        }
      });
      
      // Keyboard shortcut listener
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
      // Reset initialization flag on error to allow retry
      PromptManager.initialized = false;
    }
  }
  
  static async insertPrompt(inputBox, content, promptList) {
    // Check if the prompt contains variables
    const variables = PromptManager.extractVariables(content);
    
    if (variables.length === 0) {
      // No variables, proceed with normal insertion
      await InputBoxHandler.insertPrompt(inputBox, content, promptList);
    } else {
      // Show variable input form
      UIManager.showVariableInputForm(inputBox, content, variables, promptList);
    }
  }
  
  static getInputContent(inputBox) {
    return InputBoxHandler.getInputContent(inputBox);
  }
  
  // Extract variables from prompt content
  static extractVariables(content) {
    const variableRegex = /#([a-zA-Z0-9_]+)#/g;
    const matches = [...content.matchAll(variableRegex)];
    // Return unique variable names
    return [...new Set(matches.map(match => match[1]))];
  }
  
  // Replace variables in content with their values
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
// Add a small delay to let the page stabilize before initialization
setTimeout(() => {
  PromptManager.initialize();
}, 500);

// Add a custom style tag to handle focus states for all inputs in the prompt manager
const style = document.createElement('style');
style.textContent = `
  #prompt-list input:focus {
    border-color: ${isDarkMode() ? '#3375b1' : '#3375b1'} !important;
    box-shadow: 0 0 0 1px ${isDarkMode() ? 'rgba(51, 117, 177, 0.4)' : 'rgba(51, 117, 177, 0.2)'} !important;
    outline: none !important;
  }
`;
document.head.appendChild(style);
