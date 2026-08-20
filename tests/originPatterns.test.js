const { llm_providers } = require('../src/llm_providers.json');

function expandOriginPatterns(pattern) {
  return String(pattern || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

describe('provider origin patterns', () => {
  test('Perplexity lists both www and apex hosts', () => {
    const provider = llm_providers.find((item) => item.name === 'Perplexity AI');
    expect(provider).toBeTruthy();
    const origins = expandOriginPatterns(provider.pattern);
    expect(origins).toEqual(['*://www.perplexity.ai/*', '*://perplexity.ai/*']);
  });

  test('expandOriginPatterns ignores blanks', () => {
    expect(expandOriginPatterns(' *://a.com/*, ,*://b.com/* ')).toEqual([
      '*://a.com/*',
      '*://b.com/*',
    ]);
  });
});
