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

    // ChatGPT (chatgpt.com)
    if (url.includes('chatgpt.com')) {
      const inputBox = document.getElementById('prompt-textarea');
      if (inputBox) {
        console.log('Input box found: ChatGPT');
        return inputBox;
      }
    }

    // Deepseek (chat.deepseek.com)
    if (url.includes('deepseek.com')) {
      const inputBox = document.getElementById('chat-input');
      if (inputBox) {
        console.log('Input box found: Deepseek');
        return inputBox;
      }
    }

    // Gemini (gemini.google.com)
    if (url.includes('gemini.google.com')) {
      const inputBox = document.querySelector('div.ql-editor[contenteditable="true"]');
      if (inputBox) {
        console.log('Input box found: Gemini Old');
        return inputBox;
      }
    }

    // Gemini (gemini.google.com)
    if (url.includes('gemini.google.com')) {
      const inputBox = document.querySelector('div.textarea.placeholder.new-input-ui');
      if (inputBox) {
        console.log('Input box found: Gemini New');
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

    // Microsoft Copilot (copilot.microsoft.com)
    if (url.includes('copilot.microsoft.com')) {
      const inputBox = document.querySelector('#userInput');
      if (inputBox) {
        console.log('Input box found: Microsoft Copilot');
        return inputBox;
      }
    }

    // Kimi (kimi.com)
    // COMMENT: Kimi's chat box is a contenteditable div with class `chat-input-editor`.
    // COMMENT: We prefer a direct, stable selector over brittle full DOM paths.
    if (url.includes('kimi.com')) {
      const inputBox = document.querySelector('div.chat-input-editor[contenteditable="true"]')
        || document.querySelector('div.chat-input-editor');
      if (inputBox) {
        console.log('Input box found: Kimi');
        return inputBox;
      }
    }

    // GitHub Copilot Chat (github.com)
    // COMMENT: The Copilot chat textarea in GitHub UI uses a stable id `copilot-chat-textarea`.
    // COMMENT: We target it directly so prompts can be inserted while browsing repositories, PRs, etc.
    if (url.includes('github.com')) {
      const inputBox = document.querySelector('#copilot-chat-textarea');
      if (inputBox) {
        console.log('Input box found: GitHub Copilot');
        return inputBox;
      }
    }

    // OpenAI Platform Chat (platform.openai.com)
    // COMMENT: The Platform chat uses a <textarea> with a stable placeholder "Chat with your prompt...".
    // COMMENT: Target by placeholder first to avoid brittle deep selectors; fall back to a textarea under #root.
    if (url.includes('platform.openai.com')) {
      const inputBox = document.querySelector('textarea[placeholder="Chat with your prompt..."]')
        || document.querySelector('#root textarea');
      if (inputBox) {
        console.log('Input box found: OpenAI Platform Chat');
        return inputBox;
      }
    }

    // Mistral Le Chat (chat.mistral.ai)
    // COMMENT: Le Chat uses a plain <textarea> with name `message.text` and a clear placeholder.
    // COMMENT: We target by name first, then placeholder, then a safe form textarea fallback.
    if (url.includes('chat.mistral.ai')) {
      const inputBox = document.querySelector('textarea[name="message.text"]')
        || document.querySelector('textarea[placeholder="Ask Le Chat anything"]')
        || document.querySelector('form textarea');
      if (inputBox) {
        console.log('Input box found: Mistral Le Chat');
        return inputBox;
      }
    }

    // OpenRouter (openrouter.ai)
    // COMMENT: OpenRouter uses a plain <textarea> with placeholder "Start a new message...".
    // COMMENT: Prefer placeholder targeting; fall back to a generic form textarea to remain resilient.
    if (url.includes('openrouter.ai')) {
      const inputBox = document.querySelector('textarea[placeholder="Start a new message..."]')
        || document.querySelector('form textarea')
        || document.querySelector('textarea');
      if (inputBox) {
        console.log('Input box found: OpenRouter');
        return inputBox;
      }
    }

    // Grok (grok.com)
    if (url.includes('grok.com')) {


      // First approach: Using a specific selector that targets the textarea with dir="auto"
      const inputBox = document.querySelector('form textarea[dir="auto"]');
      if (inputBox) {
        console.log('Input box found: Grok (dir=auto)');
        return inputBox;
      }

      // Second approach: Find the placeholder span and get its sibling textarea
      const placeholderSpan = document.querySelector('span.pointer-events-none:contains("What do you want to know?")');
      if (placeholderSpan && placeholderSpan.parentNode) {
        const textareaInSameParent = placeholderSpan.parentNode.querySelector('textarea');
        if (textareaInSameParent) {
          console.log('Input box found: Grok (via placeholder span)');
          return textareaInSameParent;
        }
      }

      // Third approach: Try finding placeholder by text content with any query method
      const allSpans = document.querySelectorAll('span');
      for (const span of allSpans) {
        if (span.textContent === 'What do you want to know?' && span.parentNode) {
          const textareaInSameParent = span.parentNode.querySelector('textarea');
          if (textareaInSameParent) {
            console.log('Input box found: Grok (via placeholder text)');
            return textareaInSameParent;
          }
        }
      }

      // Final fallback: general form textarea
      const fallbackInputBox = document.querySelector('form textarea');
      if (fallbackInputBox) {
        console.log('Input box found: Grok (fallback)');
        return fallbackInputBox;
      }
    }

    // Grok on X.com (x.com/i/grok)
    if (url.includes('x.com') && window.location.pathname.includes('/i/grok')) {
      // Target the textarea used for Grok on X.com
      const inputBox = document.querySelector('textarea[placeholder="Ask anything"]');
      if (inputBox) {
        console.log('Input box found: Grok on X.com');
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

    // Perplexity (perplexity.ai)
    if (url.includes('perplexity.ai')) {
      const inputBox = document.querySelector('#ask-input');
      if (inputBox) {
        console.log('Input box found: Perplexity');
        return inputBox;
      }
    }

    // LMArena (lmarena.ai)
    if (url.includes('lmarena.ai')) {
      const inputBox = document.querySelector('textarea[name="message"]');
      if (inputBox) {
        console.log('Input box found: LMArena');
        return inputBox;
      }
    }

    // Google AI Studio (aistudio.google.com)
    if (url.includes('aistudio.google.com')) {
      const inputBox = document.querySelector('textarea[aria-label="Type something or tab to choose an example prompt"]');
      if (inputBox) {
        console.log('Input box found: Google AI Studio');
        return inputBox;
      }
    }

    // ChatLLM (apps.abacus.ai/chatllm)
    if (url.includes('apps.abacus.ai')) {
      const inputBox = document.querySelector('textarea[placeholder="Write something..."]');
      if (inputBox) {
        console.log('Input box found: ChatLLM');
        return inputBox;
      }
    }

    // Qwen (chat.qwen.ai)
    if (url.includes('qwen.ai')) {
      const inputBox = document.getElementById('chat-input');
      if (inputBox) {
        console.log('Input box found: Qwen');
        return inputBox;
      }
    }

    // If no input box is found, log an error
    // console.error('Input box not found on this page.');
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
        reject('Input box not found after 10 seconds.');
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
      console.error('Missing required parameters for insertPrompt', { inputBox, content, promptList });
      return;
    }

    inputBox.focus();
    try {
      console.log('Inserting prompt:', { content, inputBox, promptList });
      // COMMENT: Read setting that controls append vs overwrite behavior
      const disableOverwrite = await new Promise(resolve => {
        try {
          chrome.storage.local.get('disableOverwrite', data => {
            if (chrome.runtime?.lastError) { resolve(false); return; }
            resolve(Boolean(data?.disableOverwrite));
          });
        } catch (_) { resolve(false); }
      });

      if (inputBox.contentEditable === 'true') {
        if (disableOverwrite) {
          // COMMENT: Append mode — add content at the end without clearing existing text
          // Ensure caret is at the end before appending
          const endRange = document.createRange();
          endRange.selectNodeContents(inputBox);
          endRange.collapse(false);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(endRange);

          if (content.includes('\n')) {
            const lines = content.split('\n');
            lines.forEach((line, index) => {
              const p = document.createElement('p');
              if (line.trim()) {
                p.textContent = line;
              } else {
                p.appendChild(document.createElement('br'));
              }
              inputBox.appendChild(p);
            });
          } else {
            const lastNode = inputBox.lastChild;
            const needsSpace = lastNode && lastNode.nodeType === Node.TEXT_NODE && !lastNode.textContent.endsWith(' ');
            const prefix = needsSpace ? ' ' : '';
            inputBox.appendChild(document.createTextNode(prefix + content));
          }
        } else {
          // COMMENT: Overwrite mode — replace content and simulate a paste for better compatibility
          inputBox.innerHTML = '';

          const dataTransfer = new DataTransfer();
          dataTransfer.setData('text/plain', content);
          const pasteEvent = new ClipboardEvent('paste', {
            clipboardData: dataTransfer,
            bubbles: true,
            cancelable: true,
          });
          inputBox.dispatchEvent(pasteEvent);

          // Fallback for line breaks if paste event doesn't handle them perfectly
          if (content.includes('\n')) {
            const lines = content.split('\n');
            inputBox.innerHTML = '';
            lines.forEach((line, index) => {
              if (line.trim()) {
                const p = document.createElement('p');
                p.textContent = line;
                inputBox.appendChild(p);
              } else if (index < lines.length - 1) {
                const p = document.createElement('p');
                const br = document.createElement('br');
                p.appendChild(br);
                inputBox.appendChild(p);
              }
            });
          } else {
            // For single-line prompts, ensure content is set
            inputBox.textContent = content;
          }
        }

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

        // Final fallback: if still empty, set innerText
        if (!inputBox.textContent || inputBox.textContent.trim() === '') {
          inputBox.innerText = content + '  ';
          inputBox.dispatchEvent(new Event('input', { bubbles: true }));
        }
      } else if (inputBox.tagName.toLowerCase() === 'textarea') {
        // COMMENT: For textareas, either overwrite or append
        if (disableOverwrite) {
          const existing = inputBox.value || '';
          const needsSpace = existing && !/\s$/.test(existing);
          const spacer = needsSpace ? ' ' : '';
          inputBox.value = existing + spacer + content + '  ';
        } else {
          inputBox.value = content + '  ';
        }
        inputBox.dispatchEvent(new Event('input', { bubbles: true }));
        inputBox.dispatchEvent(new Event('change', { bubbles: true }));
        inputBox.style.height = 'auto';
        inputBox.style.height = `${inputBox.scrollHeight}px`;
      } else {
        console.error('Unknown input box type.', { inputBox });
        return;
      }
      PromptUIManager.hidePromptList(promptList);
    } catch (error) {
      console.error('Error inserting prompt:', error, { content, inputBox, promptList });
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