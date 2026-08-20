// inputBoxHandler.js
// This script handles input box detection and interactions on supported websites.

/**
 * Class to handle input box detection and interactions on supported websites.
 */
class InputBoxHandler {
  // COMMENT: Cache provider config so waitForInputBox polling does not re-fetch JSON every 500ms
  static _providersCache = null;
  static _providersPromise = null;
  // COMMENT: Reuse the last resolved input briefly to avoid repeated DOM scans on hot paths
  static _cachedInputBox = null;
  static _cachedInputAt = 0;
  static _inputCacheMs = 2500;
  static _pinnedStorageModule = null;
  static _waitObserver = null;
  static _waitObserverTimer = null;

  /**
   * COMMENT: Return a cached input when it is still connected and looks usable.
   * @returns {HTMLElement|null}
   */
  static _getCachedInput() {
    const cached = InputBoxHandler._cachedInputBox;
    if (!(cached instanceof HTMLElement)) return null;
    if (!cached.isConnected) {
      InputBoxHandler._cachedInputBox = null;
      return null;
    }
    if (Date.now() - InputBoxHandler._cachedInputAt > InputBoxHandler._inputCacheMs) {
      InputBoxHandler._cachedInputBox = null;
      return null;
    }
    if (InputBoxHandler._scoreInputCandidate(cached) < 0) {
      InputBoxHandler._cachedInputBox = null;
      return null;
    }
    return cached;
  }

  /**
   * COMMENT: Store a successful input lookup for short-lived reuse.
   * @param {HTMLElement|null} inputBox
   */
  static _rememberInput(inputBox) {
    if (inputBox instanceof HTMLElement) {
      InputBoxHandler._cachedInputBox = inputBox;
      InputBoxHandler._cachedInputAt = Date.now();
      return;
    }
    InputBoxHandler._cachedInputBox = null;
    InputBoxHandler._cachedInputAt = 0;
  }

  /**
   * COMMENT: Drop cached input after pin changes or failed insert attempts.
   */
  static _invalidateInputCache() {
    InputBoxHandler._cachedInputBox = null;
    InputBoxHandler._cachedInputAt = 0;
  }

  /**
   * COMMENT: Load and cache llm_providers.json once per page session.
   * @returns {Promise<Array>}
   */
  static async _loadProviders() {
    if (InputBoxHandler._providersCache) return InputBoxHandler._providersCache;
    if (InputBoxHandler._providersPromise) return InputBoxHandler._providersPromise;

    InputBoxHandler._providersPromise = (async () => {
      try {
        const response = await fetch(chrome.runtime.getURL('llm_providers.json'));
        if (response.ok) {
          const data = await response.json();
          InputBoxHandler._providersCache = data.llm_providers || [];
        } else {
          InputBoxHandler._providersCache = [];
        }
      } catch (error) {
        console.error('Failed to load llm_providers.json:', error);
        InputBoxHandler._providersCache = [];
      }
      return InputBoxHandler._providersCache;
    })();

    return InputBoxHandler._providersPromise;
  }

  /**
   * COMMENT: Read open or closed shadow roots — required for Gemini custom elements on /app.
   * @param {HTMLElement} element
   * @returns {ShadowRoot|null}
   */
  static _getShadowRoot(element) {
    if (!(element instanceof HTMLElement)) return null;
    try {
      if (typeof chrome !== 'undefined' && chrome.dom?.openOrClosedShadowRoot) {
        const root = chrome.dom.openOrClosedShadowRoot(element);
        if (root) return root;
      }
    } catch (_) {
      // COMMENT: Fall back to the open shadowRoot property when chrome.dom is unavailable
    }
    return element.shadowRoot || null;
  }

  /**
   * COMMENT: Walk child nodes inside a shadow root instead of querySelectorAll('*').
   * @param {ShadowRoot|DocumentFragment} root
   * @param {(shadowRoot: ShadowRoot) => void} visitShadow
   */
  static _walkNestedShadows(root, visitShadow) {
    const stack = root instanceof ShadowRoot || root instanceof DocumentFragment
      ? [...root.children]
      : [];

    while (stack.length) {
      const node = stack.pop();
      if (!(node instanceof HTMLElement)) continue;

      const nestedShadow = InputBoxHandler._getShadowRoot(node);
      if (nestedShadow) visitShadow(nestedShadow);

      for (let i = node.children.length - 1; i >= 0; i -= 1) {
        stack.push(node.children[i]);
      }
    }
  }

  /**
   * COMMENT: Known Gemini hosts — avoids scanning every element on the page.
   * @returns {HTMLElement[]}
   */
  static _getKnownShadowHosts() {
    const hosts = new Set();
    const selectors = [
      'rich-textarea',
      'input-area-v2',
      'input-container',
      '[data-lexical-editor="true"]',
      '.ql-container',
      '.ProseMirror',
    ];

    for (const selector of selectors) {
      try {
        document.querySelectorAll(selector).forEach((node) => {
          if (node instanceof HTMLElement) hosts.add(node);
        });
      } catch (_) {
        // Invalid selector — skip
      }
    }

    return [...hosts];
  }

