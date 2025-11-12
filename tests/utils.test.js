// utils.test.js

/**
 * Finds the dynamic extension ID for a single loaded extension 
 * by checking the targets available in the browser.
 * @param {puppeteer.Browser} browser - The Puppeteer Browser instance.
 * @returns {Promise<string>} The dynamically assigned extension ID.
 */
async function getExtensionId(browser) {
    // Wait for a moment to ensure all background processes have started
    await new Promise(resolve => setTimeout(resolve, 1000));

    const allTargets = await browser.targets();

    // Filter to find the background context (Service Worker or Background Page)
    const extensionTarget = allTargets.find(target => {
        const type = target.type();
        const url = target.url();
        // Check for the extension's background context type and its unique URL prefix
        return (type === 'service_worker' || type === 'background_page') &&
               url.startsWith('chrome-extension://');
    });

    if (!extensionTarget) {
        // If no target is found, throw an error or return null/undefined
        throw new Error('No extension target found in the browser.');
    }
    
    // Extract the ID from the target's URL
    const url = extensionTarget.url();
    // The extension ID is the second part after splitting by '/'
    const extensionId = url.split('/')[2]; 

    // Return only the ID string
    return extensionId;
}


// ⭐️ Export the function so it can be imported elsewhere
module.exports = {
    getExtensionId,
};