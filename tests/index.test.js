const puppeteer = require('puppeteer');
const path = require('path');
const { getExtensionId } = require('./utils.test.js');

const EXTENSION_PATH = path.join(__dirname, '../src/');

let browser;
let extensionId;

// --- Before Each Test ---
beforeEach(async () => {
    browser = await puppeteer.launch({
        headless: false,
        args: [
            `--disable-extensions-except=${EXTENSION_PATH}`,
            `--load-extension=${EXTENSION_PATH}`
        ]
    });

    extensionId = await getExtensionId(browser);

    console.log(`Dynamically loaded extension ID: ${extensionId}`);
}, 30000);

afterEach(async () => {
    if (browser) {
        await browser.close();
    }
    browser = undefined;
});

// --- The Test Case ---
test('popup renders correctly', async () => {
    const page = await browser.newPage();
    await page.goto(`chrome-extension://${extensionId}/sidepanel/index.html`, { waitUntil: 'domcontentloaded' });

    const linkContainer = await page.$('div.title');
    expect(linkContainer).not.toBeNull();
}, 30000);