  static _collectGeminiCandidates(selector) {
    const results = [];
    const seen = new Set();
    const addMatches = (root) => {
      if (!root?.querySelectorAll) return;
      try {
        root.querySelectorAll(selector).forEach((node) => {
          if (!(node instanceof HTMLElement) || seen.has(node)) return;
          seen.add(node);
          results.push(node);
        });
      } catch (_) {
        // Invalid selector — skip
      }
    };

    addMatches(document);

    const hosts = document.querySelectorAll('rich-textarea, input-area-v2, input-container');
    for (const host of hosts) {
      addMatches(host);
      const shadow = InputBoxHandler._getShadowRoot(host);
      if (shadow) {
        addMatches(shadow);
        InputBoxHandler._walkNestedShadows(shadow, addMatches);
      }
    }

    return results;
  }

  /**
   * COMMENT: Score how likely an element is the main chat input (higher = better).
   * @param {HTMLElement} node
   * @returns {number}
   */
  static _scoreInputCandidate(node) {
    if (!(node instanceof HTMLElement)) return -1;

    const style = window.getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    const hasVisibleBox = rect.width > 0 && rect.height > 0;

    if (style.display === 'none' || style.visibility === 'hidden') return -1;
    if (!hasVisibleBox && node.offsetParent === null && style.position !== 'fixed') return -1;

    let score = 0;
    if (rect.width < 80 || rect.height < 16) score -= 50;

    // COMMENT: Chat inputs usually sit in the lower half of the viewport
    if (rect.top > window.innerHeight * 0.45) score += 40;
    if (rect.bottom > window.innerHeight * 0.65) score += 20;

    // COMMENT: On gemini.google.com/app the composer can sit higher on the landing view
    if (/gemini\.google\.com/i.test(window.location.hostname)
      && /\/(?:u\/\d+\/)?app\/?$/i.test(window.location.pathname)
      && rect.top > window.innerHeight * 0.2) {
      score += 25;
    }

    // COMMENT: Prefer known LLM input containers (Gemini, Quill, etc.)
    if (node.closest('rich-textarea, input-area-v2, input-container, .text-input-field, .ql-container')) {
      score += 50;
    }

    if (node.classList.contains('ql-editor') || node.classList.contains('ProseMirror')) score += 30;

    const label = `${node.getAttribute('aria-label') || ''} ${node.getAttribute('placeholder') || ''}`.toLowerCase();
    if (/prompt|message|ask|query|enter|type|chat|gemini/.test(label)) score += 25;

    if (node.isContentEditable || node.tagName === 'TEXTAREA') score += 10;

    // COMMENT: Ignore inline message edit fields — not the main footer composer on /app
    if (node.closest('.edit-mode, .query-content.edit-mode, .edit-container')) score -= 100;

    // COMMENT: Deprioritize nav/search fields that also match generic selectors
    if (node.closest('header, nav, [role="search"], [role="navigation"]')) score -= 80;

    return score;
  }

  /**
   * COMMENT: Pick the best visible input from a list of selector strings.
   * @param {string} selectorList
   * @returns {HTMLElement|null}
   */
  static _queryVisibleInput(selectorList, { deepGemini = false } = {}) {
    if (!selectorList) return null;
    const selectors = selectorList.split(',').map(s => s.trim()).filter(Boolean);
    let best = null;
    let bestScore = -1;

    for (const selector of selectors) {
      const nodes = deepGemini
        ? InputBoxHandler._collectGeminiCandidates(selector)
        : Array.from(document.querySelectorAll(selector));

      for (const node of nodes) {
        const score = InputBoxHandler._scoreInputCandidate(node);
        if (score > bestScore) {
          bestScore = score;
          best = node;
        }
      }
    }

    return best;
  }

  /**
   * COMMENT: Gemini /app uses custom elements that may hide the editor inside shadow DOM.
   * @returns {HTMLElement|null}
   */
  static _findGeminiInput() {
    if (!/gemini\.google\.com/i.test(window.location.hostname)) return null;

    const geminiSelectors = [
      'input-container rich-textarea [contenteditable]',
      'input-area-v2 rich-textarea [contenteditable]',
      'rich-textarea [contenteditable]',
      'input-area-v2 [contenteditable]',
      'div.ql-editor[contenteditable]',
      'div[contenteditable][role="textbox"]',
      '.input-area textarea',
      'textarea[placeholder*="Ask"]',
    ].join(', ');

    return InputBoxHandler._queryVisibleInput(geminiSelectors, { deepGemini: true });
  }

