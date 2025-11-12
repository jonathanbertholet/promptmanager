// List of excluded providers by name for testing as they require further steps
const EXCLUDED_PROVIDERS = [
    // Example: 'ChatGPT', 'Claude', 'Gemini'
    "NotebookLM",
    "Claude",
    "Poe",
    "DeepSeek",
    "Grok @ x.com",
    "OpenAI Playground",
    "ChatLLM",
    "Google AI Studio"
];

const puppeteer = require('puppeteer');
const path = require('path');

const EXTENSION_PATH = path.join(__dirname, '../src/');

let browser;

beforeEach(async () => {
    browser = await puppeteer.launch({
        headless: false,
        args: [
            `--disable-extensions-except=${EXTENSION_PATH}`,
            `--load-extension=${EXTENSION_PATH}`
        ]
    });

    // Close the extension permissions page that opens on startup (if any).
    // Some extensions open a dedicated page (e.g. permissions/permissions.html) which
    // can steal focus and result in frames being detached or about:blank frames.
    try {
        const pages = await browser.pages();
        for (const p of pages) {
            const url = p.url();
            if (url && url.includes('permissions/permissions.html')) {
                await p.close();
            }
        }
    } catch (err) {
        // Log and continue; failure to close the page shouldn't block tests.
        console.log('⚠️ Warning while closing permissions page:', err.message);
    }

    // Small delay to allow browser to settle after closing pages
    await new Promise(resolve => setTimeout(resolve, 5000));
}, 50000);

afterEach(async () => {
    if (browser) {
        await browser.close();
    }
    browser = undefined;
});

test('Test element selectors for all LLM providers', async () => {
    // Load the providers from the JSON file
    const providers = require('../src/llm_providers.json').llm_providers;

    console.log(`Testing ${providers.length} providers...`);

    for (const provider of providers) {
        console.log(`\nTesting provider: ${provider.name}`);

        // Skip providers that are in the excluded list
        if (EXCLUDED_PROVIDERS.includes(provider.name)) {
            continue;
        }

        let page;
        try {
            page = await browser.newPage();

            // Set up error handling for page navigation
            page.on('error', (err) => {
                // console.log(`❌ ${provider.name}: Page error - ${err.message}`);
                return;
            });
            
            page.on('pageerror', (err) => {
                // console.log(`❌ ${provider.name}: Page error - ${err.message}`);
                return;
            });
            
            // Add frame detached error handling
            page.on('framedetached', (frame) => {
                // console.log(`⚠️ ${provider.name}: Frame detached - frame.url: ${frame.url()} - provider.url: ${provider.url}`);
                return;
            });

            // Navigate to the provider's URL with better error handling and timeout
            await page.goto(provider.url);
            console.log(`Navigated to ${provider.url}`);

            // Wait for the page to load
            await new Promise(resolve => setTimeout(resolve, 2000));
            console.log("Wait for the page to load");

            // Check if page is still attached before proceeding
            if (page.isClosed()) {
                console.log(`❌ ${provider.name}: Page was closed during navigation`);
                continue;
            }

            // Test the element selector with better error handling
            const element = await page.$(provider.element_selector);
            console.log("Test the element selector with better error handling");

            if (element) {
                console.log(`✅ ${provider.name}: Element found with selector "${provider.element_selector}"`);

                // Enter text for test prompt with better error handling
                try {
                    await element.type('Test prompt for automation', { delay: 100 });
                } catch (typeError) {
                    console.log(`⚠️ ${provider.name}: Failed to type text - ${typeError.message}`);
                    // Try alternative method if type fails
                    await page.evaluate((selector) => {
                        const el = document.querySelector(selector);
                        if (el) {
                            if (el.tagName === 'TEXTAREA') {
                                el.value = 'Test prompt for automation';
                            } else if (el.contentEditable === 'true') {
                                el.innerText = 'Test prompt for automation';
                            } else {
                                el.value = 'Test prompt for automation';
                            }
                        }
                    }, provider.element_selector);
                }

                // Validate that the value of the input box changed
                const value = await page.evaluate((el) => {
                    if (el.tagName === 'TEXTAREA') {
                        return el.value;
                    } else if (el.contentEditable === 'true') {
                        return el.innerText;
                    } else {
                        return el.value;
                    }
                }, element);

                if (value && value.includes('Test prompt for automation')) {
                    console.log(`✅ ${provider.name}: Value changed successfully`);
                } else {
                    console.log(`❌ ${provider.name}: Value did not change as expected`);
                }
            } else {
                console.log(`❌ ${provider.name}: Element not found with selector "${provider.element_selector}"`);
            }

            // Close page properly
            if (page && !page.isClosed()) {
                await page.close();
            }

        } catch (error) {
            console.log(`❌ ${provider.name}: ERROR - ${error.message}`);
            // Close page if it exists to prevent hanging
            if (page && !page.isClosed()) {
                try {
                    await page.close();
                } catch (closeError) {
                    console.log(`⚠️ ${provider.name}: Failed to close page - ${closeError.message}`);
                }
            }
        }
    }

    // Log summary
    console.log('\n=== TEST SUMMARY ===');
    console.log('Element selector tests completed for all providers.');
}, 1500000);
