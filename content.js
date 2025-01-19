// content.js
// This script manages the Prompt Manager functionality, including detecting input boxes,
// handling storage, managing the UI, and coordinating prompt insertion.

// Log to confirm script loading
console.log("Prompt Manager content script loaded.");

// Note: InputBoxHandler is now loaded from inputBoxHandler.js

// Add these constants at the top of the file
const CHROME_STORAGE_LIMIT = 10485760; // Chrome sync storage total limit (100KB)
const CHROME_STORAGE_ITEM_LIMIT = 10485760; // Chrome sync storage per-item limit (8KB)

/**
 * Class to manage Chrome storage interactions for prompts and UI settings.
 */
class StorageManager {
  /**
   * Retrieves prompts from Chrome storage.
   * @returns {Promise<Array>} Resolves with the list of prompts.
   */
  static getPrompts() {
    return new Promise((resolve) => {
      chrome.storage.local.get('prompts', data => {
        resolve(data.prompts || []);
      });
    });
  }

  /**
   * Saves a new prompt to Chrome storage.
   * @param {Object} prompt - The prompt object to save.
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  static async savePrompt(prompt) {
    try {
      // Get current prompts first
      const data = await chrome.storage.local.get('prompts');
      const prompts = data.prompts || [];
      
      // Calculate size of all prompts including the new one
      const allPrompts = [...prompts, prompt];
      const totalSize = new TextEncoder().encode(JSON.stringify(allPrompts)).length;
      
      // Check total storage limit
      if (totalSize > CHROME_STORAGE_LIMIT) {
        window.localStorage.setItem('cachedPrompt', JSON.stringify(prompt));
        throw new Error(`Total storage limit exceeded. The prompts require ${Math.round(totalSize/1024)}KB, but only ${Math.round(CHROME_STORAGE_LIMIT/1024)}KB is available.`);
      }

      // Check individual prompt size
      const promptSize = new TextEncoder().encode(JSON.stringify(prompt)).length;
      if (promptSize > CHROME_STORAGE_ITEM_LIMIT) {
        window.localStorage.setItem('cachedPrompt', JSON.stringify(prompt));
        throw new Error(`Individual prompt size limit exceeded. The prompt requires ${Math.round(promptSize/1024)}KB, but maximum allowed is ${Math.round(CHROME_STORAGE_ITEM_LIMIT/1024)}KB.`);
      }

      // If both checks pass, save all prompts as a single item
      await chrome.storage.local.set({ prompts: allPrompts });
      console.log('New prompt saved');
      
      // Clear any cached prompt
      window.localStorage.removeItem('cachedPrompt');
      
      return { success: true };

    } catch (error) {
      console.error('Error saving prompt:', error);
      
      // Add more detailed error information
      const errorMessage = error.message.includes('QUOTA_BYTES_PER_ITEM') 
        ? 'Storage quota exceeded. Please try reducing the size of your prompts or removing some existing ones.'
        : error.message;
        
      return { 
        success: false, 
        error: errorMessage
      };
    }
  }

  /**
   * Sets up a listener for storage changes.
   * @param {Function} callback - The callback to execute on changes.
   */
  static onChange(callback) {
    chrome.storage.onChanged.addListener(callback);
  }

  /**
   * Retrieves the button position from storage.
   * @returns {Promise<{x: number, y: number}>} The saved position or default values.
   */
  static getButtonPosition() {
    return new Promise((resolve) => {
      chrome.storage.local.get('buttonPosition', data => {
        resolve(data.buttonPosition || { x: 75, y: 100 }); // Default position
      });
    });
  }

  /**
   * Saves the button position to storage.
   * @param {Object} position - The position object with x and y coordinates.
   */
  static saveButtonPosition(position) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ buttonPosition: position }, resolve);
    });
  }

  /**
   * Gets the keyboard shortcut configuration
   * @returns {Promise<{key: string, modifier: string, requiresShift: boolean}>} The shortcut configuration
   */
  static getKeyboardShortcut() {
    return new Promise((resolve) => {
      chrome.storage.local.get('keyboardShortcut', data => {
        // Detect if user is on Mac
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        
        resolve(data.keyboardShortcut || { 
          key: isMac ? 'p' : 'm',  // Use 'p' for Mac, 'm' for others
          modifier: isMac ? 'metaKey' : 'ctrlKey',  // Use metaKey for Mac, ctrlKey for others
          requiresShift: isMac  // Only require Shift on Mac
        });
      });
    });
  }

  /**
   * Saves the keyboard shortcut configuration
   * @param {Object} shortcut - The shortcut configuration object
   * @param {string} shortcut.key - The key to trigger the shortcut
   * @param {string} shortcut.modifier - The modifier key (ctrlKey, metaKey, altKey, shiftKey)
   */
  static saveKeyboardShortcut(shortcut) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ keyboardShortcut: shortcut }, resolve);
    });
  }

  /**
   * Gets current storage usage statistics
   * @returns {Promise<{used: number, total: number, percentage: number}>}
   */
  static async getStorageUsage() {
    const data = await chrome.storage.local.get('prompts');
    const prompts = data.prompts || [];
    const used = new TextEncoder().encode(JSON.stringify(prompts)).length;
    const total = CHROME_STORAGE_LIMIT;
    const percentage = Math.round((used / total) * 100);
    
    return {
      used,
      total,
      percentage
    };
  }
}

/**
 * Class to manage UI components and interactions for the Prompt Manager.
 */
