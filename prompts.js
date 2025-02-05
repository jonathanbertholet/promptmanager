// prompts.js

import { generateUUID } from './utils.js';

// Update the constants
const CHROME_STORAGE_LIMIT = 10485760; // Chrome local storage total limit (10MB)
const CHROME_STORAGE_ITEM_LIMIT = 10485760; // Chrome local storage per-item limit (10MB)
const PROMPT_OVERHEAD = 50; // Estimated overhead for prompt metadata

// Add this function to check storage usage
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

// Helper function to merge prompts arrays, handling duplicates
function mergePrompts(localPrompts, syncPrompts) {
  // Create a map of existing prompts by ID
  const promptsMap = new Map(
    localPrompts.map(p => [p.id, p])
  );
  
  // Merge sync prompts, updating if newer version exists
  syncPrompts.forEach(syncPrompt => {
    if (syncPrompt.id) {
      if (promptsMap.has(syncPrompt.id)) {
        // Update existing prompt if sync version is newer
        const localPrompt = promptsMap.get(syncPrompt.id);
        const localDate = localPrompt.updatedAt || localPrompt.createdAt;
        const syncDate = syncPrompt.updatedAt || syncPrompt.createdAt;
        
        if (new Date(syncDate) > new Date(localDate)) {
          promptsMap.set(syncPrompt.id, syncPrompt);
        }
      } else {
        // Add new prompt
        promptsMap.set(syncPrompt.id, syncPrompt);
      }
    }
  });
  
  // Convert map back to array
  return Array.from(promptsMap.values());
}

// Modify the loadPrompts function to include migration
export function loadPrompts() {
  // First perform migration if needed
  migrateFromSyncToLocal().then(() => {
    // Then load prompts from local storage
    chrome.storage.local.get('prompts', data => {
      const prompts = data.prompts || [];
      displayPrompts(prompts);
      
      // Check for cached prompts on load
      checkForCachedPrompt();
    });
  });
}

export async function addPrompt(title, content) {
  if (!title || !content) return;
  
  try {
    const prompt = { 
      id: generateUUID(),
      title, 
      content,
      createdAt: new Date().toISOString()
    };

    // Get current prompts first
    const data = await chrome.storage.local.get('prompts');
    const prompts = data.prompts || [];
    
    // Calculate size of all prompts including the new one
    const allPrompts = [...prompts, prompt];
    const totalSize = new TextEncoder().encode(JSON.stringify(allPrompts)).length;
    
    // Check total storage limit
    if (totalSize > CHROME_STORAGE_LIMIT) {
      window.localStorage.setItem('popupCachedPrompt', JSON.stringify(prompt));
      throw new Error(`Total storage limit exceeded. The prompts require ${Math.round(totalSize/1024)}KB, but only ${Math.round(CHROME_STORAGE_LIMIT/1024)}KB is available.`);
    }

    // Save all prompts as a single item
    await chrome.storage.local.set({ prompts: allPrompts });
    
    // Clear any cached prompt
    window.localStorage.removeItem('popupCachedPrompt');
    
    // Refresh display
    loadPrompts();
    
    // Reset form
    document.getElementById('prompt-title').value = '';
    document.getElementById('prompt-content').value = '';

  } catch (error) {
    console.error('Error saving prompt:', error);
    
    // Cache the prompt if it wasn't already cached
    if (!window.localStorage.getItem('popupCachedPrompt')) {
      window.localStorage.setItem('popupCachedPrompt', JSON.stringify({ title, content }));
    }
    
    showErrorDialog(error.message);
  }
}

// Update the showErrorDialog function to show storage usage
async function showErrorDialog(message) {
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const usage = await getStorageUsage();
  
  const dialog = document.createElement('div');
  Object.assign(dialog.style, {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    zIndex: '10001',
    maxWidth: '400px',
    width: '90%'
  });

  dialog.innerHTML = `
    <h3 style="margin-top: 0; color: ${isDark ? '#e1e1e1' : '#333'}">Unable to Save Prompt</h3>
    <p style="color: ${isDark ? '#e1e1e1' : '#333'}">${message}</p>
    <div style="
      margin: 15px 0;
      padding: 10px;
      background: ${isDark ? '#2a2a2a' : '#f5f5f5'};
      border-radius: 4px;
    ">
      <p style="color: ${isDark ? '#e1e1e1' : '#333'}; margin: 0 0 8px 0;">
        Storage Usage: ${usage.percentage}%
      </p>
      <div style="
        height: 8px;
        background: ${isDark ? '#444' : '#ddd'};
        border-radius: 4px;
        overflow: hidden;
      ">
        <div style="
          width: ${usage.percentage}%;
          height: 100%;
          background: ${usage.percentage > 90 ? '#ff4444' : '#3375b1'};
          transition: width 0.3s ease;
        "></div>
      </div>
      <p style="color: ${isDark ? '#999' : '#666'}; font-size: 12px; margin: 8px 0 0 0;">
        ${(usage.used / 1024).toFixed(1)}KB used of ${(usage.total / 1024).toFixed(1)}KB total
      </p>
      <p style="color: ${isDark ? '#999' : '#666'}; font-size: 12px; margin: 4px 0 0 0;">
        Maximum prompt size: 10MB
      </p>
    </div>
    <p style="color: ${isDark ? '#e1e1e1' : '#333'}">Your prompt has been temporarily cached. You can try:</p>
    <ul style="color: ${isDark ? '#e1e1e1' : '#333'}">
      <li>Shortening the prompt content (must be under 10MB per prompt)</li>
      <li>Splitting the prompt into multiple smaller prompts</li>
      <li>Exporting your prompts and using local storage instead</li>
    </ul>
    <div style="text-align: right; margin-top: 15px;">
      <button id="dialog-close" style="
        padding: 8px 16px;
        background-color: ${isDark ? '#1e4976' : '#3375b1'};
        color: #ffffff;
        border: none;
        border-radius: 6px;
        cursor: pointer
      ">Close</button>
    </div>
  `;

  document.body.appendChild(dialog);

  // Close dialog handler
  dialog.querySelector('#dialog-close').onclick = () => {
    dialog.remove();
  };
}

