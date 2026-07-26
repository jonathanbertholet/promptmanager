// utils.test.js

/**
 * Finds the dynamic extension ID for a single loaded extension
 * by checking the targets available in the browser.
 * @param {import('puppeteer').Browser} browser
 * @returns {Promise<string>}
 */
async function getExtensionId(browser) {
  const deadline = Date.now() + 15000;

  while (Date.now() < deadline) {
    const allTargets = await browser.targets();
    const extensionTarget = allTargets.find(target => {
      const url = target.url();
      return url.startsWith('chrome-extension://') || url.startsWith('moz-extension://');
    });

    if (extensionTarget) {
      const url = extensionTarget.url();
      return url.split('/')[2];
    }

    await new Promise(resolve => setTimeout(resolve, 250));
  }

  throw new Error('No extension target found in the browser.');
}

describe('getExtensionId helper', () => {
  test('exports getExtensionId function', () => {
    expect(typeof getExtensionId).toBe('function');
  });
});

module.exports = {
  getExtensionId,
};
