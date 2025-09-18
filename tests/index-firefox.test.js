const puppeteer = require('puppeteer');
const path = require('path');


const EXTENSION_PATH = path.join(__dirname, '../src/');
const EXTENSION_ID = 'open-prompt-manager@example.com';

let browser;

beforeEach(async () => {
    browser = await puppeteer.connect({
        browserURL: 'http://localhost:9222',
        product: 'firefox'
    });
});

afterEach(async () => {
    if (browser) {
        await browser.disconnect();
    }
    browser = undefined;
});


test('sidepanel renders correctly', async () => {
    const page = await browser.newPage();
    await page.goto(`moz-extension://${EXTENSION_ID}/sidepanel/index.html`);

    // Locate the element with tag <div> and class "prompt-list"
    const promptList = await page.$('div#prompt-list');
    expect(promptList).not.toBeNull();
});
