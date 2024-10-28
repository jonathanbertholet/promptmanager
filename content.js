console.log("Prompt Manager content script loaded.");

/**
 * Class to handle input box detection and interactions.
 */
class InputBoxHandler {
  /**
   * Detects and retrieves the input box from supported websites.
   * @returns {HTMLElement|null} The input box element or null if not found.
   */
  static getInputBox() {
    const url = window.location.hostname;

    // ChatGPT (chat.openai.com)
    if (url.includes('chatgpt.com')) {
      const inputBox = document.getElementById('prompt-textarea');
      if (inputBox) {
        console.log('Input box found: ChatGPT');
        return inputBox;
      }
    }

    // Gemini (gemini.google.com)
    if (url.includes('gemini.google.com')) {
      const inputBox = document.querySelector('div.ql-editor[contenteditable="true"]');
      if (inputBox) {
        console.log('Input box found: Gemini');
        return inputBox;
      }
    }

    // NotebookLM (notebooklm.google.com)
    if (url.includes('notebooklm.google.com')) {
      const inputBox = document.querySelector('textarea');
      if (inputBox) {
        console.log('Input box found: NotebookLM');
        return inputBox;
      }
    }

    // Claude (claude.ai)
    if (url.includes('claude.ai')) {
      const inputBox = document.querySelector('div[contenteditable="true"]');
      if (inputBox) {
        console.log('Input box found: Claude');
        return inputBox;
      }
    }

    // Poe (poe.com)
    if (url.includes('poe.com')) {
      const inputBox = document.querySelector('textarea[class^="GrowingTextArea_textArea__"]');
      if (inputBox) {
        console.log('Input box found: Poe');
        return inputBox;
      }
    }

    console.error('Input box not found on this page.');
    return null;
  }

  /**
   * Waits for the input box to be available in the DOM.
   * @returns {Promise<HTMLElement>} Resolves with the input box element.
   */
  static waitForInputBox() {
    return new Promise((resolve, reject) => {
      const checkExist = setInterval(() => {
        const inputBox = InputBoxHandler.getInputBox();
        if (inputBox) {
          clearInterval(checkExist);
          resolve(inputBox);
        }
      }, 500); // Check every 500ms

      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkExist);
        reject("Input box not found after 10 seconds.");
      }, 10000);
    });
  }
}

/**
 * Class to manage Chrome storage interactions.
 */
class StorageManager {
  /**
   * Retrieves prompts from Chrome storage.
   * @returns {Promise<Array>} Resolves with the list of prompts.
   */
  static getPrompts() {
    return new Promise((resolve) => {
      chrome.storage.sync.get('prompts', data => {
        resolve(data.prompts || []);
      });
    });
  }

  /**
   * Saves a new prompt to Chrome storage.
   * @param {Object} prompt - The prompt object to save.
   * @returns {Promise<void>}
   */
  static savePrompt(prompt) {
    return new Promise((resolve) => {
      chrome.storage.sync.get('prompts', data => {
        const prompts = data.prompts || [];
        prompts.push(prompt);
        chrome.storage.sync.set({ prompts }, () => {
          console.log('New prompt saved');
          resolve();
        });
      });
    });
  }

  /**
   * Sets up a listener for storage changes.
   * @param {Function} callback - The callback to execute on changes.
   */
  static onChange(callback) {
    chrome.storage.onChanged.addListener(callback);
  }

  /**
   * Gets the button position from storage
   * @returns {Promise<{x: number, y: number}>} The saved position or default values
   */
  static getButtonPosition() {
    return new Promise((resolve) => {
      chrome.storage.sync.get('buttonPosition', data => {
        resolve(data.buttonPosition || { x: 75, y: 100 }); // Default position
      });
    });
  }

  /**
   * Saves the button position to storage
   * @param {Object} position - The position object with x and y coordinates
   */
  static saveButtonPosition(position) {
    return new Promise((resolve) => {
      chrome.storage.sync.set({ buttonPosition: position }, resolve);
    });
  }
}

/**
 * Class to manage UI components and interactions.
 */
