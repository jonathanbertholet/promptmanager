// prompts.js

import { generateUUID } from './utils.js';

// Add constants for storage limits
const CHROME_STORAGE_LIMIT = 102400; // Chrome sync storage total limit (100KB)
const CHROME_STORAGE_ITEM_LIMIT = 8192; // Chrome sync storage per-item limit (8KB)
const PROMPT_OVERHEAD = 50; // Estimated overhead for prompt metadata

// Add this function to check storage usage
async function getStorageUsage() {
  return new Promise((resolve) => {
    chrome.storage.sync.getBytesInUse(null, (bytesInUse) => {
      resolve({
        used: bytesInUse,
        total: CHROME_STORAGE_LIMIT,
        percentage: Math.round((bytesInUse / CHROME_STORAGE_LIMIT) * 100)
      });
    });
  });
}

export function loadPrompts() {
  chrome.storage.sync.get('prompts', data => {
    const prompts = data.prompts || [];
    displayPrompts(prompts);
    
    // Check for cached prompts on load
    checkForCachedPrompt();
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

    // Calculate size of new prompt
    const promptSize = new TextEncoder().encode(JSON.stringify(prompt)).length + PROMPT_OVERHEAD;
    
    // Check per-item size limit first
    if (promptSize > CHROME_STORAGE_ITEM_LIMIT) {
      // Cache the prompt locally with a different key for popup
      if (!window.localStorage.getItem('popupCachedPrompt')) {
        window.localStorage.setItem('popupCachedPrompt', JSON.stringify(prompt));
      }
      
      showErrorDialog(
        `Prompt exceeds the per-item size limit (${Math.round(promptSize/1024)}KB). Each prompt must be under 8KB.`
      );
      return;
    }

    // Get current storage usage
    const usage = await getStorageUsage();
    
    // Then check total storage limit
    if (usage.used + promptSize > CHROME_STORAGE_LIMIT) {
      if (!window.localStorage.getItem('popupCachedPrompt')) {
        window.localStorage.setItem('popupCachedPrompt', JSON.stringify(prompt));
      }
      
      showErrorDialog(
        `Not enough storage space. The prompt requires ${Math.round(promptSize/1024)}KB, but only ${Math.round((CHROME_STORAGE_LIMIT - usage.used)/1024)}KB is available.`
      );
      return;
    }

    // If both checks pass, save the prompt
    const data = await chrome.storage.sync.get('prompts');
    const prompts = data.prompts || [];
    prompts.push(prompt);
    await chrome.storage.sync.set({ prompts });
    
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
        Maximum prompt size: 8KB
      </p>
    </div>
    <p style="color: ${isDark ? '#e1e1e1' : '#333'}">Your prompt has been temporarily cached. You can try:</p>
    <ul style="color: ${isDark ? '#e1e1e1' : '#333'}">
      <li>Shortening the prompt content (must be under 8KB per prompt)</li>
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
  chrome.storage.sync.get('prompts', data => {
    const prompts = data.prompts || [];
    if (index >= 0 && index < prompts.length) {
      prompts[index] = { 
        ...prompts[index],
        title, 
        content,
        updatedAt: new Date().toISOString()
      };
      chrome.storage.sync.set({ prompts }, loadPrompts);
    }
  });
}
  
export function deletePrompt(index) {
  chrome.storage.sync.get('prompts', data => {
    const prompts = data.prompts || [];
    prompts.splice(index, 1);
    chrome.storage.sync.set({ prompts }, loadPrompts);
  });
}
  
export function editPrompt(index) {
  chrome.storage.sync.get('prompts', data => {
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
      const emptyStateDiv = document.createElement('div');
      emptyStateDiv.className = 'shortcut-container';
      emptyStateDiv.innerHTML = `
          <h3>Keyboard Navigation & Shortcuts</h3>
          <p style="display: flex; align-items: center; margin: 8px 0;">
              <span style="background-color: #0077B6; color: white; padding: 4px 8px; border-radius: 4px; margin-right: 10px;">
                  Hover/Click
              </span>
              <span>Open prompt list buttons</span>
          </p>
          <p style="display: flex; align-items: center; margin: 8px 0;">
              <span style="background-color: #0077B6; color: white; padding: 4px 8px; border-radius: 4px; margin-right: 10px;">
                  ⌘ or Ctrl + Shift + P
              </span>
              <span>Open / close prompt list</span>
          </p>
          <p style="display: flex; align-items: center; margin: 8px 0;">
              <span style="background-color: #0077B6; color: white; padding: 4px 8px; border-radius: 4px; margin-right: 10px;">↑↓</span>
              <span>Navigate the prompt list</span>
          </p>
          <p style="display: flex; align-items: center; margin: 8px 0;">
              <span style="background-color: #0077B6; color: white; padding: 4px 8px; border-radius: 4px; margin-right: 10px;">Enter</span>
              <span>Select a prompt</span>
          </p>
          <p style="display: flex; align-items: center; margin: 8px 0;">
              <span style="background-color: #0077B6; color: white; padding: 4px 8px; border-radius: 4px; margin-right: 10px;">Esc</span>
              <span>Close the prompt manager</span>
          </p>
      `;
      promptList.appendChild(emptyStateDiv);
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
  