  /**
   * COMMENT: Generic fallback when configured selectors miss (e.g. after a site UI update).
   * @returns {HTMLElement|null}
   */
  static _findInputHeuristically() {
    const fallbackSelectors = [
      'rich-textarea [contenteditable]',
      'input-area-v2 [contenteditable]',
      'input-container [contenteditable]',
      '.text-input-field [contenteditable]',
      'div.ql-editor[contenteditable]',
      'div.ProseMirror[contenteditable]',
      '[contenteditable][role="textbox"]',
      'textarea',
      'input[type="text"]',
    ].join(', ');

    const deepGemini = /gemini\.google\.com/i.test(window.location.hostname);
    return InputBoxHandler._queryVisibleInput(fallbackSelectors, { deepGemini });
  }

  /**
   * COMMENT: Ensure Gemini expands and focuses the main composer before inserting text.
   * @param {HTMLElement} inputBox
   */
  static _prepareGeminiInput(inputBox) {
    if (!/gemini\.google\.com/i.test(window.location.hostname)) return;

    const container = inputBox.closest('input-container, input-area-v2, .input-area')
      || document.querySelector('input-container, input-area-v2');
    if (container instanceof HTMLElement) {
      container.click();
    }

    inputBox.focus();
  }

  /**
   * COMMENT: Shared execCommand insert path for rich-text editors (Lexical, Quill, ProseMirror).
   * @param {HTMLElement} inputBox
   * @param {string} content
   * @param {boolean} disableOverwrite
   */
  static _insertViaExecCommand(inputBox, content, disableOverwrite) {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(inputBox);
    if (disableOverwrite) {
      range.collapse(false);
    }
    selection.removeAllRanges();
    selection.addRange(range);

    if (!disableOverwrite) {
      document.execCommand('delete', false, null);
    }

    const textToInsert = content + '  ';
    // COMMENT: Multiline prompts need a paste-style event in Lexical editors (e.g. Perplexity).
    // COMMENT: insertText can flatten newlines into a single paragraph.
    const getPlainEditorText = () => inputBox.innerText || inputBox.textContent || '';
    const beforeInsertionText = getPlainEditorText();
    let inserted = false;

    if (content.includes('\n')) {
      try {
        const dataTransfer = new DataTransfer();
        dataTransfer.setData('text/plain', textToInsert);
        const pasteEvent = new ClipboardEvent('paste', {
          clipboardData: dataTransfer,
          bubbles: true,
          cancelable: true,
        });
        inputBox.dispatchEvent(pasteEvent);
        const afterPasteText = getPlainEditorText();
        inserted = afterPasteText.length > beforeInsertionText.length;
      } catch (_) {
        inserted = false;
      }
    }

    // COMMENT: Primary single-line path, and fallback when synthetic paste is ignored.
    if (!inserted) {
      try {
        inserted = document.execCommand('insertText', false, textToInsert);
      } catch (_) {
        // COMMENT: execCommand may be unavailable in some editor contexts
        inserted = false;
      }
    }

    if (!inserted) {
      inputBox.dispatchEvent(new InputEvent('beforeinput', {
        inputType: content.includes('\n') ? 'insertFromPaste' : 'insertText',
        data: textToInsert,
        bubbles: true,
        cancelable: true,
      }));
      inputBox.dispatchEvent(new Event('input', { bubbles: true }));
    }

    const endRange = document.createRange();
    endRange.selectNodeContents(inputBox);
    endRange.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(endRange);
    inputBox.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /**
   * COMMENT: Load pinned-input storage module from the extension bundle.
   * @returns {Promise<object>}
   */
  static async _pinnedStorage() {
    if (!InputBoxHandler._pinnedStorageModule) {
      InputBoxHandler._pinnedStorageModule = await import(chrome.runtime.getURL('storage/pinnedInputStorage.js'));
    }
    return InputBoxHandler._pinnedStorageModule;
  }

  /**
   * COMMENT: Build a stable selector for a pinned input element.
   * @param {HTMLElement} element
   * @returns {{ selector: string, label: string, deepShadow: boolean }}
   */
  static _buildPinDescriptor(element) {
    const label = (
      element.getAttribute('aria-label')
      || element.getAttribute('placeholder')
      || element.getAttribute('data-placeholder')
      || element.tagName.toLowerCase()
    ).trim();

    if (element.id) {
      const selector = `#${CSS.escape(element.id)}`;
      if (document.querySelectorAll(selector).length === 1) {
        return {
          selector,
          label,
          deepShadow: InputBoxHandler._elementNeedsDeepShadowQuery(element),
        };
      }
    }

    for (const attr of ['data-testid', 'data-id', 'name', 'aria-label']) {
      const value = element.getAttribute(attr);
      if (!value) continue;
      const tag = element.tagName.toLowerCase();
      const selector = `${tag}[${attr}="${CSS.escape(value)}"]`;
      if (document.querySelectorAll(selector).length === 1) {
        return {
          selector,
          label,
          deepShadow: InputBoxHandler._elementNeedsDeepShadowQuery(element),
        };
      }
    }

    return {
      selector: InputBoxHandler._buildCssPath(element),
      label,
      deepShadow: InputBoxHandler._elementNeedsDeepShadowQuery(element),
    };
  }

  /**
   * COMMENT: Build a short CSS path when no unique attribute selector exists.
   * @param {HTMLElement} element
   * @param {number} maxDepth
   * @returns {string}
   */
  static _buildCssPath(element, maxDepth = 6) {
    const parts = [];
    let node = element;

    while (node && node.nodeType === Node.ELEMENT_NODE && parts.length < maxDepth) {
      if (node.id) {
        parts.unshift(`#${CSS.escape(node.id)}`);
        break;
      }

      let part = node.tagName.toLowerCase();
      if (node.classList.length) {
        const className = [...node.classList].find((name) => !/^ng-|^mat-|^mdc-/.test(name)) || node.classList[0];
        if (className) part += `.${CSS.escape(className)}`;
      }

      const parent = node.parentElement;
      if (parent) {
        const siblings = [...parent.children].filter((child) => child.tagName === node.tagName);
        if (siblings.length > 1) {
          part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
        }
      }

      parts.unshift(part);
      node = node.parentElement;
    }

    return parts.join(' > ');
  }

  /**
   * COMMENT: Detect whether resolving this pin needs shadow-root traversal.
   * @param {HTMLElement} element
   * @returns {boolean}
   */
  static _elementNeedsDeepShadowQuery(element) {
    let node = element;
    while (node) {
      if (node instanceof ShadowRoot) return true;
      node = node.parentNode;
    }
    return Boolean(element.closest('rich-textarea, input-area-v2, input-container'));
  }

  /**
   * COMMENT: Query a selector across document and open/closed shadow roots.
   * @param {string} selector
   * @returns {HTMLElement|null}
   */
  static _queryDeepSelector(selector) {
    try {
      const direct = document.querySelector(selector);
      if (direct instanceof HTMLElement) return direct;
    } catch (_) {
      return null;
    }

    const roots = [document];
    for (const host of InputBoxHandler._getKnownShadowHosts()) {
      const shadow = InputBoxHandler._getShadowRoot(host);
      if (shadow) roots.push(shadow);
    }

    for (const root of roots) {
      try {
        const match = root.querySelector?.(selector);
        if (match instanceof HTMLElement) return match;
      } catch (_) {
        // Invalid selector for this root — keep searching
      }
    }

    return null;
  }

  /**
   * COMMENT: Resolve a stored pin descriptor back to a live input element.
   * @param {{ selector: string, deepShadow?: boolean }} pinned
   * @returns {HTMLElement|null}
   */
  static _resolvePinnedInput(pinned) {
    if (!pinned?.selector) return null;

    let candidate = null;
    if (pinned.deepShadow) {
      candidate = InputBoxHandler._queryDeepSelector(pinned.selector);
    } else {
      try {
        candidate = document.querySelector(pinned.selector);
      } catch (_) {
        candidate = null;
      }
    }

    if (!(candidate instanceof HTMLElement)) return null;
    if (!InputBoxHandler._isEditableInput(candidate)) return null;
    if (InputBoxHandler._scoreInputCandidate(candidate) < 0) return null;
    return candidate;
  }

  /**
   * COMMENT: Return the pinned input for the current page, if any.
   * @returns {Promise<HTMLElement|null>}
   */
  static async _getPinnedInputForCurrentSite() {
    try {
      const storage = await InputBoxHandler._pinnedStorage();
      const pinned = await storage.getPinnedForHostname(window.location.hostname);
      if (!pinned) return null;
      return InputBoxHandler._resolvePinnedInput(pinned);
    } catch (error) {
      console.error('Failed to resolve pinned input:', error);
      return null;
    }
  }

  /**
   * COMMENT: True when the element can receive prompt text.
   * @param {HTMLElement} element
   * @returns {boolean}
   */
  static _isEditableInput(element) {
    if (!(element instanceof HTMLElement)) return false;
    if (element.closest('#opm-root')) return false;

    if (element.isContentEditable) return true;
    if (element.tagName === 'TEXTAREA') return true;
    if (element.tagName === 'INPUT') {
      const type = (element.getAttribute('type') || 'text').toLowerCase();
      return ['text', 'search', 'email', 'url', 'tel', 'number', ''].includes(type);
    }
    return false;
  }

  /**
   * COMMENT: Walk up from a click target to the nearest editable field.
   * @param {EventTarget|null} target
   * @returns {HTMLElement|null}
   */
  static _findEditableFromTarget(target) {
    let node = target instanceof Element ? target : null;
    while (node) {
      if (InputBoxHandler._isEditableInput(node)) return node;
      if (node.id === 'opm-root') return null;
      node = node.parentElement;
    }
    return null;
  }

  /**
   * COMMENT: Small on-page confirmation after pinning or unpinning.
   * @param {string} message
   */
  static _showPinToast(message) {
    const existing = document.getElementById('opm-pin-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'opm-pin-toast';
    toast.textContent = message;
    toast.setAttribute('role', 'status');
    toast.style.cssText = [
      'position:fixed',
      'bottom:24px',
      'left:50%',
      'transform:translateX(-50%)',
      'z-index:2147483647',
      'background:#1f1f1f',
      'color:#fff',
      'padding:10px 14px',
      'border-radius:8px',
      'font:500 13px/1.4 system-ui,sans-serif',
      'box-shadow:0 8px 24px rgba(0,0,0,0.24)',
      'pointer-events:none',
    ].join(';');
    document.documentElement.appendChild(toast);
    window.setTimeout(() => toast.remove(), 2200);
  }

  /**
   * COMMENT: Enter click-to-pin mode with a mouse-following spotlight that snaps to inputs.
   * @returns {object}
   */
  static startPinPickerMode() {
    if (window.__OPM_PIN_PICKER_ACTIVE__) {
      return { ok: false, error: 'picker_already_active' };
    }

    window.__OPM_PIN_PICKER_ACTIVE__ = true;

    const EXAMPLE_PROMPT = 'Example Prompt';
    const INPUT_PAD = 6;
    const MOUSE_SPOT_SIZE = 56;
    let highlighted = null;
    let dismissed = false;
    let cleanedUp = false;
    let lastPointer = {
      x: Math.round(window.innerWidth / 2),
      y: Math.round(window.innerHeight / 2),
    };

    const root = document.createElement('div');
    root.id = 'opm-pin-picker-root';
    root.setAttribute('data-opm-ui', 'pin-picker');

    const spotlight = document.createElement('div');
    spotlight.className = 'opm-pin-picker-spotlight';

    const pill = document.createElement('div');
    pill.className = 'opm-pin-picker-pill';
    pill.setAttribute('role', 'status');

    const pillText = document.createElement('span');
    pillText.className = 'opm-pin-picker-pill-text';
    pillText.textContent = 'Choose an input field to load prompts into';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'opm-pin-picker-close';
    closeBtn.setAttribute('aria-label', 'Cancel input picker');
    closeBtn.innerHTML = '&times;';

    pill.appendChild(pillText);
    pill.appendChild(closeBtn);
    root.appendChild(spotlight);
    root.appendChild(pill);
    document.documentElement.appendChild(root);

    const styleId = 'opm-pin-picker-style';
    let style = document.getElementById(styleId);
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      document.head.appendChild(style);
    }
    style.textContent = `
      .opm-pin-picker-spotlight {
        position: fixed;
        top: 0;
        left: 0;
        z-index: 2147483646;
        border: 2px solid #3674B5;
        border-radius: 50%;
        box-shadow: 0 0 0 9999px rgba(15, 23, 42, 0.58);
        pointer-events: none;
        opacity: 1;
        will-change: transform, width, height;
        transition: opacity 280ms ease, box-shadow 280ms ease;
      }
      .opm-pin-picker-spotlight.is-on-input {
        border-radius: 12px;
        transition: opacity 280ms ease, box-shadow 280ms ease,
          transform 90ms ease, width 90ms ease, height 90ms ease;
      }
      .opm-pin-picker-pill {
        position: fixed;
        left: 50%;
        bottom: 24px;
        transform: translateX(-50%);
        z-index: 2147483647;
        display: inline-flex;
        align-items: center;
        gap: 10px;
        max-width: min(92vw, 520px);
        padding: 10px 10px 10px 16px;
        border-radius: 999px;
        background: #1f2937;
        color: #fff;
        font: 500 13px/1.4 system-ui, -apple-system, sans-serif;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
        pointer-events: auto;
        opacity: 1;
        transition: opacity 280ms ease, transform 280ms ease;
      }
      .opm-pin-picker-pill-text {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .opm-pin-picker-close {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border: none;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.12);
        color: #fff;
        font-size: 18px;
        line-height: 1;
        cursor: pointer;
        flex-shrink: 0;
      }
      .opm-pin-picker-close:hover {
        background: rgba(255, 255, 255, 0.2);
      }
      html.opm-pin-picker-active,
      html.opm-pin-picker-active * {
        cursor: crosshair !important;
      }
      html.opm-pin-picker-active .opm-pin-picker-pill,
      html.opm-pin-picker-active .opm-pin-picker-close {
        cursor: default !important;
      }
    `;

    document.documentElement.classList.add('opm-pin-picker-active');

    const setSpotlightRect = ({ top, left, width, height, round = false }) => {
      const sizeW = Math.max(width, 8);
      const sizeH = Math.max(height, 8);
      spotlight.style.width = `${sizeW}px`;
      spotlight.style.height = `${sizeH}px`;
      spotlight.style.transform = `translate3d(${left}px, ${top}px, 0)`;
      spotlight.classList.toggle('is-on-input', !round);
      spotlight.style.opacity = '1';
    };

    const setSpotlightAtPointer = (x, y) => {
      const half = MOUSE_SPOT_SIZE / 2;
      setSpotlightRect({
        top: y - half,
        left: x - half,
        width: MOUSE_SPOT_SIZE,
        height: MOUSE_SPOT_SIZE,
        round: true,
      });
    };

    const setSpotlightOnElement = (element) => {
      const rect = element.getBoundingClientRect();
      setSpotlightRect({
        top: rect.top - INPUT_PAD,
        left: rect.left - INPUT_PAD,
        width: rect.width + INPUT_PAD * 2,
        height: rect.height + INPUT_PAD * 2,
        round: false,
      });
    };

    const findEditableAtPoint = (x, y) => {
      const stack = document.elementsFromPoint(x, y);
      for (const node of stack) {
        if (!(node instanceof Element)) continue;
        if (node.closest('#opm-pin-picker-root')) continue;
        const editable = InputBoxHandler._findEditableFromTarget(node);
        if (editable) return editable;
      }
      return null;
    };

    const updateSpotlight = (x, y) => {
      lastPointer = { x, y };
      const editable = findEditableAtPoint(x, y);
      highlighted = editable;
      if (editable) {
        setSpotlightOnElement(editable);
        return;
      }
      setSpotlightAtPointer(x, y);
    };

    const removeListeners = () => {
      document.removeEventListener('pointermove', onPointerMove, true);
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('scroll', refreshSpotlightGeometry, true);
      window.removeEventListener('resize', refreshSpotlightGeometry, true);
      closeBtn.removeEventListener('click', onCloseClick);
    };

    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      dismissed = true;
      window.__OPM_PIN_PICKER_ACTIVE__ = false;
      delete window.__OPM_PIN_PICKER_DISMISS__;
      document.documentElement.classList.remove('opm-pin-picker-active');
      removeListeners();
      root.remove();
      style?.remove();
    };

    const dismissPicker = () => {
      if (dismissed) return;
      dismissed = true;
      spotlight.style.opacity = '0';
      spotlight.style.boxShadow = 'none';
      pill.style.opacity = '0';
      pill.style.transform = 'translateX(-50%) translateY(8px)';
      window.setTimeout(cleanup, 280);
    };

    // COMMENT: Allow KeyboardManager and the service worker to cancel an active picker session
    window.__OPM_PIN_PICKER_DISMISS__ = dismissPicker;

    const refreshSpotlightGeometry = () => {
      if (dismissed) return;
      updateSpotlight(lastPointer.x, lastPointer.y);
    };

    const onPointerMove = (event) => {
      if (dismissed) return;
      updateSpotlight(event.clientX, event.clientY);
    };

    const onClick = async (event) => {
      if (dismissed) return;
      if (pill.contains(event.target)) return;

      const editable = findEditableAtPoint(event.clientX, event.clientY);
      if (!editable) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      try {
        const storage = await InputBoxHandler._pinnedStorage();
        const descriptor = InputBoxHandler._buildPinDescriptor(editable);
        await storage.setPinnedForHostname(window.location.hostname, descriptor);
        InputBoxHandler._invalidateInputCache();
        InputBoxHandler._rememberInput(editable);

        try {
          await InputBoxHandler.insertPrompt(editable, EXAMPLE_PROMPT, null);
        } catch (insertError) {
          console.error('Failed to insert example prompt after pin:', insertError);
        }

        dismissPicker();
        return { ok: true, hostname: window.location.hostname, label: descriptor.label };
      } catch (error) {
        dismissPicker();
        InputBoxHandler._showPinToast('Could not pin this input');
        return { ok: false, error: error.message || 'pin_failed' };
      }
    };

    const onKeyDown = (event) => {
      if (dismissed) return;
      if (event.key !== 'Escape' && event.key !== 'Esc' && event.code !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      dismissPicker();
    };

    const onCloseClick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      dismissPicker();
    };

    document.addEventListener('pointermove', onPointerMove, true);
    document.addEventListener('click', onClick, true);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('scroll', refreshSpotlightGeometry, true);
    window.addEventListener('resize', refreshSpotlightGeometry, true);
    closeBtn.addEventListener('click', onCloseClick);

    updateSpotlight(lastPointer.x, lastPointer.y);

    return { ok: true, picking: true };
  }