class UIManager {
  /**
   * Injects the Prompt Manager button into the page.
   * @param {Array} prompts - List of prompt objects to display.
   */
  static async injectPromptManagerButton(prompts) {
    // Prevent duplicate injections
    if (document.getElementById('prompt-button-container')) {
      console.log('Prompt button container already exists.');
      return;
    }

    // Get saved position
    const position = await StorageManager.getButtonPosition();

    // Create container for the button and prompt list
    const container = document.createElement('div');
    container.id = 'prompt-button-container';
    Object.assign(container.style, {
      position: 'fixed',
      zIndex: '9999',
      bottom: `${position.y}px`,
      right: `${position.x}px`,
      width: '50px',
      height: '50px',
      userSelect: 'none',
      cursor: 'move', // Add cursor style for dragging
    });
    console.log('Container created');

    // Create the button
    const button = document.createElement('button');
    button.id = 'prompt-button';

    // Add base styles
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
      transition: 'all 0.3s ease'  // Changed to 'all' for better compatibility
    };

    // Apply styles directly to button element
    Object.entries(buttonStyles).forEach(([key, value]) => {
      button.style[key] = value;
    });

    // Add hover effects using CSS
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

    // Append button to container
    container.appendChild(button);
    console.log('Button appended to container');

    // Create the prompt list dropdown
    const promptList = UIManager.createPromptList(prompts);
    container.appendChild(promptList);

    // Append the entire container to the body
    document.body.appendChild(container);
    console.log('Container appended to body');

    // Add hover timer properties
    let closeTimer = null;
    let isOpen = false;  // Track open state
    const CLOSE_DELAY = 1000; // 1 second delay before closing

    // Add click handler for override
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

    // Handle hover events
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

    // Add document click handler to close when clicking outside
    document.addEventListener('click', (e) => {
      if (isOpen && !button.contains(e.target) && !promptList.contains(e.target)) {
        UIManager.hidePromptList(promptList);
        isOpen = false;
      }
    });

    // Add drag functionality
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;

    container.addEventListener('mousedown', startDragging);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', stopDragging);

    function startDragging(e) {
      // Only start drag if it's the button being clicked (not the prompt list)
      if (e.target.id === 'prompt-button') {
        isDragging = true;
        
        const rect = container.getBoundingClientRect();
        initialX = e.clientX;
        initialY = e.clientY;
        
        // Store initial right/bottom values
        currentX = parseInt(container.style.right);
        currentY = parseInt(container.style.bottom);
        
        container.style.transition = 'none'; // Disable transitions while dragging
      }
    }

    function drag(e) {
      if (isDragging) {
        e.preventDefault();
        
        // Calculate the delta (how far we've moved)
        const deltaX = initialX - e.clientX;
        const deltaY = initialY - e.clientY;
        
        // Update position (add delta to initial position)
        let newX = currentX + deltaX;
        let newY = currentY + deltaY;

        // Constrain to window bounds
        newX = Math.min(Math.max(newX, 0), window.innerWidth - container.offsetWidth);
        newY = Math.min(Math.max(newY, 0), window.innerHeight - container.offsetHeight);

        container.style.right = `${newX}px`;
        container.style.bottom = `${newY}px`;
      }
    }

