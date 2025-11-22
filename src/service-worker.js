import { getProviders } from './llm_providers.js'; // Import the correct function
import { getPrompts, onPromptsChanged, savePrompt } from './promptStorage.js'; // COMMENT: Unified prompt storage API

chrome.runtime.onInstalled.addListener(function (details) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  console.log('onInstalled', details);
  // COMMENT: Rebuild providers map on install and update (but only open UI on first install)
  const shouldRebuild = ['install', 'update'].includes(details.reason);
  if (details.reason === 'install') {
    chrome.tabs.create({ url: 'permissions/permissions.html' });
  }
  if (shouldRebuild) {
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
  }
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
            files: [
              "inputBoxHandler.js",
              "content.styles.js",
              "content.shared.js",
              "content.js"
            ]
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
              files: [
                "inputBoxHandler.js",
                "content.styles.js",
                "content.shared.js",
                "content.js"
              ]
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
    // Fetch the providers list (use absolute extension URL for reliability)
    const response = await fetch(chrome.runtime.getURL('llm_providers.json'));
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const providersData = await response.json();

    // COMMENT: Normalize icon URLs. For local paths (e.g. "../icons/foo.png" or "icons/foo.png"),
    // convert to an absolute chrome-extension:// URL so all UIs resolve consistently.
    const resolveIconUrl = (raw) => {
      if (!raw) return '';
      // Keep absolute/network/data/chrome-extension URLs as-is
      if (/^(https?:|data:|chrome-extension:)/.test(raw)) return raw;
      // Strip leading ./ or ../ segments to anchor at the extension root
      const normalized = raw.replace(/^(\.\.\/)+/, '').replace(/^\.\//, '');
      return chrome.runtime.getURL(normalized);
    };

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
        iconUrl: resolveIconUrl(providerInfo.icon_url)
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
    // First child: "Save as prompt" – only shown when there is a text selection
    // COMMENT: This enables the flow "select text → right-click → Open Prompt Manager → Save as prompt"
    chrome.contextMenus.create({
      id: 'save-as-prompt',
      parentId: 'open-prompt-manager',
      title: 'Save new prompt',
      contexts: ['selection']
    });
    // COMMENT: Visual separator between "Save as prompt" and the list of existing prompts.
    // Only show when there is a selection, mirroring the visibility of the save item.
    chrome.contextMenus.create({
      id: 'save-separator',
      parentId: 'open-prompt-manager',
      type: 'separator',
      contexts: ['selection']
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
  // COMMENT: Refresh providers map on startup so icon changes and new providers propagate without reinstall
  (async () => {
    try {
      const providersMap = await checkProviderPermissions();
      await chrome.storage.local.set({ 'aiProvidersMap': providersMap });
    } catch (e) {
      console.error('Failed to refresh aiProvidersMap on startup:', e);
    }
  })();
});

// Listen for prompts changes via the unified API and update the context menu
onPromptsChanged(() => {
  // COMMENT: Regenerate the context menu whenever prompts change
  createPromptContextMenu();
});

// When a context menu item is clicked
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  // Handle "Save as prompt": opens a small popup dialog prefilled with the selected text
  if (info.menuItemId === 'save-as-prompt') {
    // COMMENT: Use Chrome's built-in dialogs in the page context:
    // - prompt() to capture the title
    // - alert() to show validation error if title is empty
    try {
      const selected = info.selectionText || '';
      // Ask for a title using the page's built-in blocking prompt
      const [{ result: titleValue }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          return window.prompt('Enter a title for your prompt', '');
        }
      });
      const title = (titleValue || '').trim();
      if (!title) {
        // Show the requested error message if no title provided
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => { window.alert('Please add a title to your prompt.'); }
        });
        return;
      }
      // Persist the prompt using the unified storage API
      await savePrompt({ title, content: selected });
      // Optional: fire a lightweight notification if available
      chrome.notifications?.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Prompt Saved',
        message: `Saved: ${title}`
      });
    } catch (err) {
      console.error('Failed to save prompt from selection:', err);
    }
    return;
  }
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
