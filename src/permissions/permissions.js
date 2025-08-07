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
      /*
        Try to use the URL that we already have in memory (it was populated via
        service-worker.js -> checkProviderPermissions). This removes the need for
        an extra fetch request and avoids potential path issues when the
        permissions page lives in a sub-folder ("src/permissions") while the JSON
        file is located in "src/llm_providers.json".
      */
      let firstAllowedUrl = null;

      for (const allowed of allowedProviders) {
        if (allowed.providerInfo && allowed.providerInfo.url) {
          firstAllowedUrl = allowed.providerInfo.url;
          break;
        }
      }

      // Fallback – if, for some reason, the providerInfo does not contain a
      // URL, we fetch the JSON file (using the correct path) and try to look it
      // up. This keeps backwards-compatibility with existing logic.
      const ensureUrlPromise = firstAllowedUrl
        ? Promise.resolve(firstAllowedUrl)
        : fetch(chrome.runtime.getURL('/llm_providers.json'))
            .then(response => response.json())
            .then(data => {
              const llmList = data.llm_providers || [];
              for (const allowed of allowedProviders) {
                const match = llmList.find(llm => llm.name === allowed.key);
                if (match && match.url) {
                  return match.url;
                }
              }
              return null;
            });

      ensureUrlPromise.then(resolvedUrl => {
        if (resolvedUrl) {
          // Create (or replace) the Get Started button
          getStartedBtnContainer.innerHTML = `<button id="get-started-btn" class="custom-button" style="font-size: 1.2rem; padding: 0.75rem 1rem; margin-top: 1rem; display: inline-flex; align-items: center; gap: 0.5rem;">
              <img src="../icons/icon-button.png" alt="Open Prompt Manager Icon" width="28" height="28" style="object-fit: cover;"> 
              <span style="vertical-align: middle;">Get Started</span>
            </button>`;

          // Open the provider in a new tab when the button is clicked
          document.getElementById('get-started-btn').addEventListener('click', () => {
            window.open(resolvedUrl, '_blank');
          });
        }
      });

    } else if (getStartedBtnContainer) {
      // Hide or clear the button if no allowed providers
      getStartedBtnContainer.innerHTML = '';
    }
  }

  // Function to populate providers UI
  function populateProviders(providersMap) {
    console.log('Populating UI with providers map:', providersMap);

    // Clear existing content
    permissionGrantedContainer.innerHTML = '';
    requestPermissionContainer.innerHTML = '';

    const allowedProviders = [];

    for (const [key, providerInfo] of Object.entries(providersMap)) {
      const iconUrl = providerInfo.iconUrl;
      const isAllowed = providerInfo.hasPermission === "Yes";

      // For allowed providers, clicking should open their website in a new tab.
      // For not-yet-allowed providers, the link remains "#" and we attach the
      // permission-request listener below.
      const elementHTML = isAllowed
        ? `<a id="perm-${key}" class="custom-button"
               aria-current="true" href="${providerInfo.url}" target="_blank" rel="noopener">
              <img src="${iconUrl}" alt="${key} icon" width="32" height="32" class="custom-rounded-circle">
              <span class="custom-mb-0">${key}</span>
            </a>`
        : `<a id="perm-${key}" class="custom-button"
               aria-current="true" href="#" data-provider="${key}" data-url-pattern="${providerInfo.urlPattern}">
              <img src="${iconUrl}" alt="${key} icon" width="32" height="32" class="custom-rounded-circle">
              <span class="custom-mb-0">${key}</span>
            </a>`;

      let targetContainer;
      let needsClickListener = false;

      if (providerInfo.hasPermission == "Yes") {
        targetContainer = permissionGrantedContainer;
        allowedProviders.push({ key, providerInfo }); // Collect allowed providers
      } else {
        targetContainer = requestPermissionContainer;
        needsClickListener = true;
      }

      targetContainer.insertAdjacentHTML('beforeend', elementHTML);

      if (needsClickListener) {
        const element = document.getElementById(`perm-${key}`);
        if (element) {
          const handleProviderClick = function (event) {
            event.preventDefault();

            const providerKey = this.dataset.provider;
            const originPattern = this.dataset.urlPattern;

            chrome.permissions.request({ origins: [originPattern] }, (granted) => {
              if (granted) {
                // Update local providersMap and persist
                providersMap[providerKey].hasPermission = "Yes";
                // Persist change; UI will refresh via storage.onChanged listener
                chrome.storage.local.set({ aiProvidersMap: providersMap });
              } else {
                alert(`Permission denied for ${providerKey}`);
              }
            });
          };
          element.addEventListener('click', handleProviderClick);
        }
      }
    }

    updateGetStartedButton(allowedProviders);
  }

  // Listen for changes to aiProvidersMap in storage and update UI
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.aiProvidersMap && changes.aiProvidersMap.newValue) {
      populateProviders(changes.aiProvidersMap.newValue);
    }
  });

  // Get the providers map from storage when the page loads
  chrome.storage.local.get(['aiProvidersMap'], function (result) {
    if (result.aiProvidersMap) {
      const providersMap = result.aiProvidersMap;
      console.log('Retrieved providersMap from storage:', providersMap);

      // Use the helper to populate UI and attach listeners
      populateProviders(providersMap);
      
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