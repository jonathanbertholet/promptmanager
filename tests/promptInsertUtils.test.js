const {
  collapseDuplicatedPromptText,
  isQuotedDuplicatePrompt,
  siteConvertsPasteToAttachment,
  normalizeEditorText,
} = require('../src/utils/promptInsertUtils.js');

describe('prompt insert duplicate collapse', () => {
  const prompt = 'write an evocative spiritual prose poem based on this PASSAGE:';

  test('leaves a single copy unchanged', () => {
    expect(collapseDuplicatedPromptText(`${prompt}  `, prompt)).toBe(`${prompt}  `);
    expect(isQuotedDuplicatePrompt(prompt, prompt)).toBe(false);
  });

  test('collapses the ChatGPT/Perplexity quoted paste-card duplicate', () => {
    const duplicated = `${prompt}\n---\n>${prompt}--->`;
    expect(isQuotedDuplicatePrompt(duplicated, prompt)).toBe(true);
    expect(collapseDuplicatedPromptText(duplicated, prompt)).toBe(prompt);
  });

  test('collapses a markdown blockquote duplicate without the trailing arrow', () => {
    const duplicated = `${prompt}\n---\n>${prompt}`;
    expect(collapseDuplicatedPromptText(duplicated, prompt)).toBe(prompt);
  });

  test('collapses a plain concatenated double insert', () => {
    expect(collapseDuplicatedPromptText(`${prompt}${prompt}`, prompt)).toBe(prompt);
    expect(collapseDuplicatedPromptText(`${prompt}\n${prompt}`, prompt)).toBe(prompt);
  });

  test('does not collapse unrelated text that merely contains the prompt once', () => {
    const other = `${prompt}\n\nPlease keep the original line breaks.`;
    expect(collapseDuplicatedPromptText(other, prompt)).toBe(other);
  });

  test('in append mode only inspects the newly inserted suffix', () => {
    const before = 'already in the box';
    const duplicated = `${before} ${prompt}\n---\n>${prompt}`;
    expect(collapseDuplicatedPromptText(duplicated, prompt, { beforeText: before, append: true }))
      .toBe(`${before} ${prompt}`);
  });

  test('identifies ChatGPT and Perplexity as paste-to-attachment hosts', () => {
    expect(siteConvertsPasteToAttachment('chatgpt.com')).toBe(true);
    expect(siteConvertsPasteToAttachment('www.perplexity.ai')).toBe(true);
    expect(siteConvertsPasteToAttachment('chat.openai.com')).toBe(true);
    expect(siteConvertsPasteToAttachment('gemini.google.com')).toBe(false);
    expect(normalizeEditorText('  a\u00a0b  ')).toBe('a b');
  });
});
