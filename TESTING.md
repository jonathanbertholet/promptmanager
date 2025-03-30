## Testing

### Automated Testing with Puppeteer

This project includes automated tests using **Puppeteer** and **Jest** to ensure the extension works as expected.

#### How to Find the Tests

- All test files are located in the `tests` directory or follow the naming convention `*.test.js`.
- The main test file for the extension is `index.test.js`.

#### Running the Tests

1. **Install Dependencies**  
   Ensure all required dependencies are installed by running:

   ```bash
   npm install
   ```

2. **Run the Tests**
   Use the following command to execute all tests:

   ```bash
   npm test
   ```

3. **View Test Results**
   After running the tests, you will see the results in the terminal. Each test will display whether it passed or failed, along with any error messages.

#### Example Test

Here’s an example of what a test looks like in index.test.js:

```javascript
test("popup renders correctly", async () => {
  const page = await browser.newPage();
  await page.goto(`chrome-extension://${EXTENSION_ID}/popup.html`);

  // Locate the element with tag <div> and class "link-container"
  const linkContainer = await page.$("div.link-container");
  expect(linkContainer).not.toBeNull();

  // Get all child <a> elements of that div
  const childrenA = await linkContainer.$$("a");
  expect(childrenA.length).toBe(5);
});
```

### Additional Notes

Tests are configured to run using Jest, so any file ending with .test.js will automatically be included.
For more advanced testing, refer to the Puppeteer API documentation.

### Flat `tests/` Folder Structure

```
tests/
├── api.test.js               # Tests for API calls
├── background.test.js        # Tests for background scripts
├── browser-actions.test.js   # Tests for browser actions (e.g., badge, popup)
├── content-script.test.js    # Tests for content scripts
├── dom-manipulation.test.js  # Tests for DOM manipulation by content scripts
├── popup.test.js             # Tests for the popup UI
├── storage.test.js           # Tests for Chrome storage APIs
├── performance.test.js       # Performance and load tests
├── helpers.js                # Utility functions and reusable helpers
├── chrome.mock.js            # Mock for Chrome APIs
├── jest.setup.js             # Jest global setup
├── puppeteer.config.js       # Puppeteer configuration
└── README.md                 # Documentation for the test suite
```

### Explanation of the Files

1. **`api.test.js`**: Contains tests for API calls made by the extension, including mocking API responses and testing error handling.
2. **`background.test.js`**: Contains tests for background scripts, such as message handling, event listeners, and background logic.
3. **`browser-actions.test.js`**: Contains tests for browser actions like setting the badge text, opening the popup, or interacting with the extension icon.
4. **`content-script.test.js`**: Contains tests for content scripts, such as DOM manipulation, injected scripts, and interactions with web pages.
5. **`dom-manipulation.test.js`**: Focuses specifically on testing DOM manipulation by content scripts.
6. **`popup.test.js`**: Contains tests for the popup UI of the Chrome extension, including rendering and user interactions.
7. **`storage.test.js`**: Contains tests for Chrome storage APIs (`chrome.storage.local`, `chrome.storage.sync`).
8. **`performance.test.js`**: Contains performance and load tests to ensure the extension meets performance benchmarks.
9. **`helpers.js`**: Contains reusable utility functions, such as Puppeteer helpers for common actions (e.g., waiting for elements, injecting scripts).
10. **`chrome.mock.js`**: Contains mock implementations for Chrome APIs, such as `chrome.runtime` and `chrome.storage`.
11. **`jest.setup.js`**: Contains global setup and teardown logic for Jest, such as extending matchers or configuring timeouts.
12. **`puppeteer.config.js`**: Contains Puppeteer-specific configuration, such as browser launch options.
13. **`README.md`**: Documents the test suite, explaining the purpose of each file, how to run tests, and any prerequisites.