  /**
   * COMMENT: Cancel an in-progress pin picker from outside the overlay (side panel / keyboard manager).
   * @returns {object}
   */
  static cancelPinPickerMode() {
    if (!window.__OPM_PIN_PICKER_ACTIVE__) {
      return { ok: false, error: 'not_active' };
    }
    if (typeof window.__OPM_PIN_PICKER_DISMISS__ === 'function') {
      window.__OPM_PIN_PICKER_DISMISS__();
      return { ok: true, cancelled: true };
    }
    return { ok: false, error: 'not_active' };
  }

  /**
   * COMMENT: Remove the pinned input mapping for the current hostname.
   * @returns {Promise<object>}
   */
  static async clearPinnedInput() {
    try {
      const storage = await InputBoxHandler._pinnedStorage();
      const removed = await storage.removePinnedForHostname(window.location.hostname);
      InputBoxHandler._invalidateInputCache();
      if (removed) {
        InputBoxHandler._showPinToast(`Custom website removed for ${window.location.hostname}`);
      }
      return { ok: true, removed, hostname: window.location.hostname };
    } catch (error) {
      return { ok: false, error: error.message || 'clear_failed' };
    }
  }

  /**
   * COMMENT: Expose pin state to the side panel for the active tab hostname.
   * @returns {Promise<object>}
   */
  static async getPinnedStatus() {
    try {
      const storage = await InputBoxHandler._pinnedStorage();
      const hostname = window.location.hostname;
      const pinned = await storage.getPinnedForHostname(hostname);
      return {
        ok: true,
        hostname,
        pinned: Boolean(pinned),
        label: pinned?.label || '',
      };
    } catch (error) {
      return { ok: false, error: error.message || 'status_failed' };
    }
  }