class UIManager {
  /**
   * Initializes and injects the Prompt Manager button into the page.
   * @param {Array} prompts - List of prompt objects to display.
   */
  static async injectPromptManagerButton(prompts) {
    // Prevent duplicate injections
    if (document.getElementById('prompt-button-container')) {
      console.log('Prompt button container already exists.');
      return;
    }

    // Retrieve saved button position
    const position = await StorageManager.getButtonPosition();

    // Create container for the button and prompt list
    const container = document.createElement('div');
    container.id = 'prompt-button-container';
    Object.assign(container.style, {
      position: 'fixed',
      zIndex: '9999',
      bottom: `${position.y}px`,
      right: `${position.x}px`,
      width: '40px',
      height: '40px',
      userSelect: 'none',
      cursor: 'move', // Indicates draggable element
    });
    console.log('Container created');

    // Create the Prompt Manager button
    const button = document.createElement('button');
    button.id = 'prompt-button';

    // Define button styles
    const buttonStyles = {
      width: '100%',
      height: '100%',
      backgroundColor: '#3375b1',
      backgroundRepeat: 'no-repeat',
      backgroundSize: '50%',
      backgroundPosition: 'center',
      cursor: 'pointer',
      color: '#000',
      borderRadius: '50%',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
      transition: 'all 0.3s ease', // Smooth transitions
      border: 'none',
      outline: 'none'
    };

    // Apply styles to the button
    Object.entries(buttonStyles).forEach(([key, value]) => {
      button.style[key] = value;
    });

    // Add hover effect using CSS
    const style = document.createElement('style');
    style.textContent = `
      #prompt-button:hover {
        background-color: #285d8f !important;
      }
    `;
    document.head.appendChild(style);

    button.title = 'Prompt Manager';
    console.log('Button created');

    // Set the button icon
    const iconUrl = chrome.runtime.getURL('icons/icon-button.png');
    button.style.backgroundImage = `url(${iconUrl})`;

    // Append button to the container
    container.appendChild(button);
    console.log('Button appended to container');

    // Create the prompt list dropdown
    const promptList = UIManager.createPromptList(prompts);
    container.appendChild(promptList);

    // Append the container to the body
    document.body.appendChild(container);
    console.log('Container appended to body');

    // Initialize variables for handling prompt list visibility
    let closeTimer = null;
    let isOpen = false;  // Tracks if the prompt list is open
    const CLOSE_DELAY = 1000; // 1 second delay before closing

    // Event listener for button click to toggle prompt list
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isOpen) {
        UIManager.hidePromptList(promptList);
        isOpen = false;
      } else {
        UIManager.showPromptList(promptList);
        isOpen = true;
      }
    });

    // Event listeners for hover to show/hide prompt list
    button.addEventListener('mouseenter', (e) => {
      e.stopPropagation();
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }
      UIManager.showPromptList(promptList);
      isOpen = true;
    });

    button.addEventListener('mouseleave', (e) => {
      e.stopPropagation();
      startCloseTimer(e);
    });

    promptList.addEventListener('mouseenter', () => {
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }
    });

    promptList.addEventListener('mouseleave', (e) => {
      startCloseTimer(e);
    });

    /**
     * Starts a timer to close the prompt list after a delay.
     * @param {MouseEvent} event - The mouse event triggering the timer.
     */
    function startCloseTimer(event) {
      if (closeTimer) {
        clearTimeout(closeTimer);
      }
      
      closeTimer = setTimeout(() => {
        const buttonRect = button.getBoundingClientRect();
        const listRect = promptList.getBoundingClientRect();
        const mouseX = event.clientX;
        const mouseY = event.clientY;

        const isOverButton = (
          mouseX >= buttonRect.left && 
          mouseX <= buttonRect.right && 
          mouseY >= buttonRect.top && 
          mouseY <= buttonRect.bottom
        );

        const isOverList = (
          mouseX >= listRect.left && 
          mouseX <= listRect.right && 
          mouseY >= listRect.top && 
          mouseY <= listRect.bottom
        );

        if (!isOverButton && !isOverList) {
          UIManager.hidePromptList(promptList);
          isOpen = false;
        }
        closeTimer = null;
      }, CLOSE_DELAY);
    }

    // Event listener to close prompt list when clicking outside
    document.addEventListener('click', (e) => {
      if (isOpen && !button.contains(e.target) && !promptList.contains(e.target)) {
        UIManager.hidePromptList(promptList);
        isOpen = false;
      }
    });

    // Add drag functionality to the container
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;

    container.addEventListener('mousedown', startDragging);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', stopDragging);

    /**
     * Handler to initiate dragging of the container.
     * @param {MouseEvent} e - The mouse event.
     */
    function startDragging(e) {
      // Only start drag if the button itself is being dragged
      if (e.target.id === 'prompt-button') {
        isDragging = true;
        
        const rect = container.getBoundingClientRect();
        initialX = e.clientX;
        initialY = e.clientY;
        
        // Store initial right/bottom values
        currentX = parseInt(container.style.right);
        currentY = parseInt(container.style.bottom);
        
        container.style.transition = 'none'; // Disable transitions during drag
      }
    }

    /**
     * Handler to perform dragging of the container.
     * @param {MouseEvent} e - The mouse event.
     */
    function drag(e) {
      if (isDragging) {
        e.preventDefault();
        
        // Calculate movement delta
        const deltaX = initialX - e.clientX;
        const deltaY = initialY - e.clientY;
        
        // Update position based on movement
        let newX = currentX + deltaX;
        let newY = currentY + deltaY;

        // Constrain within window bounds
        newX = Math.min(Math.max(newX, 0), window.innerWidth - container.offsetWidth);
        newY = Math.min(Math.max(newY, 0), window.innerHeight - container.offsetHeight);

        container.style.right = `${newX}px`;
        container.style.bottom = `${newY}px`;
      }
    }

    /**
     * Handler to stop dragging and save the new position.
     */
    async function stopDragging() {
      if (isDragging) {
        isDragging = false;
        container.style.transition = 'all 0.3s ease'; // Re-enable transitions

        // Save the new button position to storage
        await StorageManager.saveButtonPosition({
          x: parseInt(container.style.right),
          y: parseInt(container.style.bottom)
        });
      }
    }
  }

  /**
   * Creates the prompt list dropdown element.
   * @param {Array} prompts - List of prompt objects.
   * @returns {HTMLElement} The prompt list element.
   */
  static createPromptList(prompts) {
    const promptList = document.createElement('div');
    promptList.id = 'prompt-list';
    
    const isDark = UIManager.isDarkMode();
    Object.assign(promptList.style, {
        position: 'absolute',
        bottom: '50px',
        right: '0',
        backgroundColor: isDark ? '#151b27' : '#ffffff',
        border: isDark ? '1px solid #2a3343' : 'none',
        padding: '6px',
        borderRadius: '10px',
        boxShadow: isDark ? '0 4px 20px rgba(0, 0, 0, 0.3)' : '0 4px 20px rgba(0, 0, 0, 0.15)',
        display: 'none',
        width: '260px',
        zIndex: '10000',
        opacity: '0',
        transform: 'translateY(20px)',
        transition: 'opacity 0.2s ease, transform 0.2s ease',
        backdropFilter: 'blur(10px)',
        webkitBackdropFilter: 'blur(10px)',
    });

    // Create a scrollable container for prompts
    const promptsContainer = document.createElement('div');
    Object.assign(promptsContainer.style, {
      maxHeight: '300px',
      overflowY: 'auto',
      marginBottom: '12px',
      scrollbarWidth: 'thin',
      scrollbarColor: '#3375b1 transparent'
    });

    // Add custom scrollbar styles
    const style = document.createElement('style');
    style.textContent = `
        #prompt-list > div:first-child::-webkit-scrollbar {
            width: 6px;
        }
        #prompt-list > div:first-child::-webkit-scrollbar-track {
            background: ${isDark ? '#1a2235' : 'transparent'};
        }
        #prompt-list > div:first-child::-webkit-scrollbar-thumb {
            background-color: ${isDark ? '#2a3343' : '#3375b1'};
            border-radius: 3px;
        }
    `;
    document.head.appendChild(style);

    // Show keyboard shortcuts if no prompts exist
    if (prompts.length === 0) {
      const emptyStateDiv = document.createElement('div');
      emptyStateDiv.className = 'shortcut-container';
      emptyStateDiv.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <div style="font-size: 12px;">Open prompt list buttons</div>
          <div style="font-size: 12px;">
            <div style="background-color: #0077B6; color: white; padding: 2px 4px; border-radius: 4px; display: inline-block; margin-bottom: 4px;">
              Hover/Click
            </div>
          </div>
          <div style="font-size: 12px;">Open / close prompt list</div>
          <div style="font-size: 12px;">
            <div style="background-color: #0077B6; color: white; padding: 2px 4px; border-radius: 4px; display: inline-block; margin-bottom: 4px;">
              ⌘ or Ctrl + Shift + P
            </div>
          </div>
          <div style="font-size: 12px;">Navigate the prompt list</div>
          <div style="font-size: 12px;">
            <div style="background-color: #0077B6; color: white; padding: 2px 4px; border-radius: 4px; display: inline-block; margin-bottom: 4px;">
              ↑↓
            </div>
          </div>
          <div style="font-size: 12px;">Select a prompt</div>
          <div style="font-size: 12px;">
            <div style="background-color: #0077B6; color: white; padding: 2px 4px; border-radius: 4px; display: inline-block; margin-bottom: 4px;">
              Enter
            </div>
          </div>
          <div style="font-size: 12px;">Close the prompt manager</div>
          <div style="font-size: 12px;">
            <div style="background-color: #0077B6; color: white; padding: 2px 4px; border-radius: 4px; display: inline-block; margin-bottom: 4px;">
              Esc
            </div>
          </div>
        </div>
      `;
      promptsContainer.appendChild(emptyStateDiv);
    } else {
      // Populate with prompts if they exist
      prompts.forEach(prompt => {
        const promptItem = UIManager.createPromptItem(prompt);
        promptsContainer.appendChild(promptItem);
      });
    }

    promptList.appendChild(promptsContainer);
    promptList.appendChild(UIManager.createBottomMenu());

    return promptList;
  }

  /**
   * Creates an individual prompt item element.
   * @param {Object} prompt - The prompt object.
   * @returns {HTMLElement} The prompt item element.
   */
  static createPromptItem(prompt) {
    const promptItem = document.createElement('div');
    const isDark = UIManager.isDarkMode();
    
    Object.assign(promptItem.style, {
        padding: '8px 12px',
        margin: '4px 0',
        borderRadius: '8px',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        fontSize: '14px',
        color: isDark ? '#e1e1e1' : '#2c3e50',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
        backgroundColor: 'transparent',
        border: '1px solid transparent'
    });

    // Create text container (now without icon)
    const textContainer = document.createElement('div');
    textContainer.style.flex = '1';
    textContainer.textContent = prompt.title;

    // Append text container
    promptItem.appendChild(textContainer);

    // Enhanced hover effects
    promptItem.addEventListener('mouseover', () => {
        Object.assign(promptItem.style, {
            backgroundColor: isDark ? '#0c172e' : '#f0f4f8',
            border: isDark ? '1px solid #555' : '1px solid #3375b1',
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

    // Event: Insert prompt into input box on click
    promptItem.addEventListener('click', async () => {
      const inputBox = InputBoxHandler.getInputBox();
      if (!inputBox) {
        console.error('Input box not found.');
        return;
      }

      // Get the parent prompt list element
      const promptList = document.getElementById('prompt-list');
      if (!promptList) {
        console.error('Prompt list not found.');
        return;
      }

      await PromptManager.insertPrompt(inputBox, prompt.content, promptList);
    });

    // Add data attributes for searching
    promptItem.dataset.title = prompt.title.toLowerCase();
    promptItem.dataset.content = prompt.content.toLowerCase();

    return promptItem;
  }

  /**
   * Creates the bottom menu with the "Save Prompt" button and search input.
   * @returns {HTMLElement} The bottom menu element.
   */
  static createBottomMenu() {
    const bottomMenu = document.createElement('div');
    const isDark = UIManager.isDarkMode();
    
    // Add consistent padding and spacing styles
    Object.assign(bottomMenu.style, {
        position: 'sticky',
        bottom: '0',
        backgroundColor: isDark ? '#1a1a1a' : '#fff',
        borderTop: isDark ? '1px solid #333' : '1px solid #eee',
        padding: '8px', // Add consistent padding
        display: 'flex',
        flexDirection: 'column',
        gap: '8px' // Consistent spacing between elements
    });

    // Create search input for filtering prompts
    const searchInput = document.createElement('input');
    searchInput.id = 'prompt-search-input';
    searchInput.type = 'text';
    searchInput.placeholder = 'Type to search';
    Object.assign(searchInput.style, {
        width: '100%',
        padding: '6px 8px', // Consistent padding
        color: isDark ? '#e1e1e1' : '#222222',
        fontSize: '12px',
        fontFamily: 'Helvetica, Verdana, Geneva, Tahoma, sans-serif',
        borderRadius: '4px',
        border: isDark ? '1px solid #444' : '1px solid #ccc',
        backgroundColor: isDark ? '#2d2d2d' : '#f5f5f5',
        boxSizing: 'border-box',
        height: '28px', // Fixed height
        lineHeight: '16px',
        outline: 'none',
        transition: 'all 0.2s ease',
        margin: '0' // Remove margin to use container's gap
    });

    // Add focus state styles
    searchInput.addEventListener('focus', () => {
        searchInput.style.backgroundColor = isDark ? '#333' : '#fff';
        searchInput.style.border = isDark ? '1px solid #666' : '1px solid #3375b1';
    });

    searchInput.addEventListener('blur', () => {
        searchInput.style.backgroundColor = isDark ? '#2d2d2d' : '#f5f5f5';
        searchInput.style.border = isDark ? '1px solid #444' : '1px solid #ccc';
    });

    let selectedIndex = -1;

    // Keyboard navigation for the search input
    searchInput.addEventListener('keydown', (e) => {
      const visiblePrompts = Array.from(document.querySelectorAll('#prompt-list > div:first-child > div'))
        .filter(item => item.style.display !== 'none');
      
      switch(e.key) {
        case 'ArrowDown':
          e.preventDefault();
          selectedIndex = Math.min(selectedIndex + 1, visiblePrompts.length - 1);
          updateSelection(visiblePrompts);
          break;
        case 'ArrowUp':
          e.preventDefault();
          selectedIndex = Math.max(selectedIndex - 1, -1);
          updateSelection(visiblePrompts);
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
          updateSelection(visiblePrompts);
          const promptList = document.getElementById('prompt-list');
          if (promptList) {
            UIManager.hidePromptList(promptList);
          }
          break;
      }
    });

    /**
     * Updates the selection highlight based on keyboard navigation.
     * @param {Array} visiblePrompts - Array of visible prompt elements.
     */
    function updateSelection(visiblePrompts) {
        visiblePrompts.forEach((item, index) => {
            if (index === selectedIndex) {
                Object.assign(item.style, {
                    backgroundColor: isDark ? '#0c172e' : '#f0f4f8',
                    border: isDark ? '1px solid #555' : '1px solid #3375b1',
                    transform: 'translateY(-1px)'
                });
            } else {
                Object.assign(item.style, {
                    backgroundColor: 'transparent',
                    border: '1px solid transparent',
                    transform: 'translateY(0)'
                });
            }
        });

        // Ensure the selected item is visible within the scrollable area
        if (selectedIndex >= 0) {
            const selectedItem = visiblePrompts[selectedIndex];
            selectedItem.scrollIntoView({ block: 'nearest' });
        }
    }

    // Reset selection when filtering prompts
    searchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase();
      const promptsContainer = document.querySelector('#prompt-list > div:first-child');
      if (!promptsContainer) return;

      const promptItems = promptsContainer.children;
      selectedIndex = -1; // Reset selection

      Array.from(promptItems).forEach(item => {
        const title = item.dataset.title;
        const content = item.dataset.content;
        const shouldShow = title.includes(searchTerm) || content.includes(searchTerm);
        item.style.display = shouldShow ? 'flex' : 'none';
        item.style.backgroundColor = ''; // Reset background color
      });
    });

    // Create "Save Prompt" button with dark mode support
    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save prompt';
    Object.assign(saveButton.style, {
        width: '100%',
        padding: '5px',
        // Dark mode: Use a darker blue that's still visible and maintains contrast
        backgroundColor: isDark ? '#1e4976' : '#3375b1',
        fontSize: '12px',
        fontFamily: 'Helvetica, Verdana, Geneva, Tahoma, sans-serif',
        color: '#ffffff',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        marginBottom: '8px',
        display: 'none', // Initially hidden
        transition: 'background-color 0.2s ease'
    });

    // Add hover effect for save button
    saveButton.addEventListener('mouseover', () => {
        saveButton.style.backgroundColor = isDark ? '#2a5c8f' : '#285d8f';
    });
    saveButton.addEventListener('mouseout', () => {
        saveButton.style.backgroundColor = isDark ? '#1e4976' : '#3375b1';
    });

    // Check initial content state to determine button visibility
    const inputBox = InputBoxHandler.getInputBox();
    if (inputBox) {
      const content = PromptManager.getInputContent(inputBox);
      saveButton.style.display = content.trim() ? 'block' : 'none';
    }

    // Event listener for saving a new prompt
    saveButton.addEventListener('click', () => {
      const inputBox = InputBoxHandler.getInputBox();
      if (inputBox) {
        const content = PromptManager.getInputContent(inputBox);
        
        if (content.trim()) {
          saveButton.style.display = 'none';
          searchInput.style.display = 'none'; // Hide search input when saving
          const titleInputDiv = UIManager.createTitleInputDiv(content);
          const promptList = document.getElementById('prompt-list');
          promptList.appendChild(titleInputDiv);
        } else {
          alert('The input area is empty. Please enter some text before saving.');
        }
      }
    });

    // Add new menubar
    const menuBar = document.createElement('div');
    Object.assign(menuBar.style, {
        display: 'flex',
        alignItems: 'center',
        gap: '8px', // Add gap between buttons
        margin: '0' // Remove margin to use container's gap
    });

    // Create message icon button
    const messageButton = document.createElement('button');
    Object.assign(messageButton.style, {
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
    });

    // Add message icon (chat bubble using SVG)
    messageButton.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 20 20" fill="${isDark ? '#e1e1e1' : '#666'}">
            <path d="M2 5.5C2 4.11929 3.11929 3 4.5 3H15.5C16.8807 3 18 4.11929 18 5.5V12.5C18 13.8807 16.8807 15 15.5 15H11.5L8 18.5L4.5 15H4.5C3.11929 15 2 13.8807 2 12.5V5.5ZM4.5 4.5C3.94772 4.5 3.5 4.94772 3.5 5.5V12.5C3.5 13.0523 3.94772 13.5 4.5 13.5H5.25L8 16.25L10.75 13.5H15.5C16.0523 13.5 16.5 13.0523 16.5 12.5V5.5C16.5 4.94772 16.0523 4.5 15.5 4.5H4.5Z"/>
        </svg>
    `;

    // Add hover effect for message button
    messageButton.addEventListener('mouseover', () => {
        messageButton.style.backgroundColor = isDark ? '#333' : '#f0f0f0';
    });
    messageButton.addEventListener('mouseout', () => {
        messageButton.style.backgroundColor = 'transparent';
    });

    // Add click handler for message button
    messageButton.addEventListener('click', () => {
        const promptList = document.getElementById('prompt-list');
        if (promptList) {
            // Get current content from the input box
            const inputBox = InputBoxHandler.getInputBox();
            const currentContent = inputBox ? PromptManager.getInputContent(inputBox) : '';
            
            // Hide the current prompts container
            const promptsContainer = promptList.querySelector('div:first-child');
            if (promptsContainer) {
                promptsContainer.style.display = 'none';
            }
            
            // Create and show the prompt creation form
            const creationForm = UIManager.createPromptCreationForm();
            promptList.insertBefore(creationForm, promptList.firstChild);
            
            // Auto-populate the content textarea if there's content
            const contentTextarea = creationForm.querySelector('textarea');
            if (contentTextarea && currentContent.trim()) {
                contentTextarea.value = currentContent;
                
                // Adjust textarea height to fit content
                contentTextarea.style.height = 'auto';
                contentTextarea.style.height = Math.min(contentTextarea.scrollHeight, 300) + 'px';
            }
            
            // Focus the title input
            const titleInput = creationForm.querySelector('input');
            if (titleInput) {
                titleInput.focus();
            }
        }
    });

    // Create settings icon button
    const settingsButton = document.createElement('button');
    Object.assign(settingsButton.style, {
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
    });

    // Add settings icon (gear icon using SVG)
    settingsButton.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 20 20" fill="${isDark ? '#e1e1e1' : '#666'}">
            <path d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"/>
        </svg>
    `;

    // Add hover effect for settings button
    settingsButton.addEventListener('mouseover', () => {
        settingsButton.style.backgroundColor = isDark ? '#333' : '#f0f0f0';
    });
    settingsButton.addEventListener('mouseout', () => {
        settingsButton.style.backgroundColor = 'transparent';
    });

    // Add click handler for settings button
    settingsButton.addEventListener('click', (e) => {
        e.stopPropagation();
        const promptList = document.getElementById('prompt-list');
        if (promptList) {
            // Hide the current prompts container
            const promptsContainer = promptList.querySelector('div:first-child');
            if (promptsContainer) {
                promptsContainer.style.display = 'none';
            }
            
            // Create and show the import/export form
            const importExportForm = UIManager.createImportExportForm();
            promptList.insertBefore(importExportForm, promptList.firstChild);
        }
    });

    // Create info icon button with improved styling
    const helpButton = document.createElement('button');
    Object.assign(helpButton.style, {
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
    });

    // Updated info icon SVG with better proportions and design
    helpButton.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${isDark ? '#e1e1e1' : '#666'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12" y2="8"></line>
        </svg>
    `;

    // Add hover effect for info button
    helpButton.addEventListener('mouseover', () => {
        helpButton.style.backgroundColor = isDark ? '#333' : '#f0f0f0';
        helpButton.querySelector('svg').style.stroke = isDark ? '#fff' : '#333';
    });
    helpButton.addEventListener('mouseout', () => {
        helpButton.style.backgroundColor = 'transparent';
        helpButton.querySelector('svg').style.stroke = isDark ? '#e1e1e1' : '#666';
    });

    // Add click handler for help button
    helpButton.addEventListener('click', (e) => {
        e.stopPropagation();
        const promptList = document.getElementById('prompt-list');
        if (promptList) {
            // Hide the current prompts container
            const promptsContainer = promptList.querySelector('div:first-child');
            if (promptsContainer) {
                promptsContainer.style.display = 'none';
            }
            
            // Hide search input
            const searchInput = document.getElementById('prompt-search-input');
            if (searchInput) {
                searchInput.style.display = 'none';
            }

            // Create and show the shortcuts help
            const helpContainer = document.createElement('div');
            Object.assign(helpContainer.style, {
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
            });

            // Add title
            const title = document.createElement('div');
            Object.assign(title.style, {
                fontSize: '14px',
                fontWeight: 'bold',
                color: isDark ? '#e1e1e1' : '#333',
                marginBottom: '8px'
            });
            title.textContent = 'Keyboard Shortcuts';

            // Add shortcuts content
            const content = document.createElement('div');
            content.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 2px;">
                    <div style="font-size: 12px;">Open prompt list buttons</div>
                    <div style="font-size: 12px;">
                        <div style="background-color: #0077B6; color: white; padding: 2px 4px; border-radius: 4px; display: inline-block; margin-bottom: 4px;">
                            Hover/Click
                        </div>
                    </div>
                    <div style="font-size: 12px;">Open / close prompt list</div>
                    <div style="font-size: 12px;">
                        <div style="background-color: #0077B6; color: white; padding: 2px 4px; border-radius: 4px; display: inline-block; margin-bottom: 4px;">
                            ⌘ or Ctrl + Shift + P
                        </div>
                    </div>
                    <div style="font-size: 12px;">Navigate the prompt list</div>
                    <div style="font-size: 12px;">
                        <div style="background-color: #0077B6; color: white; padding: 2px 4px; border-radius: 4px; display: inline-block; margin-bottom: 4px;">
                            ↑↓
                        </div>
                    </div>
                    <div style="font-size: 12px;">Select a prompt</div>
                    <div style="font-size: 12px;">
                        <div style="background-color: #0077B6; color: white; padding: 2px 4px; border-radius: 4px; display: inline-block; margin-bottom: 4px;">
                            Enter
                        </div>
                    </div>
                    <div style="font-size: 12px;">Close the prompt manager</div>
                    <div style="font-size: 12px;">
                        <div style="background-color: #0077B6; color: white; padding: 2px 4px; border-radius: 4px; display: inline-block; margin-bottom: 4px;">
                            Esc
                        </div>
                    </div>
                </div>
            `;

            // Append all elements
            helpContainer.appendChild(title);
            helpContainer.appendChild(content);

            // Add container to prompt list
            promptList.insertBefore(helpContainer, promptList.firstChild);
        }
    });

    // Create prompt list icon button
    const promptListButton = document.createElement('button');
    Object.assign(promptListButton.style, {
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
    });

    // Add prompt list icon (list icon using SVG)
    promptListButton.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 20 20" fill="${isDark ? '#e1e1e1' : '#666'}">
            <path d="M4 4h2v2H4V4zm0 5h2v2H4V9zm0 5h2v2H4v-2zm4-10h12v2H8V4zm0 5h12v2H8V9zm0 5h12v2H8v-2z"/>
        </svg>
    `;

    // Add hover effect for prompt list button
    promptListButton.addEventListener('mouseover', () => {
        promptListButton.style.backgroundColor = isDark ? '#333' : '#f0f0f0';
        promptListButton.querySelector('svg').style.fill = isDark ? '#fff' : '#333';
    });
    promptListButton.addEventListener('mouseout', () => {
        promptListButton.style.backgroundColor = 'transparent';
        promptListButton.querySelector('svg').style.fill = isDark ? '#e1e1e1' : '#666';
    });

    // Add click handler for prompt list button
    promptListButton.addEventListener('click', async (e) => {
        e.stopPropagation();
        const promptList = document.getElementById('prompt-list');
        if (promptList) {
            // Show the prompts container and search input
            const promptsContainer = promptList.querySelector('div:first-child');
            if (promptsContainer) {
                promptsContainer.style.display = 'block';
            }
            const searchInput = document.getElementById('prompt-search-input');
            if (searchInput) {
                searchInput.style.display = 'block';
            }

            // Remove any other forms that might be visible
            const forms = promptList.querySelectorAll('div[style*="padding: 12px"]');
            forms.forEach(form => form.remove());

            // Refresh the prompt list to ensure it's up to date
            const prompts = await StorageManager.getPrompts();
            UIManager.refreshPromptList(prompts);
        }
    });

    // Add edit button
    const editButton = document.createElement('button');
    Object.assign(editButton.style, {
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
    });

    // Add edit icon (crayon using SVG)
    editButton.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 20 20" fill="${isDark ? '#e1e1e1' : '#666'}">
            <path d="M13.586 3.586a2 2 0 112.828 2.828l-8.793 8.793-3.536.707.707-3.536 8.794-8.792z"/>
        </svg>
    `;

    // Add hover effect for edit button
    editButton.addEventListener('mouseover', () => {
        editButton.style.backgroundColor = isDark ? '#333' : '#f0f0f0';
        editButton.querySelector('svg').style.fill = isDark ? '#fff' : '#333';
    });
    editButton.addEventListener('mouseout', () => {
        editButton.style.backgroundColor = 'transparent';
        editButton.querySelector('svg').style.fill = isDark ? '#e1e1e1' : '#666';
    });

    // Add click handler for edit button
    editButton.addEventListener('click', async (e) => {
        e.stopPropagation();
        const promptList = document.getElementById('prompt-list');
        if (promptList) {
            // Hide the current prompts container
            const promptsContainer = promptList.querySelector('div:first-child');
            if (promptsContainer) {
                promptsContainer.style.display = 'none';
            }
            
            // Hide search input
            const searchInput = document.getElementById('prompt-search-input');
            if (searchInput) {
                searchInput.style.display = 'none';
            }

            // Remove any other forms that might be visible
            const forms = promptList.querySelectorAll('div[style*="padding: 12px"]');
            forms.forEach(form => form.remove());

            // Show edit view
            const editView = await UIManager.createEditView();
            promptList.insertBefore(editView, promptList.firstChild);
        }
    });

    // Append buttons to menubar in the desired order
    menuBar.appendChild(promptListButton);    // Prompt list first
    menuBar.appendChild(messageButton);       // Message button second
    menuBar.appendChild(editButton);          // Edit button third
    menuBar.appendChild(settingsButton);      // Settings button fourth
    menuBar.appendChild(helpButton);          // Help button last

    // Append everything to bottom menu
    bottomMenu.appendChild(searchInput);
    bottomMenu.appendChild(menuBar);
    
    return bottomMenu;
  }

  /**
   * Toggles the visibility of the prompt list.
   * @param {HTMLElement} promptList - The prompt list element.
   */
  static togglePromptList(promptList) {
    // Toggle between showing and hiding the prompt list
    if (!promptList) {
      console.error('Prompt list not found for toggle.');
      return;
    }

    if (promptList.style.display === 'none') {
      UIManager.showPromptList(promptList);
    } else {
      UIManager.hidePromptList(promptList);
    }
  }

  /**
   * Shows the prompt list with animation and focuses the search input.
   */
  static showPromptList(promptList) {
    if (promptList) {
        // Reset any existing containers to proper layout
        const editContainer = promptList.querySelector('div[style*="padding: 12px"]');
        if (editContainer) {
            Object.assign(editContainer.style, {
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                boxSizing: 'border-box'
            });
        }

        // Ensure proper styles before showing
        const promptItems = promptList.querySelectorAll('#prompt-list > div:first-child > div');
        promptItems.forEach(item => {
            item.style.display = 'flex';
            item.style.padding = '8px 12px';
            item.style.margin = '4px 0';
            item.style.borderRadius = '8px';
            item.style.backgroundColor = 'transparent';
            item.style.border = '1px solid transparent';
        });

        promptList.style.display = 'block';
        setTimeout(() => {
            promptList.style.opacity = '1';
            promptList.style.transform = 'translateY(0)';
            UIManager.focusSearchInput();
        }, 0);
    }
  }

  /**
   * Hides the prompt list with animation and resets search/filter states.
   * @param {HTMLElement} promptList - The prompt list element.
   */
  static hidePromptList(promptList) {
    if (!promptList) {
        console.error('Prompt list not found for hiding.');
        return;
    }

    // Animate hiding the prompt list
    promptList.style.opacity = '0';
    promptList.style.transform = 'translateY(20px)';
    
    // Reset search input and prompt item visibility
    const searchInput = document.getElementById('prompt-search-input');
    if (searchInput) {
        searchInput.value = '';
    }
    
    // After animation, hide the prompt list
    setTimeout(() => {
        if (promptList) {
            promptList.style.display = 'none';
            
            // Reset all prompt items to visible and restore their styles
            const promptItems = document.querySelectorAll('#prompt-list > div:first-child > div');
            promptItems.forEach(item => {
                item.style.display = 'flex';
                item.style.padding = '8px 12px';
                item.style.margin = '4px 0';
                item.style.borderRadius = '8px';
                item.style.backgroundColor = 'transparent';
                item.style.border = '1px solid transparent';
            });
        }
    }, 300);
  }

  /**
   * Refreshes the prompt list with updated prompts.
   * @param {Array} prompts - List of updated prompt objects.
   */
  static refreshPromptList(prompts) {
    const promptList = document.getElementById('prompt-list');
    if (!promptList) {
      console.error('Prompt list not found for refresh.');
      return;
    }

    // Clear existing content in the prompt list
    promptList.innerHTML = '';

    // Create a new scrollable container for prompts
    const promptsContainer = document.createElement('div');
    Object.assign(promptsContainer.style, {
      maxHeight: '350px',
      overflowY: 'auto',
      marginBottom: '8px'
    });

    // Add updated prompts to the container
    prompts.forEach(prompt => {
      const promptItem = UIManager.createPromptItem(prompt);
      promptsContainer.appendChild(promptItem);
    });

    // Append the new prompts container and bottom menu to the prompt list
    promptList.appendChild(promptsContainer);
    promptList.appendChild(UIManager.createBottomMenu());
  }

  /**
   * Focuses the search input field within the prompt list.
   */
  static focusSearchInput() {
    const searchInput = document.getElementById('prompt-search-input');
    if (searchInput) {
      // Ensure focus occurs after the current execution stack
      window.requestAnimationFrame(() => {
        searchInput.focus();
        searchInput.select(); // Optionally select any existing text
      });
    }
  }

  // Add this helper method to UIManager class
  static isDarkMode() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  // Add this new method to UIManager class
  static createPromptCreationForm() {
    const isDark = UIManager.isDarkMode();
    
    // Hide search input when showing creation form
    const searchInput = document.getElementById('prompt-search-input');
    if (searchInput) {
        searchInput.style.display = 'none';
    }
    
    const formContainer = document.createElement('div');
    Object.assign(formContainer.style, {
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
    });

    // Add title
    const title = document.createElement('div');
    Object.assign(title.style, {
        fontSize: '14px',
        fontWeight: 'bold',
        color: isDark ? '#e1e1e1' : '#333',
        marginBottom: '8px'
    });
    title.textContent = 'Create New Prompt';

    // Title input
    const titleInput = document.createElement('input');
    Object.assign(titleInput.style, {
        width: '100%',
        padding: '8px',
        borderRadius: '6px',
        border: isDark ? '1px solid #444' : '1px solid #ccc',
        backgroundColor: isDark ? '#2d2d2d' : '#ffffff',
        color: isDark ? '#e1e1e1' : '#222222',
        fontSize: '12px',
        boxSizing: 'border-box'
    });
    titleInput.placeholder = 'Prompt Title';

    // Content textarea
    const contentTextarea = document.createElement('textarea');
    Object.assign(contentTextarea.style, {
        width: '100%',
        padding: '8px',
        borderRadius: '6px',
        border: isDark ? '1px solid #444' : '1px solid #ccc',
        backgroundColor: isDark ? '#2d2d2d' : '#ffffff',
        color: isDark ? '#e1e1e1' : '#222222',
        fontSize: '12px',
        minHeight: '100px',
        resize: 'vertical',
        boxSizing: 'border-box'
    });
    contentTextarea.placeholder = 'Prompt Content';

    // Save button
    const saveButton = document.createElement('button');
    Object.assign(saveButton.style, {
        padding: '8px',
        backgroundColor: isDark ? '#1e4976' : '#3375b1',
        width: '100%',
        color: '#ffffff',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '12px',
        transition: 'background-color 0.2s ease'
    });
    saveButton.textContent = 'Save Prompt';

    // Add hover effect
    saveButton.addEventListener('mouseover', () => {
        saveButton.style.backgroundColor = isDark ? '#2a5c8f' : '#285d8f';
    });
    saveButton.addEventListener('mouseout', () => {
        saveButton.style.backgroundColor = isDark ? '#1e4976' : '#3375b1';
    });

    // Button container (now only contains save button)
    const buttonContainer = document.createElement('div');
    Object.assign(buttonContainer.style, {
        display: 'flex',
        gap: '8px',
        marginTop: '8px'
    });
    buttonContainer.appendChild(saveButton);

    // Append all elements (without cancel button)
    formContainer.appendChild(title);
    formContainer.appendChild(titleInput);
    formContainer.appendChild(contentTextarea);
    formContainer.appendChild(buttonContainer);

    // Handle save
    saveButton.addEventListener('click', async (e) => {
        e.stopPropagation();
        const title = titleInput.value.trim();
        const content = contentTextarea.value.trim();

        if (!title || !content) {
            alert('Please fill in both title and content.');
            return;
        }

        // Try to save the prompt
        const result = await StorageManager.savePrompt({ title, content });
        
        if (!result.success) {
            // Show error in a more user-friendly dialog
            const dialog = document.createElement('div');
            Object.assign(dialog.style, {
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
                padding: '20px',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                zIndex: '10001',
                maxWidth: '400px',
                width: '90%'
            });

            const usage = await StorageManager.getStorageUsage();

            dialog.innerHTML = `
                <h3 style="margin-top: 0; color: ${isDark ? '#e1e1e1' : '#333'}">Unable to Save Prompt</h3>
                <p style="color: ${isDark ? '#e1e1e1' : '#333'}">${result.error}</p>
                <div style="
                    margin: 15px 0;
                    padding: 10px;
                    background: ${isDark ? '#2a2a2a' : '#f5f5f5'};
                    border-radius: 4px;
                ">
                    <p style="color: ${isDark ? '#e1e1e1' : '#333'}; margin: 0 0 8px 0;">
                        Storage Usage: ${usage.percentage}%
                    </p>
                    <div style="
                        height: 8px;
                        background: ${isDark ? '#444' : '#ddd'};
                        border-radius: 4px;
                        overflow: hidden;
                    ">
                        <div style="
                            width: ${usage.percentage}%;
                            height: 100%;
                            background: ${usage.percentage > 90 ? '#ff4444' : '#3375b1'};
                            transition: width 0.3s ease;
                        "></div>
                    </div>
                    <p style="color: ${isDark ? '#999' : '#666'}; font-size: 12px; margin: 8px 0 0 0;">
                        ${(usage.used / 1024).toFixed(1)}KB used of ${(usage.total / 1024).toFixed(1)}KB total
                    </p>
                    <p style="color: ${isDark ? '#999' : '#666'}; font-size: 12px; margin: 4px 0 0 0;">
                        Maximum prompt size: 8KB
                    </p>
                </div>
                <p style="color: ${isDark ? '#e1e1e1' : '#333'}">Your prompt has been temporarily cached. You can try:</p>
                <ul style="color: ${isDark ? '#e1e1e1' : '#333'}">
                    <li>Shortening the prompt content (must be under 8KB per prompt)</li>
                    <li>Splitting the prompt into multiple smaller prompts</li>
                </ul>
                <div style="text-align: right; margin-top: 15px;">
                    <button id="dialog-close" style="
                        padding: 8px 16px;
                        backgroundColor: ${isDark ? '#1e4976' : '#3375b1'};
                        color: '#ffffff';
                        border: 'none';
                        borderRadius: '6px';
                        cursor: 'pointer'
                    ">Close</button>
                </div>
            `;

            document.body.appendChild(dialog);

            // Close dialog handler
            const closeBtn = dialog.querySelector('#dialog-close');
            closeBtn.onclick = () => {
                dialog.remove();
            };

            return;
        }

        // If save was successful, refresh the prompt list
        const prompts = await StorageManager.getPrompts();
        UIManager.refreshPromptList(prompts);
        
        // Show the regular prompt list view
        const promptList = document.getElementById('prompt-list');
        if (promptList) {
            const promptsContainer = promptList.querySelector('div:first-child');
            if (promptsContainer) {
                promptsContainer.style.display = 'block';
            }
            formContainer.remove();
        }
    });

    // Add stopPropagation to the form container itself
    formContainer.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    return formContainer;
  }
  // Add new method to UIManager class
  static createImportExportForm() {
    const isDark = UIManager.isDarkMode();
    
    // Hide search input when showing import/export form
    const searchInput = document.getElementById('prompt-search-input');
    if (searchInput) {
        searchInput.style.display = 'none';
    }
    
    const formContainer = document.createElement('div');
    Object.assign(formContainer.style, {
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
    });

    // Create title
    const title = document.createElement('div');
    Object.assign(title.style, {
        fontSize: '14px',
        fontWeight: 'bold',
        color: isDark ? '#e1e1e1' : '#333',
        marginBottom: '8px'
    });
    title.textContent = 'Import/Export Prompts';

    // Create export button
    const exportButton = document.createElement('button');
    Object.assign(exportButton.style, {
        padding: '8px',
        backgroundColor: isDark ? '#1e4976' : '#3375b1',
        color: '#ffffff',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '12px',
        transition: 'background-color 0.2s ease',
        width: '100%'
    });
    exportButton.textContent = 'Export Prompts';

    // Add hover effect
    exportButton.addEventListener('mouseover', () => {
        exportButton.style.backgroundColor = isDark ? '#2a5c8f' : '#285d8f';
    });
    exportButton.addEventListener('mouseout', () => {
        exportButton.style.backgroundColor = isDark ? '#1e4976' : '#3375b1';
    });

    // Create import button
    const importButton = document.createElement('button');
    Object.assign(importButton.style, {
        padding: '8px',
        backgroundColor: isDark ? '#1e4976' : '#3375b1',
        color: '#ffffff',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '12px',
        transition: 'background-color 0.2s ease',
        width: '100%',
        marginTop: '8px'
    });
    importButton.textContent = 'Import Prompts';

    // Add hover effect
    importButton.addEventListener('mouseover', () => {
        importButton.style.backgroundColor = isDark ? '#2a5c8f' : '#285d8f';
    });
    importButton.addEventListener('mouseout', () => {
        importButton.style.backgroundColor = isDark ? '#1e4976' : '#3375b1';
    });

    // Add export click handler
    exportButton.addEventListener('click', async (e) => {
        e.stopPropagation();
        const prompts = await StorageManager.getPrompts();
        const json = JSON.stringify(prompts, null, 2);
        
        // Create blob and download link
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // Create hidden download link
        const a = document.createElement('a');
        a.href = url;
        a.download = `prompts-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        
        // Cleanup
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Show feedback
        exportButton.textContent = 'Prompts exported!';
        setTimeout(() => {
            exportButton.textContent = 'Export Prompts';
        }, 2000);
    });

    // Add import click handler
    importButton.addEventListener('click', async (e) => {
        e.stopPropagation();
        
        // Create file input
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        
        fileInput.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (file) {
                try {
                    const text = await file.text();
                    const prompts = JSON.parse(text);
                    
                    if (!Array.isArray(prompts)) {
                        throw new Error('Invalid format');
                    }

                    // Save to storage
                    await chrome.storage.local.set({ prompts });
                    
                    // Refresh the prompt list
                    UIManager.refreshPromptList(prompts);
                    
                    // Show success message
                    importButton.textContent = 'Import successful!';
                    setTimeout(() => {
                        importButton.textContent = 'Import Prompts';
                    }, 2000);
                } catch (error) {
                    alert('Invalid JSON file format. Please check your file.');
                }
            }
        });
        
        // Trigger file selection
        fileInput.click();
    });

    // Append all elements (simplified)
    formContainer.appendChild(title);
    formContainer.appendChild(exportButton);
    formContainer.appendChild(importButton);

    return formContainer;
  }

  // Add to UIManager class
  static async createEditView() {
    const isDark = UIManager.isDarkMode();
    const prompts = await StorageManager.getPrompts();
    
    const editContainer = document.createElement('div');
    Object.assign(editContainer.style, {
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        width: '100%',  // Ensure full width
        boxSizing: 'border-box'  // Include padding in width calculation
    });

    // Add title
    const title = document.createElement('div');
    Object.assign(title.style, {
        fontSize: '14px',
        fontWeight: 'bold',
        color: isDark ? '#e1e1e1' : '#333',
        marginBottom: '8px',
        width: '100%'  // Ensure full width
    });
    title.textContent = 'Edit Prompts';

    // Create prompts list container with fixed layout
    const promptsContainer = document.createElement('div');
    Object.assign(promptsContainer.style, {
        maxHeight: '300px',
        overflowY: 'auto',
        width: '100%',  // Ensure full width
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'  // Consistent spacing between items
    });

    // Add each prompt to the list
    prompts.forEach((prompt, index) => {
        const promptItem = document.createElement('div');
        Object.assign(promptItem.style, {
            display: 'flex',
            alignItems: 'center',
            padding: '8px',
            borderRadius: '6px',
            backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5',
            width: '100%',  // Ensure full width
            boxSizing: 'border-box',
            gap: '8px'  // Consistent spacing between elements
        });

        // Prompt title
        const promptTitle = document.createElement('div');
        promptTitle.style.flex = '1';
        promptTitle.style.fontSize = '12px';
        promptTitle.style.color = isDark ? '#e1e1e1' : '#333';
        promptTitle.textContent = prompt.title;

        // Edit icon
        const editIcon = document.createElement('button');
        Object.assign(editIcon.style, {
            width: '24px',
            height: '24px',
            padding: '4px',
            marginLeft: '8px',
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
        });
        editIcon.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 20 20" fill="${isDark ? '#e1e1e1' : '#666'}">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-8.793 8.793-3.536.707.707-3.536 8.794-8.792z"/>
            </svg>
        `;

        // Delete icon
        const deleteIcon = document.createElement('button');
        Object.assign(deleteIcon.style, {
            width: '24px',
            height: '24px',
            padding: '4px',
            marginLeft: '4px',
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
        });
        deleteIcon.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 20 20" fill="${isDark ? '#e1e1e1' : '#666'}">
                <path d="M8.5 4h3a1.5 1.5 0 00-3 0zm-1 0a2.5 2.5 0 015 0h5a.5.5 0 010 1h-1.05l-1.2 10.34A3 3 0 0112.27 18H7.73a3 3 0 01-2.98-2.66L3.55 5H2.5a.5.5 0 010-1h5z"/>
            </svg>
        `;

        // Add hover effects
        [editIcon, deleteIcon].forEach(icon => {
            icon.addEventListener('mouseover', () => {
                icon.style.backgroundColor = isDark ? '#333' : '#e0e0e0';
            });
            icon.addEventListener('mouseout', () => {
                icon.style.backgroundColor = 'transparent';
            });
        });

        // Add edit click handler
        editIcon.addEventListener('click', () => {
            UIManager.showEditForm(prompt, index);
        });

        // Add delete click handler
        deleteIcon.addEventListener('click', () => {
            if (confirm(`Are you sure you want to delete "${prompt.title}"?`)) {
                UIManager.deletePrompt(index);
            }
        });

        // Append elements
        promptItem.appendChild(promptTitle);
        promptItem.appendChild(editIcon);
        promptItem.appendChild(deleteIcon);
        promptsContainer.appendChild(promptItem);
    });

    // Ensure proper stacking of elements
    editContainer.appendChild(title);
    editContainer.appendChild(promptsContainer);

    return editContainer;
  }

  // Add helper methods for editing and deleting prompts
  static async showEditForm(prompt, index) {
    const isDark = UIManager.isDarkMode();
    const promptList = document.getElementById('prompt-list');
    if (!promptList) return;

    const editForm = document.createElement('div');
    Object.assign(editForm.style, {
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
    });

    // Title input
    const titleInput = document.createElement('input');
    Object.assign(titleInput.style, {
        width: '100%',
        padding: '8px',
        borderRadius: '6px',
        border: isDark ? '1px solid #444' : '1px solid #ccc',
        backgroundColor: isDark ? '#2d2d2d' : '#ffffff',
        color: isDark ? '#e1e1e1' : '#222222',
        fontSize: '12px'
    });
    titleInput.value = prompt.title;

    // Content textarea
    const contentTextarea = document.createElement('textarea');
    Object.assign(contentTextarea.style, {
        width: '100%',
        padding: '8px',
        borderRadius: '6px',
        border: isDark ? '1px solid #444' : '1px solid #ccc',
        backgroundColor: isDark ? '#2d2d2d' : '#ffffff',
        color: isDark ? '#e1e1e1' : '#222222',
        fontSize: '12px',
        minHeight: '100px',
        resize: 'vertical'
    });
    contentTextarea.value = prompt.content;

    // Save button
    const saveButton = document.createElement('button');
    Object.assign(saveButton.style, {
        padding: '8px',
        backgroundColor: isDark ? '#1e4976' : '#3375b1',
        color: '#ffffff',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '12px'
    });
    saveButton.textContent = 'Save Changes';

    saveButton.addEventListener('click', async (e) => {
        e.stopPropagation(); // Prevent event bubbling
        const prompts = await StorageManager.getPrompts();
        prompts[index] = {
            title: titleInput.value.trim(),
            content: contentTextarea.value.trim()
        };
        await chrome.storage.local.set({ prompts });
        
        // Refresh the edit view
        const newEditView = await UIManager.createEditView();
        promptList.replaceChild(newEditView, promptList.firstChild);
    });

    editForm.appendChild(titleInput);
    editForm.appendChild(contentTextarea);
    editForm.appendChild(saveButton);

    // Stop propagation on the form to prevent closing
    editForm.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Hide any existing prompt containers
    const existingContainer = promptList.querySelector('div:first-child');
    if (existingContainer) {
        existingContainer.style.display = 'none';
    }

    promptList.insertBefore(editForm, promptList.firstChild);
  }

  static async deletePrompt(index) {
    const prompts = await StorageManager.getPrompts();
    prompts.splice(index, 1);
    await chrome.storage.local.set({ prompts });
    
    // Refresh the edit view
    const promptList = document.getElementById('prompt-list');
    if (promptList) {
        // Hide any existing prompt containers
        const existingContainer = promptList.querySelector('div:first-child');
        if (existingContainer) {
            existingContainer.style.display = 'none';
        }
        
        const newEditView = await UIManager.createEditView();
        promptList.insertBefore(newEditView, promptList.firstChild);
    }
  }

  // Add method to check for cached prompts on initialization
  static async checkForCachedPrompt() {
    const cachedPrompt = window.localStorage.getItem('cachedPrompt');
    if (cachedPrompt) {
        try {
            const prompt = JSON.parse(cachedPrompt);
            const dialog = document.createElement('div');
            const isDark = UIManager.isDarkMode();
            
            Object.assign(dialog.style, {
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
                padding: '20px',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                zIndex: '10001',
                maxWidth: '400px',
                width: '90%'
            });

            dialog.innerHTML = `
                <h3 style="margin-top: 0; color: ${isDark ? '#e1e1e1' : '#333'}">Recovered Unsaved Prompt</h3>
                <p style="color: ${isDark ? '#e1e1e1' : '#333'}">A prompt that couldn't be saved was found:</p>
                <p style="color: ${isDark ? '#e1e1e1' : '#333'}"><strong>Title:</strong> ${prompt.title}</p>
                <div style="text-align: right; margin-top: 15px;">
                    <button id="dialog-retry" style="
                        padding: 8px 16px;
                        backgroundColor: ${isDark ? '#1e4976' : '#3375b1'};
                        color: #ffffff;
                        border: none;
                        borderRadius: 6px;
                        cursor: pointer;
                        marginRight: 8px;
                    ">Try Saving Again</button>
                    <button id="dialog-discard" style="
                        padding: 8px 16px;
                        backgroundColor: ${isDark ? '#444' : '#ddd'};
                        color: ${isDark ? '#fff' : '#333'};
                        border: none;
                        borderRadius: 6px;
                        cursor: pointer;
                    ">Discard</button>
                </div>
            `;

            document.body.appendChild(dialog);

            // Add button handlers
            dialog.querySelector('#dialog-retry').onclick = async () => {
                dialog.remove();
                const promptList = document.getElementById('prompt-list');
                if (promptList) {
                    const creationForm = UIManager.createPromptCreationForm();
                    promptList.insertBefore(creationForm, promptList.firstChild);
                    
                    // Pre-fill the form with cached prompt
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
}

/**
 * Class to manage prompt insertion and overall coordination.
 */
class PromptManager {
  /**
   * Initializes the Prompt Manager by injecting the button when the input box is available.
   */
  static async initialize() {
    try {
      // Wait for the input box to appear in the DOM
      await InputBoxHandler.waitForInputBox();
      console.log('Input box found on initial load.');

      // Check for any cached prompts that failed to save
      await UIManager.checkForCachedPrompt();

      // Retrieve prompts from Chrome storage and inject the Prompt Manager button
      const prompts = await StorageManager.getPrompts();
      UIManager.injectPromptManagerButton(prompts);

      // Observe DOM changes to re-inject the button if necessary
      const observer = new MutationObserver(async () => {
        const inputBox = InputBoxHandler.getInputBox();
        const containerExists = document.getElementById('prompt-button-container');
        if (inputBox && !containerExists) {
          console.log('Input box detected or re-added by MutationObserver.');
          const updatedPrompts = await StorageManager.getPrompts();
          UIManager.injectPromptManagerButton(updatedPrompts);
        }
      });

      // Start observing the document body for changes
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      // Listen for changes in Chrome storage to update prompts dynamically
      StorageManager.onChange(async (changes, area) => {
        if (area === 'sync' && changes.prompts) {
          console.log('Prompts updated in storage.');
          UIManager.refreshPromptList(changes.prompts.newValue);
        }
      });

      // Updated keyboard shortcut listener
      document.addEventListener('keydown', async (e) => {
        const shortcut = await StorageManager.getKeyboardShortcut();
        const modifierPressed = e[shortcut.modifier];
        const shiftPressed = shortcut.requiresShift ? e.shiftKey : true;
        
        if (modifierPressed && shiftPressed && e.key.toLowerCase() === shortcut.key.toLowerCase()) {
          e.preventDefault(); // Prevent default browser behavior
          
          const promptList = document.getElementById('prompt-list');
          if (promptList) {
            if (promptList.style.display === 'none') {
              UIManager.showPromptList(promptList);
            } else {
              UIManager.hidePromptList(promptList);
            }
          }
        }
      });

    } catch (error) {
      console.error(error);
    }
  }

  /**
   * Inserts a prompt into the detected input box.
   * @param {HTMLElement} inputBox - The input box element.
   * @param {string} content - The prompt content to insert.
   * @param {HTMLElement} promptList - The prompt list element to hide after insertion.
   */
  static async insertPrompt(inputBox, content, promptList) {
    // Delegate the insertion to InputBoxHandler
    await InputBoxHandler.insertPrompt(inputBox, content, promptList);
  }

  /**
   * Retrieves the content from the input box.
   * @param {HTMLElement} inputBox - The input box element.
   * @returns {string} The content of the input box.
   */
  static getInputContent(inputBox) {
    // Delegate the retrieval to InputBoxHandler
    return InputBoxHandler.getInputContent(inputBox);
  }
}

// Initialize the Prompt Manager when the script loads
PromptManager.initialize();
