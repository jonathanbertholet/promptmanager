import { getProviders } from './llm_providers.js'; // Import the correct function

chrome.runtime.onInstalled.addListener(function (details) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  console.log('onInstalled', details);
  // only verify permissions on install and update
  if (!['install','update'].includes(details.reason)) {
    return;
  }
  chrome.tabs.create({ url: 'permissions/permissions.html' });
  (async () => {
    try {
      const providersMap = await checkProviderPermissions();
      console.log('Providers Map:', providersMap);
      // Store the provider map in local storage
      await chrome.storage.local.set({ 'aiProvidersMap': providersMap });
    } catch (error) {
      console.error('Error:', error);
    }
  })();
});


chrome.permissions.onAdded.addListener(async (permissions) => {
  console.log('Permissions added:', permissions.origins);
  if (permissions.origins && permissions.origins.length > 0) {
    // Iterate through the newly granted origins
    for (const origin of permissions.origins) {
      try {
        // Find tabs that match the newly granted origin
        const tabs = await chrome.tabs.query({ url: origin });
        console.log(`Found ${tabs.length} tabs matching ${origin}`);

        for (const tab of tabs) {
          // Inject the scripts into each matching tab
          console.log(`Injecting scripts into tab ${tab.id} (${tab.url})`);
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["inputBoxHandler.js", "content.js"]
          });
          console.log(`Successfully injected scripts into tab ${tab.id}`);
        }
      } catch (err) {
        console.error(`Failed to query tabs or inject script for origin ${origin}:`, err);
      }
    }
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Inject scripts when a tab finishes loading and has a URL
  if (changeInfo.status === 'complete' && tab.url) {
    try {
      // Get the providers object and extract the patterns array
      const { patternsArray } = await getProviders(); // Call getProviders and destructure

      // Check if the tab's URL matches any of the provider patterns
      for (const originPattern of patternsArray) { // Use patternsArray
        // Check if the extension has been granted permission for this origin
        const hasPermission = await chrome.permissions.contains({
          origins: [originPattern]
        });

        // Simple matching (more robust matching might be needed depending on patterns)
        // Convert wildcard pattern to a basic regex check
        const regexPattern = originPattern
          .replace(/\\/g, '\\\\') // Escape backslashes first
          .replace(/[.]/g, '\\.') // Escape dots
          .replace(/[*]/g, '.*'); // Replace wildcard with .*
        const urlRegex = new RegExp(`^${regexPattern}`);

        if (hasPermission && urlRegex.test(tab.url)) {
          console.log(`Injecting scripts into updated tab ${tabId} (${tab.url}) matching ${originPattern}`);
          // Check if scripts are already injected (optional but good practice)
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tabId },
              func: () => { /* A simple function to check injection */ window.myExtensionInjected = true; }
            });
            // If the above doesn't throw, it means scripts might already be there or injection is possible.
            // Proceed with actual injection.
            await chrome.scripting.executeScript({
              target: { tabId: tabId },
              files: ["inputBoxHandler.js", "content.js"]
            });
            console.log(`Successfully injected scripts into tab ${tabId}`);
          } catch (injectionError) {
             // Check if the error indicates scripts are already injected
             if (injectionError.message.includes('Cannot access a chrome:// URL') || injectionError.message.includes('No matching window')) {
               // Ignore errors for restricted pages or closed tabs
             } else if (!injectionError.message.includes('already injected')) {
                // Log other injection errors
                console.error(`Failed to inject script into tab ${tabId} (${tab.url}):`, injectionError);
             } else {
               // console.log(`Scripts already injected in tab ${tabId}`); // Optional: Log if already injected
             }
          }
          // Important: break after attempting injection for the first matching pattern
          break;
        }
      }
    } catch (err) {
      // Avoid logging errors for URLs like 'chrome://extensions/'
      if (tab.url && !tab.url.startsWith('chrome://')) {
         // Log errors from getProviders or permission checks
        console.error(`Error during tab update processing for ${tab.url}:`, err);
      }
    }
  }
});

async function checkProviderPermissions() {
  try {
    // Fetch the providers map
    const response = await fetch('llm_providers.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const providersData = await response.json();

    // Object to store provider permission status and URL
    const providersMap = {};

    // Loop through each provider object in the patterns array
    for (const providerInfo of providersData.llm_providers) {
      // Get provider name, URL pattern, and provider URL
      const providerName = providerInfo.name;
      const urlPattern = providerInfo.pattern;
      const providerUrl = providerInfo.url;

      // Check if permission exists for this provider's URL pattern
      const hasPermission = await chrome.permissions.contains({
        origins: [urlPattern]
      });

      // Store the result (permission status and URL) in providersMap
      providersMap[providerName] = {
        hasPermission: hasPermission ? 'Yes' : 'No',
        urlPattern: urlPattern,
        url: providerUrl,
        iconUrl: providerInfo.icon_url
      };
    }

    return providersMap;
  } catch (error) {
    console.error('Error checking permissions:', error);
    return null; // Return null or an empty object {} to indicate failure
  }
}
