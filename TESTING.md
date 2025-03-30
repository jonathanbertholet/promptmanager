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
