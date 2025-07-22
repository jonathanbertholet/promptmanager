// This script is injected into the page to manage permissions for AI providers
// It retrieves the providers map from storage and creates elements for each provider
document.addEventListener('DOMContentLoaded', function () {

  // Get the target containers
  const permissionGrantedContainer = document.getElementById('permission-granted');
  const requestPermissionContainer = document.getElementById('request-permission');
  // Get the Get Started button container
  const getStartedBtnContainer = document.getElementById('get-started-btn-container');

  if (!permissionGrantedContainer || !requestPermissionContainer) {
    console.error('Required container elements (#permission-granted or #request-permission) not found.');
    return; // Stop execution if containers are missing
  }

  function updateGetStartedButton(allowedProviders) {
    if (allowedProviders.length > 0 && getStartedBtnContainer) {
      // Fetch the LLM provider URLs from llm_providers.json
      fetch(chrome.runtime.getURL('llm_providers.json'))
        .then(response => response.json())
        .then(data => {
          // Find the first allowed provider in the llm_providers list (by name match)
          const llmList = data.llm_providers || [];
          let firstAllowedUrl = null;
          for (const allowed of allowedProviders) {
            const match = llmList.find(llm => llm.name === allowed.key);
            if (match && match.url) {
              firstAllowedUrl = match.url;
              break;
            }
          }
          if (firstAllowedUrl) {
            // Create the Get Started button
            getStartedBtnContainer.innerHTML = `<button id="get-started-btn" class="custom-button" style="font-size: 1.2rem; padding: 0.75rem 1rem; margin-top: 1rem; display: inline-flex; align-items: center; gap: 0.5rem;">
                <img src="../icons/icon-button.png" alt="Open Prompt Manager Icon" width="28" height="28" style="object-fit: cover;"> 
                <span style="vertical-align: middle;">Get Started</span>
              </button>`;
            // Add click event to open the URL in a new tab
            document.getElementById('get-started-btn').addEventListener('click', function() {
              window.open(firstAllowedUrl, '_blank');
            });
          }
        });
    } else if (getStartedBtnContainer) {
      // Hide or clear the button if no allowed providers
      getStartedBtnContainer.innerHTML = '';
    }
  }

  // Get the providers map from storage when the page loads
  chrome.storage.local.get(['aiProvidersMap'], function (result) {
    if (result.aiProvidersMap) {
      const providersMap = result.aiProvidersMap;
      console.log('Retrieved providersMap from storage:', providersMap);

      // Store allowed providers for Get Started logic
      const allowedProviders = [];

      // Process the provider map data
      for (const [key, providerInfo] of Object.entries(providersMap)) {
        // Assume providerInfo contains name, iconUrl, urlPattern, and hasPermission
        // Example: providerInfo = { name: 'ChatGPT', iconUrl: '...', urlPattern: 'https://*.openai.com/*', hasPermission: 'Yes' }
        // If iconUrl is not directly available, you might need to construct it or use a default.
        const iconUrl = providerInfo.iconUrl

        const elementHTML = `
          <a id="perm-${key}" class="custom-button"
             aria-current="true" href="#" data-provider="${key}" data-url-pattern="${providerInfo.urlPattern}">
            <img src="${iconUrl}" alt="${key} icon" width="32" height="32" class="custom-rounded-circle">
            <span class="custom-mb-0">${key}</span>
          </a>`;

        let targetContainer;
        let needsClickListener = false;

        if (providerInfo.hasPermission == "Yes") {
          console.log(`Provider: ${key}, Has Permission: Yes`);
          targetContainer = permissionGrantedContainer;
          allowedProviders.push({ key, providerInfo }); // Collect allowed providers
          // Optionally add styling or text to indicate granted status within the element if needed
        } else {
          console.log(`Provider: ${key}, Has Permission: No`);
          targetContainer = requestPermissionContainer;
          needsClickListener = true; // Only add listener if permission needs to be requested
        }

        // Append the element
        targetContainer.insertAdjacentHTML('beforeend', elementHTML);

        // Add click listener AFTER the element is in the DOM if needed
        if (needsClickListener) {
          const element = document.getElementById(`perm-${key}`); // Get the newly added element
          if (element) {
            element.addEventListener('click', function (event) {
              event.preventDefault(); // Prevent default link behavior
              const providerKey = this.dataset.provider;
              const originPattern = this.dataset.urlPattern;
              console.log(`Requesting permission for ${providerKey} with pattern: ${originPattern}`);

              chrome.permissions.request({ origins: [originPattern] }, function (granted) {
                if (granted) {
                  // Update storage
                  providersMap[providerKey].hasPermission = "Yes"; // Update the specific provider's status
                  chrome.storage.local.set({ aiProvidersMap: providersMap }, () => {
                     console.log(`Storage updated for ${providerKey}`);
                     // Move the element visually
                     permissionGrantedContainer.appendChild(element);
                     // Remove the click listener as it's no longer needed
                     element.removeEventListener('click', arguments.callee);
                     // Optionally update element style/text
                     allowedProviders.push({ key: providerKey, providerInfo: providersMap[providerKey] });
                     updateGetStartedButton(allowedProviders);
                  });
                } else {
                  alert(`Permission denied for ${providerKey}`);
                }
              });
            });
          }
        }
      }
      // After processing all providers, show the Get Started button if at least one is allowed
      updateGetStartedButton(allowedProviders);
      
    } else {
      console.log('No providersMap found in storage.');
      // Handle the case where the map doesn't exist yet
      requestPermissionContainer.innerHTML = '<p>No provider data found in storage.</p>'; // Example message
    }
  });

  const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (isDarkMode) {
    const headerIcon = document.getElementById('header-icon');
    if (headerIcon) {
      headerIcon.classList.add('dark-mode-icon');
    }
  }
});