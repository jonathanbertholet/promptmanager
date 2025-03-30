const puppeteer = require('puppeteer');
const path = require('path');


const EXTENSION_PATH = path.join(__dirname, '../src/');
const EXTENSION_ID = 'jkomgjfbbjocikdmilgaehbfpllalmia';

let browser;

beforeEach(async () => {
    browser = await puppeteer.launch({
        headless: false,
        args: [
            `--disable-extensions-except=${EXTENSION_PATH}`,
            `--load-extension=${EXTENSION_PATH}`
        ]
    });
});

afterEach(async () => {
    await browser.close();
    browser = undefined;
});


test('popup renders correctly', async () => {
    const page = await browser.newPage();
    await page.goto(`chrome-extension://${EXTENSION_ID}/popup.html`);

    // Locate the element with tag <div> and class "link-container"
    const linkContainer = await page.$('div.link-container');
    expect(linkContainer).not.toBeNull();

    // Get all child <a> elements of that div
    const childrenA = await linkContainer.$$('a');
    expect(childrenA.length).toBe(5);
});