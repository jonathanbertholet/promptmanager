//Content.js

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
  dropdown.style.borderRadius = '8px';  // Rounded corners with 8px radius


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

// Function to wait for the textarea to be available
function waitForTextarea() {
  return new Promise((resolve, reject) => {
    const checkExist = setInterval(() => {
      const inputBox = document.getElementById('prompt-textarea');
      if (inputBox) {
        clearInterval(checkExist);
        resolve(inputBox);
      }
    }, 500); // Check every 500ms

    // Optional: Set a timeout if you want to reject after a certain time
    setTimeout(() => {
      clearInterval(checkExist);
      reject("Textarea not found.");
    }, 10000); // 10 seconds timeout
  });
}

// Function to initialize the dropdown when the input box is available
async function initialize() {
  try {
    // Wait for the textarea to be available
    const inputBox = await waitForTextarea();
    console.log('Textarea found on initial load.');
    
    // Fetch prompts and inject dropdown
    chrome.storage.sync.get('prompts', data => {
      const prompts = data.prompts || [];
      injectDropdown(prompts);
    });

    // Use MutationObserver to watch for dynamic changes in the DOM
    const observer = new MutationObserver((mutations, obs) => {
      mutations.forEach(mutation => {
        const inputBox = document.getElementById('prompt-textarea');
        if (inputBox && !document.getElementById('prompt-dropdown')) {
          console.log('Input box detected or re-added by MutationObserver.');
          // Get prompts from storage and inject dropdown
          chrome.storage.sync.get('prompts', data => {
            const prompts = data.prompts || [];
            injectDropdown(prompts);
          });
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  } catch (error) {
    console.error(error);
  }
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