  /**
   * Detects and retrieves the input box from supported websites.
   * @returns {HTMLElement|null} The input box element or null if not found.
   */
  static async getInputBox() {
    const cachedInput = InputBoxHandler._getCachedInput();
    if (cachedInput) return cachedInput;

    // COMMENT: User-pinned inputs take priority over provider selectors and heuristics
    const pinnedInput = await InputBoxHandler._getPinnedInputForCurrentSite();
    if (pinnedInput) {
      InputBoxHandler._rememberInput(pinnedInput);
      return pinnedInput;
    }

    const providers = await InputBoxHandler._loadProviders();
    let matchedProvider = null;

    for (const provider of providers) {
      if (!provider.pattern) continue;
      const originPatterns = String(provider.pattern).split(',').map((item) => item.trim()).filter(Boolean);
      const matchesHost = originPatterns.some((originPattern) => {
        const regex = new RegExp(originPattern.replace(/\*/g, '.*'), 'i');
        return regex.test(window.location.href);
      });
      if (!matchesHost) continue;

      matchedProvider = provider;
      if (provider.element_selector) {
        const useDeepGemini = provider.name === 'Gemini';
        const inputBox = InputBoxHandler._queryVisibleInput(provider.element_selector, { deepGemini: useDeepGemini });
        if (inputBox) {
          InputBoxHandler._rememberInput(inputBox);
          return inputBox;
        }
      }
      break;
    }

    // COMMENT: If the site matched but selectors failed, try semantic/heuristic detection
    if (matchedProvider) {
      if (matchedProvider.name === 'Gemini') {
        const geminiMatch = InputBoxHandler._findGeminiInput();
        if (geminiMatch) {
          InputBoxHandler._rememberInput(geminiMatch);
          return geminiMatch;
        }
      }
      const heuristicMatch = InputBoxHandler._findInputHeuristically();
      if (heuristicMatch) {
        InputBoxHandler._rememberInput(heuristicMatch);
        return heuristicMatch;
      }
    }

    // COMMENT: On custom/permitted sites without a known provider entry, still try generic autodetect
    const genericMatch = InputBoxHandler._findInputHeuristically();
    if (genericMatch) {
      InputBoxHandler._rememberInput(genericMatch);
      return genericMatch;
    }

    InputBoxHandler._invalidateInputCache();
    console.error('Input box not found on this page.');
    return null;
  }

