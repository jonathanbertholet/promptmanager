import { getProviders } from './llm_providers.js'; // Import the correct function
import { getPrompts, onPromptsChanged } from './promptStorage.js'; // COMMENT: Unified prompt storage API

chrome.runtime.onInstalled.addListener(function (details) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  console.log('onInstalled', details);
  // note to self : for updates, add 'update' in array
  if (!['install'].includes(details.reason)) {
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

// --- CONTEXT MENU FOR PROMPT MANAGER ---

// Helper: Get all prompts via the unified manager (single source of truth)
async function getAllPrompts() {
  return await getPrompts();
}

// Create the context menu
async function createPromptContextMenu() {
  // Remove any existing menu to avoid duplicates
  chrome.contextMenus.removeAll(() => {
    // Create the parent menu
    chrome.contextMenus.create({
      id: 'open-prompt-manager',
      title: 'Open Prompt Manager',
      contexts: ['all']
    });
    // Add a menu item for each prompt
    getAllPrompts().then(prompts => {
      prompts.forEach((prompt, idx) => {
        chrome.contextMenus.create({
          id: 'prompt-' + idx,
          parentId: 'open-prompt-manager',
          title: prompt.title || `Prompt ${idx + 1}`,
          contexts: ['all']
        });
      });
    });
  });
}

// On install or update, create the context menu
chrome.runtime.onInstalled.addListener(() => {
  createPromptContextMenu();
});

// On startup, also create the context menu (for reloads)
chrome.runtime.onStartup.addListener(() => {
  createPromptContextMenu();
});

// Listen for prompts changes via the unified API and update the context menu
onPromptsChanged(() => {
  // COMMENT: Regenerate the context menu whenever prompts change
  createPromptContextMenu();
});

// When a context menu item is clicked
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId.startsWith('prompt-')) {
    // Extract the prompt index
    const idx = parseInt(info.menuItemId.replace('prompt-', ''), 10);
    const prompts = await getAllPrompts();
    if (prompts[idx]) {
      // Write the prompt content to the clipboard
      try {
        await navigator.clipboard.writeText(prompts[idx].content);
        // Optionally, show a notification
        chrome.notifications?.create({
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title: 'Prompt Copied',
          message: `Copied: ${prompts[idx].title}`
        });
      } catch (err) {
        // Fallback: try to copy using the tabs API if clipboard API fails
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (text) => navigator.clipboard.writeText(text),
          args: [prompts[idx].content]
        });
      }
    }
  }
});

// --- END CONTEXT MENU ---
