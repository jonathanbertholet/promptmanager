// This script is injected into the page to manage permissions for AI providers
// It retrieves the providers map from storage and creates elements for each provider
document.addEventListener('DOMContentLoaded', function () {

  // Get the target containers
  const permissionGrantedContainer = document.getElementById('permission-granted');
  const requestPermissionContainer = document.getElementById('request-permission');

  if (!permissionGrantedContainer || !requestPermissionContainer) {
    console.error('Required container elements (#permission-granted or #request-permission) not found.');
    return; // Stop execution if containers are missing
  }

  // Get the providers map from storage when the page loads
  chrome.storage.local.get(['aiProvidersMap'], function (result) {
    if (result.aiProvidersMap) {
      const providersMap = result.aiProvidersMap;
      console.log('Retrieved providersMap from storage:', providersMap);

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
                  });
                } else {
                  alert(`Permission denied for ${providerKey}`);
                }
              });
            });
          }
        }
      }
    } else {
      console.log('No providersMap found in storage.');
      // Handle the case where the map doesn't exist yet
      requestPermissionContainer.innerHTML = '<p>No provider data found in storage.</p>'; // Example message
    }
  });
});