    async function stopDragging() {
      if (isDragging) {
        isDragging = false;
        container.style.transition = 'all 0.3s ease'; // Re-enable transitions

        // Save the new position
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
    Object.assign(promptList.style, {
      position: 'absolute',
      bottom: '60px',
      right: '0',
      backgroundColor: '#fff',
      border: '1px solid #ccc',
      padding: '10px',
      borderRadius: '8px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
      display: 'none',
      width: '200px',
      zIndex: '10000',
      opacity: '0',
      transform: 'translateY(20px)',
      transition: 'opacity 0.1s ease, transform 0.1s ease',
    });

    // Create a container for prompts that can scroll
    const promptsContainer = document.createElement('div');
    Object.assign(promptsContainer.style, {
      maxHeight: '300px',  // Reduced to accommodate search bar
      overflowY: 'auto',
      marginBottom: '8px'
    });

    // Populate the prompts container
    prompts.forEach(prompt => {
      const promptItem = UIManager.createPromptItem(prompt);
      promptsContainer.appendChild(promptItem);
    });

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
    Object.assign(promptItem.style, {
      padding: '4px',
      borderRadius: '6px',
      fontFamily: 'Helvetica, Verdana, Geneva, Tahoma, sans-serif',
      fontSize: '14px',
      color: '#222222',
      cursor: 'pointer',
      transition: 'background-color 0.2s ease'
    });
    promptItem.textContent = prompt.title;

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

    // Event handlers remain the same, but hover effect is now handled by CSS
    promptItem.addEventListener('mouseover', () => {
      // Only apply hover effect if not already selected by keyboard
      if (promptItem.style.backgroundColor !== '#f0f0f0') {
        promptItem.style.backgroundColor = '#f5f5f5';
      }
    });

    promptItem.addEventListener('mouseout', () => {
      // Only remove hover effect if not selected by keyboard
      if (promptItem.style.backgroundColor !== '#f0f0f0') {
        promptItem.style.backgroundColor = '';
      }
    });

    return promptItem;
  }

  /**
   * Creates the bottom menu with the "Save Prompt" button.
   * @returns {HTMLElement} The bottom menu element.
   */
  static createBottomMenu() {
    const bottomMenu = document.createElement('div');
    Object.assign(bottomMenu.style, {
      position: 'sticky',
      bottom: '0',
      backgroundColor: '#fff',
      borderTop: '1px solid #eee',
      paddingTop: '8px'
    });

    // Create search input
    const searchInput = document.createElement('input');
    searchInput.id = 'prompt-search-input';  // Add ID for easier reference
    searchInput.type = 'text';
    searchInput.placeholder = 'Type to search';
    Object.assign(searchInput.style, {
      width: '100%',
      paddingLeft: '5px',
      paddingTop: '2px',
      paddingBottom: '2px',
      color: '#222222',
      fontSize: '12px',
      fontFamily: 'Helvetica, Verdana, Geneva, Tahoma, sans-serif',
      borderRadius: '6px',
      border: '1px solid #3375b1',
      boxSizing: 'border-box',
      minHeight: '12px',
      userSelect: 'none',  // Add this line
      WebkitUserSelect: 'none',  // Add this line for webkit browsers
    });

    let selectedIndex = -1;

    // Add keyboard navigation
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

    // Helper function to update selection highlighting
    function updateSelection(visiblePrompts) {
      visiblePrompts.forEach((item, index) => {
        if (index === selectedIndex) {
          item.style.backgroundColor = '#f0f0f0';
        } else {
          item.style.backgroundColor = '';
        }
      });

      // Ensure selected item is visible in scroll
      if (selectedIndex >= 0) {
        const selectedItem = visiblePrompts[selectedIndex];
        selectedItem.scrollIntoView({ block: 'nearest' });
      }
    }

    // Reset selection when filtering
    searchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase();
      const promptItems = document.querySelectorAll('#prompt-list > div:first-child > div');
      
      selectedIndex = -1; // Reset selection
      promptItems.forEach(async item => {
        // Get the corresponding prompt object from storage
        const prompts = await StorageManager.getPrompts();
        const prompt = prompts.find(p => p.title === item.textContent);
        
        if (prompt) {
          const title = prompt.title.toLowerCase();
          const content = prompt.content.toLowerCase();
          // Show item if either title or content includes the search term
          item.style.display = (title.includes(searchTerm) || content.includes(searchTerm)) ? 'block' : 'none';
          item.style.backgroundColor = ''; // Clear any highlighting
        }
      });
    });

    // Create save button with initial hidden state
    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save prompt';
    Object.assign(saveButton.style, {
      width: '100%',
      padding: '5px',
      backgroundColor: '#3375b1',
      fontSize: '12px',
      fontFamily: 'Helvetica, Verdana, Geneva, Tahoma, sans-serif',
      color: '#fff',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      marginBottom: '8px',
      display: 'none'  // Initially hidden
    });