  /**
   * Waits for the input box to be available in the DOM.
   * @returns {Promise<HTMLElement>} Resolves with the input box element.
   */
  static waitForInputBox(maxWaitMs = 10000) {
    return new Promise((resolve, reject) => {
      let elapsed = 0;
      let delay = 200;
      let pollTimer = null;
      let settled = false;

      const cleanup = () => {
        if (pollTimer) clearTimeout(pollTimer);
        if (InputBoxHandler._waitObserver) {
          InputBoxHandler._waitObserver.disconnect();
          InputBoxHandler._waitObserver = null;
        }
        if (InputBoxHandler._waitObserverTimer) {
          clearTimeout(InputBoxHandler._waitObserverTimer);
          InputBoxHandler._waitObserverTimer = null;
        }
      };

      const finish = (inputBox) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(inputBox);
      };

      const fail = () => {
        if (settled) return;
        settled = true;
        cleanup();
        reject('Input box not found after 10 seconds.');
      };

      const attempt = async () => {
        const inputBox = await InputBoxHandler.getInputBox();
        if (inputBox) {
          finish(inputBox);
          return;
        }

        elapsed += delay;
        if (elapsed >= maxWaitMs) {
          fail();
          return;
        }

        delay = Math.min(Math.round(delay * 1.5), 1500);
        pollTimer = window.setTimeout(attempt, delay);
      };

      const scheduleObserverCheck = () => {
        if (InputBoxHandler._waitObserverTimer) return;
        InputBoxHandler._waitObserverTimer = window.setTimeout(async () => {
          InputBoxHandler._waitObserverTimer = null;
          const inputBox = await InputBoxHandler.getInputBox();
          if (inputBox) finish(inputBox);
        }, 150);
      };

      const observeTarget = document.body || document.documentElement;
      if (observeTarget) {
        InputBoxHandler._waitObserver = new MutationObserver(scheduleObserverCheck);
        InputBoxHandler._waitObserver.observe(observeTarget, { childList: true, subtree: true });
      }

      attempt();
    });
  }

  /**
   * Inserts a prompt into the detected input box.
   * @param {HTMLElement} inputBox - The input box element.
   * @param {string} content - The prompt content to insert.
   * @param {HTMLElement} promptList - The prompt list element to hide after insertion.
   */
  static async insertPrompt(inputBox, content, promptList) {
    if (!inputBox || !content) {
      console.error('Missing required parameters for insertPrompt', { inputBox, content });
      return;
    }
    InputBoxHandler._prepareGeminiInput(inputBox);
    inputBox.focus();
    try {
      // COMMENT: Read setting that controls append vs overwrite behavior
      const disableOverwrite = await new Promise(resolve => {
        try {
          chrome.storage.local.get('disableOverwrite', data => {
            if (chrome.runtime?.lastError) { resolve(false); return; }
            resolve(Boolean(data?.disableOverwrite));
          });
        } catch (_) { resolve(false); }
      });

      if (inputBox.isContentEditable) {
        const isLexicalEditor = inputBox.getAttribute('data-lexical-editor') === 'true'
          || !!inputBox.closest('[data-lexical-editor="true"]')
          || inputBox.id === 'ask-input';

        const isQuillEditor = inputBox.classList.contains('ql-editor')
          || !!inputBox.closest('.ql-container')
          || !!inputBox.closest('rich-textarea');

        const isProseMirrorEditor =
          (inputBox.classList && inputBox.classList.contains('ProseMirror')) ||
          (typeof inputBox.closest === 'function' && !!inputBox.closest('.ProseMirror'));

        // COMMENT: Quill (Gemini), Lexical, and ProseMirror respond reliably to execCommand insertText
        if (isLexicalEditor || isQuillEditor || isProseMirrorEditor) {
          InputBoxHandler._insertViaExecCommand(inputBox, content, disableOverwrite);
          PromptUIManager.hidePromptList(promptList);
          return;
        }

        if (disableOverwrite) {
          const endRange = document.createRange();
          endRange.selectNodeContents(inputBox);
          endRange.collapse(false);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(endRange);

          if (content.includes('\n')) {
            const lines = content.split('\n');
            lines.forEach((line) => {
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
          inputBox.innerHTML = '';

          const dataTransfer = new DataTransfer();
          dataTransfer.setData('text/plain', content);
          const pasteEvent = new ClipboardEvent('paste', {
            clipboardData: dataTransfer,
            bubbles: true,
            cancelable: true,
          });
          inputBox.dispatchEvent(pasteEvent);

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
            inputBox.textContent = content;
          }
        }

        inputBox.appendChild(document.createTextNode('  '));

        const range = document.createRange();
        range.selectNodeContents(inputBox);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);

        inputBox.dispatchEvent(new Event('input', { bubbles: true }));

        if (!inputBox.textContent || inputBox.textContent.trim() === '') {
          inputBox.innerText = content + '  ';
          inputBox.dispatchEvent(new Event('input', { bubbles: true }));
        }
      } else if (inputBox.tagName.toLowerCase() === 'textarea' || inputBox.tagName.toLowerCase() === 'input') {
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
        if (inputBox.tagName.toLowerCase() === 'textarea') {
          inputBox.style.height = 'auto';
          inputBox.style.height = `${inputBox.scrollHeight}px`;
        }
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
    if (inputBox.isContentEditable) {
      return inputBox.innerText;
    } else if (inputBox.tagName.toLowerCase() === 'textarea' || inputBox.tagName.toLowerCase() === 'input') {
      return inputBox.value;
    }
    return '';
  }
}

// COMMENT: Expose globally so dynamically injected script files share the same handler
window.InputBoxHandler = InputBoxHandler;

// COMMENT: Route pin-picker actions from the service worker through the content-script world
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'OPM_PIN_INPUT_CONTENT') return undefined;

    (async () => {
      try {
        if (message.action === 'start') {
          sendResponse(InputBoxHandler.startPinPickerMode());
        } else if (message.action === 'cancel') {
          sendResponse(InputBoxHandler.cancelPinPickerMode());
        } else if (message.action === 'clear') {
          sendResponse(await InputBoxHandler.clearPinnedInput());
        } else if (message.action === 'status') {
          sendResponse(await InputBoxHandler.getPinnedStatus());
        } else {
          sendResponse({ ok: false, error: 'unknown_action' });
        }
      } catch (error) {
        sendResponse({ ok: false, error: error?.message || 'pin_action_failed' });
      }
    })();

    return true;
  });
}

