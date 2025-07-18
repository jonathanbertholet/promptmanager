// prompts.js

import { generateUUID } from './utils.js';

// Update the constants
const CHROME_STORAGE_LIMIT = Number.MAX_SAFE_INTEGER; // Remove practical storage limit
const CHROME_STORAGE_ITEM_LIMIT = Number.MAX_SAFE_INTEGER; // Remove practical storage limit
const PROMPT_OVERHEAD = 50; // Estimated overhead for prompt metadata

// check storage usage
async function getStorageUsage() {
  const data = await chrome.storage.local.get('prompts');
  const prompts = data.prompts || [];
  const used = new TextEncoder().encode(JSON.stringify(prompts)).length;
  const total = CHROME_STORAGE_LIMIT;
  const percentage = Math.round((used / total) * 100);

  return {
    used,
    total,
    percentage
  };
}

// Add this function at the top level
async function migrateFromSyncToLocal() {
  try {
    // Check if we've already performed the migration
    const migrationFlag = await chrome.storage.local.get('syncMigrationComplete');
    if (migrationFlag.syncMigrationComplete) {
      return;
    }

    // Check for prompts in sync storage
    const syncData = await chrome.storage.sync.get('prompts');
    if (syncData.prompts && syncData.prompts.length > 0) {
      console.log('Found prompts in sync storage, copying to local storage...');

      // Get existing local prompts (if any)
      const localData = await chrome.storage.local.get('prompts');
      const localPrompts = localData.prompts || [];

      // Merge prompts, keeping the newer version if duplicates exist
      const mergedPrompts = mergePrompts(localPrompts, syncData.prompts);

      // Save to local storage
      await chrome.storage.local.set({ prompts: mergedPrompts });

      console.log('Migration complete:', mergedPrompts.length, 'prompts copied to local storage');
    }

    // Set migration flag to prevent future migrations
    await chrome.storage.local.set({ syncMigrationComplete: true });

  } catch (error) {
    console.error('Error during storage migration:', error);
  }
}

// Update the mergePrompts function to handle both formats
function mergePrompts(localPrompts, syncPrompts) {
  // Create a map of existing prompts by ID/UUID
  const promptsMap = new Map();

  // Add local prompts to the map
  localPrompts.forEach(prompt => {
    // Handle both id and uuid formats
    const identifier = prompt.uuid || prompt.id;
    if (identifier) {
      promptsMap.set(identifier, prompt);
    }
  });

  // Merge sync prompts, updating if newer version exists
  syncPrompts.forEach(syncPrompt => {
    // Handle both id and uuid formats
    const identifier = syncPrompt.uuid || syncPrompt.id;

    if (identifier) {
      // Convert id to uuid if needed
      if (syncPrompt.id && !syncPrompt.uuid) {
        syncPrompt.uuid = syncPrompt.id;
        delete syncPrompt.id;
      }

      // Remove createdAt if present (from old format)
      if (syncPrompt.createdAt) {
        delete syncPrompt.createdAt;
      }

      if (promptsMap.has(identifier)) {
        // Update existing prompt if sync version is newer
        const localPrompt = promptsMap.get(identifier);
        const localDate = localPrompt.updatedAt || localPrompt.createdAt;
        const syncDate = syncPrompt.updatedAt || syncPrompt.createdAt;

        if (new Date(syncDate) > new Date(localDate)) {
          promptsMap.set(identifier, syncPrompt);
        }
      } else {
        // Add new prompt
        promptsMap.set(identifier, syncPrompt);
      }
    }
  });

  // Convert map back to array
  return Array.from(promptsMap.values());
}

// Update the addPrompt function to use uuid instead of id
export async function addPrompt(title, content) {
  if (!title || !content) return;

  try {
    const prompt = {
      uuid: generateUUID(), // Use uuid instead of id
      title,
      content,
      createdAt: new Date().toISOString()
    };

    // Get current prompts first
    const data = await chrome.storage.local.get('prompts');
    const prompts = data.prompts || [];

    // Add the new prompt
    const allPrompts = [...prompts, prompt];

    // Save all prompts as a single item
    await chrome.storage.local.set({ prompts: allPrompts });

    // Reset form
    document.getElementById('prompt-title').value = '';
    document.getElementById('prompt-content').value = '';

    // Reload prompts to update the display
    loadPrompts();

  } catch (error) {
    console.error('Error saving prompt:', error);
  }
}

// Update the updatePrompt function to handle both formats
export function updatePrompt(index, title, content) {
  chrome.storage.local.get('prompts', data => {
    const prompts = data.prompts || [];
    if (index >= 0 && index < prompts.length) {
      // Ensure prompt has uuid instead of id
      if (prompts[index].id && !prompts[index].uuid) {
        prompts[index].uuid = prompts[index].id;
        delete prompts[index].id;
      }

      prompts[index] = {
        ...prompts[index],
        title,
        content,
        updatedAt: new Date().toISOString()
      };
      chrome.storage.local.set({ prompts }, loadPrompts);
    }
  });
}

export function deletePrompt(index) {
  // Use chrome's built-in confirmation dialog before deleting
  if (window.confirm('Are you sure you want to delete this prompt?')) {
    chrome.storage.local.get('prompts', data => {
      const prompts = data.prompts || [];
      prompts.splice(index, 1);
      chrome.storage.local.set({ prompts }, loadPrompts);
    });
  }
  // If user cancels, do nothing
}

