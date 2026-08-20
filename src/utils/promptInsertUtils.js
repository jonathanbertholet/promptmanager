// promptInsertUtils.js
// COMMENT: Pure helpers for prompt insertion. Shared by the content-script handler and unit tests.

(function attachPromptInsertUtils(root) {
  /**
   * COMMENT: Escape a string for safe use in a RegExp.
   * @param {string} value
   * @returns {string}
   */
  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * COMMENT: Normalize editor whitespace so quote/attachment duplicates compare reliably.
   * @param {string} value
   * @returns {string}
   */
  function normalizeEditorText(value) {
    return String(value || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .trim();
  }

  /**
   * COMMENT: Hosts that turn synthetic paste into a quote card or paste.txt attachment.
   * @param {string} hostname
   * @returns {boolean}
   */
  function siteConvertsPasteToAttachment(hostname) {
    const host = String(hostname || '').toLowerCase();
    return /(?:^|\.)chatgpt\.com$|(?:^|\.)chat\.openai\.com$|(?:^|\.)perplexity\.ai$/.test(host);
  }

  /**
   * COMMENT: True when editor text is the prompt plus a second quoted/attached copy.
   * Matches the ChatGPT/Perplexity report:
   *   prompt
   *   ---
   *   >prompt--->
   * @param {string} editorText
   * @param {string} prompt
   * @returns {boolean}
   */
  function isQuotedDuplicatePrompt(editorText, prompt) {
    const needle = normalizeEditorText(prompt);
    const text = normalizeEditorText(editorText);
    if (!needle || !text) return false;
    if (text === needle) return false;

    const escaped = escapeRegExp(needle);
    const quotedDuplicate = new RegExp(
      `^${escaped}\\s*(?:\\n+---+\\s*)?\\n+>${escaped}(?:--->)?\\s*$`
    );
    if (quotedDuplicate.test(text)) return true;

    const occurrences = text.match(new RegExp(escaped, 'g'));
    if (!occurrences || occurrences.length < 2) return false;

    let remainder = text;
    remainder = remainder.replace(needle, '');
    remainder = remainder.replace(needle, '');
    // COMMENT: Leftover quote markers, hr separators, and caret-like arrows from paste cards
    const junk = remainder.replace(/[\s>`\-–—:~*]+/g, '');
    return junk.length === 0;
  }

  /**
   * COMMENT: Collapse a duplicated insert down to a single copy of the prompt.
   * Returns the original string when the editor does not look like a duplicate.
   * @param {string} editorText
   * @param {string} prompt
   * @param {{ beforeText?: string, append?: boolean }} [options]
   * @returns {string}
   */
  function collapseDuplicatedPromptText(editorText, prompt, options) {
    const original = editorText == null ? '' : String(editorText);
    const needle = normalizeEditorText(prompt);
    if (!needle) return original;

    const append = Boolean(options?.append);
    const beforeText = normalizeEditorText(options?.beforeText || '');
    const text = normalizeEditorText(original);
    const expected = append
      ? normalizeEditorText(`${beforeText}${beforeText && !/\s$/.test(beforeText) ? ' ' : ''}${needle}`)
      : needle;

    if (text === expected) return original;

    const suffix = append && beforeText && text.startsWith(beforeText)
      ? text.slice(beforeText.length).trim()
      : text;

    if (isQuotedDuplicatePrompt(suffix, needle) || isQuotedDuplicatePrompt(text, needle)) {
      return expected;
    }

    // COMMENT: Plain concatenation of the same prompt twice (Lexical execCommand double-insert)
    if (!append && (text === `${needle}${needle}` || text === `${needle}  ${needle}` || text === `${needle}\n${needle}`)) {
      return needle;
    }
    if (!append && text.startsWith(needle) && text.endsWith(needle) && text.length > needle.length) {
      const middle = text.slice(needle.length, text.length - needle.length);
      if (/^[\s>`\-–—:~*]*$/.test(middle)) return needle;
    }

    return original;
  }

  const PromptInsertUtils = {
    escapeRegExp,
    normalizeEditorText,
    siteConvertsPasteToAttachment,
    isQuotedDuplicatePrompt,
    collapseDuplicatedPromptText,
  };

  root.PromptInsertUtils = PromptInsertUtils;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PromptInsertUtils;
  }
})(typeof window !== 'undefined' ? window : globalThis);