// Update the checkForCachedPrompt function to use the popup-specific key
function checkForCachedPrompt() {
  const cachedPrompt = window.localStorage.getItem('popupCachedPrompt');
  if (cachedPrompt) {
    try {
      const prompt = JSON.parse(cachedPrompt);
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      
      const dialog = document.createElement('div');
      Object.assign(dialog.style, {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: '10001',
        maxWidth: '400px',
        width: '90%'
      });

      dialog.innerHTML = `
        <h3 style="margin-top: 0; color: ${isDark ? '#e1e1e1' : '#333'}">Recovered Unsaved Prompt</h3>
        <p style="color: ${isDark ? '#e1e1e1' : '#333'}">A prompt that couldn't be saved was found:</p>
        <p style="color: ${isDark ? '#e1e1e1' : '#333'}"><strong>Title:</strong> ${prompt.title}</p>
        <div style="text-align: right; margin-top: 15px;">
          <button id="dialog-retry" style="
            padding: 8px 16px;
            backgroundColor: ${isDark ? '#1e4976' : '#3375b1'};
            color: #ffffff;
            border: none;
            borderRadius: 6px;
            cursor: pointer;
            marginRight: 8px;
          ">Try Saving Again</button>
          <button id="dialog-discard" style="
            padding: 8px 16px;
            backgroundColor: ${isDark ? '#444' : '#ddd'};
            color: ${isDark ? '#fff' : '#333'};
            border: none;
            borderRadius: 6px;
            cursor: pointer;
          ">Discard</button>
        </div>
      `;

      document.body.appendChild(dialog);

      // Add button handlers
      dialog.querySelector('#dialog-retry').onclick = () => {
        dialog.remove();
        // Pre-fill the form with cached prompt
        document.getElementById('prompt-title').value = prompt.title;
        document.getElementById('prompt-content').value = prompt.content;
      };

      dialog.querySelector('#dialog-discard').onclick = () => {
        window.localStorage.removeItem('popupCachedPrompt');
        dialog.remove();
      };

    } catch (error) {
      console.error('Error handling cached prompt:', error);
      window.localStorage.removeItem('popupCachedPrompt');
    }
  }
}

export function updatePrompt(index, title, content) {
  chrome.storage.local.get('prompts', data => {
    const prompts = data.prompts || [];
    if (index >= 0 && index < prompts.length) {
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
  chrome.storage.local.get('prompts', data => {
    const prompts = data.prompts || [];
    prompts.splice(index, 1);
    chrome.storage.local.set({ prompts }, loadPrompts);
  });
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
  
    const editBtn = document.createElement('button');
    const editImg = document.createElement('img');
    editImg.src = 'icons/edit-icon.png';
    editImg.alt = 'Edit';
    editImg.width = 14;
    editImg.height = 14;
    editImg.style.verticalAlign = 'middle';
    editBtn.style.display = 'none';
    editBtn.style.backgroundColor = '#ffffff00';  // Set background color to white

    editBtn.appendChild(editImg);
    editBtn.addEventListener('click', () => editPrompt(index));
    li.appendChild(editBtn);
  
    const delBtn = document.createElement('button');
    const delImg = document.createElement('img');
    delImg.src = 'icons/delete-icon.png';
    delImg.alt = 'Delete';
    delImg.width = 10;
    delImg.height = 10;
    delImg.style.verticalAlign = 'middle';
    delBtn.style.display = 'none';
    delBtn.style.backgroundColor = '#ffffff00';  // Set background color to white
    delBtn.appendChild(delImg);
    delBtn.addEventListener('click', () => deletePrompt(index));
    li.appendChild(delBtn);

    li.addEventListener('mouseenter', () => {
      editBtn.style.display = 'inline-block';
      delBtn.style.display = 'inline-block';
    });

    li.addEventListener('mouseleave', () => {
      editBtn.style.display = 'none';
      delBtn.style.display = 'none';
    });
  
    promptList.appendChild(li);
  });
}
  