export function editPrompt(index) {
  chrome.storage.local.get('prompts', data => {
    const prompts = data.prompts || [];
    if (index >= 0 && index < prompts.length) {
      const prompt = prompts[index];
      document.getElementById('prompt-title').value = prompt.title;
      document.getElementById('prompt-content').value = prompt.content;
      document.getElementById('prompt-index').value = index;
      document.getElementById('submit-button').textContent = 'Update';
      document.getElementById('cancel-edit-button').style.display = 'inline';
    }
  });
}

// Helper function to animate button press
function animateButtonPress(button) {
  button.classList.add('pressed');
  setTimeout(() => {
    button.classList.remove('pressed');
  }, 180); // short feedback
}

export function copyToClipboard(index) {
  chrome.storage.local.get('prompts', data => {
    const prompts = data.prompts || [];
    if (index >= 0 && index < prompts.length) {
      const prompt = prompts[index];
      navigator.clipboard.writeText(prompt.content)
        .then(() => {
          // Provide visual feedback by animating the button as "pressed"
          const promptList = document.getElementById('prompt-list');
          if (promptList && promptList.children[index]) {
            // The copy button is the second child (after the title span)
            const li = promptList.children[index];
            const copyBtn = li.querySelector('button');
            if (copyBtn) {
              animateButtonPress(copyBtn);
            }
          }
        })
    }
  });
}

export function displayPrompts(prompts) {
  const promptList = document.getElementById('prompt-list');
  const emptyState = document.getElementById('empty-state');
  promptList.innerHTML = '';

  if (prompts.length === 0) {
    // Show the existing empty state div instead of creating a new one
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';
  prompts.forEach((prompt, index) => {
    const li = document.createElement('li');

    const titleSpan = document.createElement('span');
    titleSpan.textContent = prompt.title;
    titleSpan.style.margin = '2px';
    titleSpan.style.padding = '3px';
    titleSpan.style.verticalAlign = 'middle';
    titleSpan.style.display = 'inline-block';
    li.appendChild(titleSpan);

    const copyBtn = document.createElement('button');
    const copyImg = document.createElement('img');
    copyImg.src = '../icons/copy.png';
    copyImg.alt = 'Copy';
    copyImg.title = 'Copy to clipboard';
    copyImg.width = 14;
    copyImg.height = 14;
    copyImg.style.verticalAlign = 'middle';
    copyBtn.style.display = 'none';
    copyBtn.style.backgroundColor = '#ffffff00';  // white bg

    copyBtn.appendChild(copyImg);
    copyBtn.addEventListener('click', () => copyToClipboard(index));
    li.appendChild(copyBtn);

    const editBtn = document.createElement('button');
    const editImg = document.createElement('img');
    editImg.src = '../icons/edit-icon.png';
    editImg.alt = 'Edit';
    editImg.title = 'Edit';
    editImg.width = 14;
    editImg.height = 14;
    editImg.style.verticalAlign = 'middle';
    editBtn.style.display = 'none';
    editBtn.style.backgroundColor = '#ffffff00';  // white bg

    editBtn.appendChild(editImg);
    editBtn.addEventListener('click', () => {
      editPrompt(index);
    });
    li.appendChild(editBtn);

    const delBtn = document.createElement('button');
    const delImg = document.createElement('img');
    delImg.src = '../icons/delete-icon.png';
    delImg.alt = 'Delete';
    delImg.title = 'Delete';
    delImg.width = 18;
    delImg.height = 18;
    delImg.style.verticalAlign = 'middle';
    delBtn.style.display = 'none';
    delBtn.style.backgroundColor = '#ffffff00';  // white bg
    delBtn.appendChild(delImg);
    delBtn.addEventListener('click', () => {
      deletePrompt(index);
    });
    li.appendChild(delBtn);

    li.addEventListener('mouseenter', () => {
      copyBtn.style.display = 'inline-block';
      editBtn.style.display = 'inline-block';
      delBtn.style.display = 'inline-block';
    });

    li.addEventListener('mouseleave', () => {
      copyBtn.style.display = 'none';
      editBtn.style.display = 'none';
      delBtn.style.display = 'none';
    });

    promptList.appendChild(li);
  });
}

// Ensure all prompts have uuid
export async function normalizePromptFormat() {
  try {
    const data = await chrome.storage.local.get('prompts');
    const prompts = data.prompts || [];

    let needsUpdate = false;

    // Convert prompts to use uuid instead of id
    const normalizedPrompts = prompts.map(prompt => {
      let updated = { ...prompt };

      // Convert id to uuid if needed
      if (updated.id && !updated.uuid) {
        updated.uuid = updated.id;
        delete updated.id;
        needsUpdate = true;
      }

      // Ensure uuid exists
      if (!updated.uuid) {
        updated.uuid = generateUUID();
        needsUpdate = true;
      }

      return updated;
    });

    // Only update storage if changes were made
    if (needsUpdate) {
      await chrome.storage.local.set({ prompts: normalizedPrompts });
      console.log('Normalized prompt format to use uuid');
    }

    return normalizedPrompts;
  } catch (error) {
    console.error('Error normalizing prompt format:', error);
    return null;
  }
}

// Update the loadPrompts function to normalize prompt format
export function loadPrompts() {
  // First perform migration if needed
  migrateFromSyncToLocal().then(() => {
    // Then normalize prompt format
    normalizePromptFormat().then(() => {
      // Then load prompts from local storage
      chrome.storage.local.get('prompts', data => {
        const prompts = data.prompts || [];
        console.log('Loaded prompts:', prompts);
        displayPrompts(prompts);
      });
    });
  });
}


