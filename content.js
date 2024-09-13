// content.js

console.log("ChatGPT Prompt Manager content script loaded.");

// Function to inject the dropdown menu
function injectDropdown(prompts) {
  // Check if the dropdown already exists
  if (document.getElementById('prompt-dropdown')) {
    console.log('Dropdown already exists.');
    return;
  }

  // Select the contenteditable div using its id
  const inputBox = document.getElementById('prompt-textarea');

  if (!inputBox) {
    console.error('Input box (contenteditable div) not found.');
    return;
  }

  console.log('Input box found:', inputBox);

  // Create dropdown
  const dropdown = document.createElement('select');
  dropdown.id = 'prompt-dropdown';
  dropdown.style.marginBottom = '10px';
  dropdown.style.width = '100%';
  dropdown.style.padding = '5px';
  dropdown.style.fontSize = '14px';

  // Default option
  const defaultOption = document.createElement('option');
  defaultOption.text = prompts.length > 0 ? 'Select a prompt' : 'No prompts available';
  defaultOption.value = '';
  dropdown.add(defaultOption);

  // Disable the dropdown if there are no prompts
  if (prompts.length === 0) {
    dropdown.disabled = true;
  }

  // Add prompts to dropdown
  prompts.forEach(prompt => {
    const option = document.createElement('option');
    option.text = prompt.title;
    option.value = prompt.content;
    dropdown.add(option);
  });

  // Event listener to insert prompt into input box
  dropdown.addEventListener('change', () => {
    if (dropdown.value === '') return; // Do nothing if default option is selected

    // Set the content of the contenteditable div
    inputBox.focus();
    inputBox.innerText = dropdown.value;

    // Move the cursor to the end
    const range = document.createRange();
    range.selectNodeContents(inputBox);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    // Reset the dropdown to default
    dropdown.selectedIndex = 0;
  });

  // Insert dropdown into the page
  const parentContainer = inputBox.parentNode;
  parentContainer.insertBefore(dropdown, inputBox);
}

// Function to initialize the dropdown when the input box is available
function initialize() {
  // Use MutationObserver to watch for changes in the DOM
  const observer = new MutationObserver((mutations, obs) => {
    for (const mutation of mutations) {
      // Check if the input box exists and dropdown doesn't exist
      const inputBox = document.getElementById('prompt-textarea');
      if (inputBox && !document.getElementById('prompt-dropdown')) {
        console.log('Input box detected or re-added by MutationObserver.');
        // Get prompts from storage and inject dropdown
        chrome.storage.sync.get('prompts', data => {
          const prompts = data.prompts || [];
          injectDropdown(prompts);
        });
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Start the initialization process
initialize();

// Listen for updates to prompts
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.prompts) {
    console.log('Prompts updated in storage.');
    // Remove existing dropdown
    const oldDropdown = document.getElementById('prompt-dropdown');
    if (oldDropdown) oldDropdown.remove();
    // Re-inject dropdown with updated prompts
    const inputBox = document.getElementById('prompt-textarea');
    if (inputBox) {
      injectDropdown(changes.prompts.newValue);
    }
  }
});
