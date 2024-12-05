// inputBoxHandler.js
// This script handles input box detection and interactions on supported websites.

/**
 * Class to handle input box detection and interactions on supported websites.
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
  
      // If no input box is found, log an error
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
  
    /**
     * Inserts a prompt into the detected input box.
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
          // For contenteditable elements (e.g., ChatGPT and Claude)
          inputBox.innerHTML = '';
          // Line break handling for CodeMirror 
          // Split content by line breaks and create elements for each line
          const lines = content.split('\n');
          lines.forEach((line, index) => {
            if (line.trim()) {
              // If line has text content, wrap it in a paragraph
              const p = document.createElement('p');
              p.textContent = line;
              inputBox.appendChild(p);
            } else if (index < lines.length - 1) {
              // If line is empty (and not the last line), add p-wrapped-br
              const p = document.createElement('p');
              const br = document.createElement('br');
              p.appendChild(br);
              inputBox.appendChild(p);
            }
          });
          
          // Add two spaces at the end
          inputBox.appendChild(document.createTextNode('  '));
  
          // Move cursor to the end of the content
          const range = document.createRange();
          range.selectNodeContents(inputBox);
          range.collapse(false);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
  
          // Trigger input event to notify the application of the change
          inputBox.dispatchEvent(new Event('input', { bubbles: true }));
  
        } else if (inputBox.tagName.toLowerCase() === 'textarea') {
          // For textarea elements (e.g., NotebookLM & Poe)
          inputBox.value = content + '  '; // Add two spaces
          inputBox.dispatchEvent(new Event('input', { bubbles: true }));
          inputBox.dispatchEvent(new Event('change', { bubbles: true }));
  
          // Adjust textarea height if necessary to fit content
          inputBox.style.height = 'auto';
          inputBox.style.height = `${inputBox.scrollHeight}px`;
        } else {
          console.error('Unknown input box type.');
          return;
        }
  
        // Hide the prompt list after inserting the prompt
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