    // Check initial content state
    const inputBox = InputBoxHandler.getInputBox();
    if (inputBox) {
      const content = PromptManager.getInputContent(inputBox);
      saveButton.style.display = content.trim() ? 'block' : 'none';
    }

    // Modify save button click handler
    saveButton.addEventListener('click', () => {
      const inputBox = InputBoxHandler.getInputBox();
      if (inputBox) {
        const content = PromptManager.getInputContent(inputBox);
        
        if (content.trim()) {
          saveButton.style.display = 'none';
          searchInput.style.display = 'none';  // Hide search input when saving
          const titleInputDiv = UIManager.createTitleInputDiv(content);
          const promptList = document.getElementById('prompt-list');
          promptList.appendChild(titleInputDiv);
        } else {
          alert('The input area is empty. Please enter some text before saving.');
        }
      }
    });

    bottomMenu.appendChild(saveButton);
    bottomMenu.appendChild(searchInput);
    return bottomMenu;
  }

  /**
   * Creates the title input div for saving prompts.
   * @param {string} content - The content of the prompt.
   * @returns {HTMLElement} The title input div.
   */
  static createTitleInputDiv(content) {
    const titleInputDiv = document.createElement('div');
    titleInputDiv.style.marginTop = '4px';
    
    // Create a save button for the title
    const saveTitleButton = document.createElement('button');
    saveTitleButton.textContent = 'Save';
    Object.assign(saveTitleButton.style, {
      width: '100%',
      padding: '5px',
      backgroundColor: '#3375b1',
      color: '#fff',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      fontSize: '12px',
      fontFamily: 'Helvetica, Verdana, Geneva, Tahoma, sans-serif',
      marginBottom: '8px'  // Add margin below the button
    });
    
    // Create an input for the title
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.placeholder = 'Enter title';
    Object.assign(titleInput.style, {
      fontSize: '12px',
      fontFamily: 'Helvetica, Verdana, Geneva, Tahoma, sans-serif',
      borderRadius: '6px',
      width: '100%',
      padding: '3px',
      boxSizing: 'border-box',
      color: '#222222',
    });

    // Append elements in reverse order (button first, then input)
    titleInputDiv.appendChild(saveTitleButton);
    titleInputDiv.appendChild(titleInput);

    saveTitleButton.addEventListener('click', async () => {
      const title = titleInput.value.trim();
      if (title) {
        await StorageManager.savePrompt({ title, content });
        titleInputDiv.remove();
        
        // Show the save button and search input again
        const promptList = document.getElementById('prompt-list');
        if (promptList) {
          const saveButton = promptList.querySelector('button:last-child');
          const searchInput = document.getElementById('prompt-search-input');
          if (saveButton) saveButton.style.display = 'block';
          if (searchInput) {
            searchInput.style.display = 'block';
            searchInput.focus();  // Focus search input after saving
          }
        }
        
        // Refresh the prompt list
        const prompts = await StorageManager.getPrompts();
        UIManager.refreshPromptList(prompts);
      } else {
        alert('Please enter a title for the prompt.');
      }
    });

    return titleInputDiv;
  }

  /**
   * Toggles the visibility of the prompt list.
   * @param {HTMLElement} promptList - The prompt list element.
   */
  static togglePromptList(promptList) {
    // This method can be simplified since we're using hover now
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
   * Hides the prompt list with animation.
   * @param {HTMLElement} promptList - The prompt list element.
   */
  static hidePromptList(promptList) {
    if (!promptList) {
      console.error('Prompt list not found for hiding.');
      return;
    }

    promptList.style.opacity = '0';
    promptList.style.transform = 'translateY(20px)';
    
    // Reset search and selection when hiding
    const searchInput = document.getElementById('prompt-search-input');
    if (searchInput) {
      searchInput.value = '';
    }
    
    // Reset all items to visible and clear highlighting
    const promptItems = document.querySelectorAll('#prompt-list > div:first-child > div');
    promptItems.forEach(item => {
      item.style.display = 'block';
      item.style.backgroundColor = '';
    });

    setTimeout(() => {
      if (promptList) {
        promptList.style.display = 'none';
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

    // Clear existing content
    promptList.innerHTML = '';

    // Create new scrollable container for prompts
    const promptsContainer = document.createElement('div');
    Object.assign(promptsContainer.style, {
      maxHeight: '350px',
      overflowY: 'auto',
      marginBottom: '8px'
    });

    // Add prompts to the container
    prompts.forEach(prompt => {
      const promptItem = UIManager.createPromptItem(prompt);
      promptsContainer.appendChild(promptItem);
    });

    // Add the container and a new bottom menu
    promptList.appendChild(promptsContainer);
    promptList.appendChild(UIManager.createBottomMenu());
  }

  // Add this new method to handle focusing the search input
  static focusSearchInput() {
    const searchInput = document.getElementById('prompt-search-input');
    if (searchInput) {
      // Force focus to occur after the current execution stack
      window.requestAnimationFrame(() => {
        searchInput.focus();
        searchInput.select();  // Optionally select any existing text
      });
    }
  }

  // Update the show/hide methods to include focus
  static showPromptList() {
    const promptList = document.getElementById('prompt-list');
    if (promptList) {
      promptList.style.display = 'block';
      setTimeout(() => {
        promptList.style.opacity = '1';
        promptList.style.transform = 'translateY(0)';
        UIManager.focusSearchInput();  // Focus search input when showing list
      }, 0);
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
      // Wait for the input box to appear
      await InputBoxHandler.waitForInputBox();
      console.log('Input box found on initial load.');

      // Retrieve prompts from Chrome storage and inject the button
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

      // Add input event listener to monitor textarea content
      const inputBox = await InputBoxHandler.waitForInputBox();
      inputBox.addEventListener('input', () => {
        const saveButton = document.querySelector('#prompt-list button:first-child');
        if (saveButton) {
          const content = PromptManager.getInputContent(inputBox);
          saveButton.style.display = content.trim() ? 'block' : 'none';
        }
      });

    } catch (error) {
      console.error(error);
    }
  }

  /**
   * Inserts a prompt into the input box.
   * @param {HTMLElement} inputBox - The input box element.
   * @param {string} content - The prompt content to insert.
   * @param {HTMLElement} promptList - The prompt list element to hide after insertion.
   */
  static async insertPrompt(inputBox, content, promptList) {
    if (!inputBox || !content || !promptList) {
      console.error('Missing required parameters for insertPrompt');
      return;
    }

    inputBox.focus();

    try {
      if (inputBox.contentEditable === 'true') {
        // For contenteditable elements (ChatGPT and Claude)
        inputBox.innerHTML = '';
        const textNode = document.createTextNode(content);
        inputBox.appendChild(textNode);

        // Move cursor to the end
        const range = document.createRange();
        range.selectNodeContents(inputBox);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);

        // Trigger input event
        inputBox.dispatchEvent(new Event('input', { bubbles: true }));

      } else if (inputBox.tagName.toLowerCase() === 'textarea') {
        // For textarea elements (NotebookLM & Poe)
        inputBox.value = content;
        inputBox.dispatchEvent(new Event('input', { bubbles: true }));
        inputBox.dispatchEvent(new Event('change', { bubbles: true }));

        // Adjust textarea height if necessary
        inputBox.style.height = 'auto';
        inputBox.style.height = `${inputBox.scrollHeight}px`;
      } else {
        console.error('Unknown input box type.');
        return;
      }

      // Hide the prompt list after insertion
      UIManager.hidePromptList(promptList);
    } catch (error) {
      console.error('Error inserting prompt:', error);
    }
  }

  /**
   * Retrieves the content from the input box.
   * @param {HTMLElement} inputBox - The input box element.
   * @returns {string} The content of the input box.
   */
  static getInputContent(inputBox) {
    if (inputBox.contentEditable === 'true') {
      return inputBox.innerText;
    } else if (inputBox.tagName.toLowerCase() === 'textarea') {
      return inputBox.value;
    }
    return '';
  }
}

// Initialize the Prompt Manager on script load
PromptManager.initialize();

