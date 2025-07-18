// prompts.js

import { generateUUID } from './utils.js';

// Define the current storage version
const PROMPT_STORAGE_VERSION = 1;

// Helper: Normalize a single prompt object to the canonical format
function normalizePromptObject(prompt) {
  // Accepts any object, returns a normalized prompt
  const normalized = {};
  // Prefer uuid, fallback to id, otherwise generate
  normalized.uuid = prompt.uuid || prompt.id || generateUUID();
  // Title/content fallback to empty string if missing
  normalized.title = typeof prompt.title === 'string' ? prompt.title : '';
  normalized.content = typeof prompt.content === 'string' ? prompt.content : '';
  // Dates: try to preserve, else set to now
  normalized.createdAt = prompt.createdAt || new Date().toISOString();
  if (prompt.updatedAt) normalized.updatedAt = prompt.updatedAt;
  // Add any other fields as needed (future-proofing)
  return normalized;
}

// Helper: Normalize an array of prompts
function normalizePromptArray(prompts) {
  if (!Array.isArray(prompts)) return [];
  return prompts.map(normalizePromptObject);
}

// Helper: Get the full prompt storage object (with version)
async function getPromptStorage() {
  const data = await chrome.storage.local.get('prompts_storage');
  if (data.prompts_storage && typeof data.prompts_storage === 'object') {
    // If version is missing, treat as legacy, upgrade below
    return data.prompts_storage;
  }
  // Legacy: try to load 'prompts' array
  const legacy = await chrome.storage.local.get('prompts');
  if (Array.isArray(legacy.prompts)) {
    return {
      version: 0,
      prompts: normalizePromptArray(legacy.prompts)
    };
  }
  // Nothing found
  return { version: PROMPT_STORAGE_VERSION, prompts: [] };
}

// Helper: Save the full prompt storage object (with version)
async function setPromptStorage(storageObj) {
  // Only allow writing if version matches current
  if (storageObj.version !== PROMPT_STORAGE_VERSION) {
    throw new Error('Prompt storage version mismatch. Refusing to overwrite.');
  }
  await chrome.storage.local.set({ prompts_storage: storageObj });
  // QUICK FIX: Also update legacy 'prompts' array for content.js compatibility
  await chrome.storage.local.set({ prompts: storageObj.prompts });
}

// Add a prompt to local storage (robust, versioned)
export async function addPrompt(title, content) {
  if (!title || !content) return;
  try {
    // Always normalize/upgrade storage before proceeding
    let prompts = await normalizePromptFormat();
    // Get the latest storage object
    let storage = await getPromptStorage();
    // If storage version is not current, upgrade in-place
    if (storage.version !== PROMPT_STORAGE_VERSION) {
      storage = { version: PROMPT_STORAGE_VERSION, prompts };
      await setPromptStorage(storage);
    }
    const prompt = normalizePromptObject({ title, content });
    storage.prompts.push(prompt);
    await setPromptStorage(storage);
    document.getElementById('prompt-title').value = '';
    document.getElementById('prompt-content').value = '';
    loadPrompts();
  } catch (error) {
    console.error('Error saving prompt:', error);
  }
}

// Update an existing prompt by index (robust, versioned)
export function updatePrompt(index, title, content) {
  // Always normalize/upgrade storage before proceeding
  normalizePromptFormat().then(prompts => {
    getPromptStorage().then(async storage => {
      // If storage version is not current, upgrade in-place
      if (storage.version !== PROMPT_STORAGE_VERSION) {
        storage = { version: PROMPT_STORAGE_VERSION, prompts };
        await setPromptStorage(storage);
      }
      const promptsArr = storage.prompts;
      if (index >= 0 && index < promptsArr.length) {
        const updated = normalizePromptObject({
          ...promptsArr[index],
          title,
          content,
          updatedAt: new Date().toISOString()
        });
        promptsArr[index] = updated;
        setPromptStorage(storage).then(loadPrompts);
      }
    });
  });
}

// Delete a prompt by index (robust, versioned)
export function deletePrompt(index) {
  if (window.confirm('Are you sure you want to delete this prompt?')) {
    // Always normalize/upgrade storage before proceeding
    normalizePromptFormat().then(prompts => {
      getPromptStorage().then(async storage => {
        // If storage version is not current, upgrade in-place
        if (storage.version !== PROMPT_STORAGE_VERSION) {
          storage = { version: PROMPT_STORAGE_VERSION, prompts };
          await setPromptStorage(storage);
        }
        const promptsArr = storage.prompts;
        promptsArr.splice(index, 1);
        setPromptStorage(storage).then(loadPrompts);
      });
    });
  }
}

// Edit a prompt by index (populate form fields, robust)
export function editPrompt(index) {
  getPromptStorage().then(storage => {
    const prompts = storage.prompts;
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
  }, 180);
}

// Copy prompt content to clipboard (robust)
export function copyToClipboard(index) {
  getPromptStorage().then(storage => {
    const prompts = storage.prompts;
    if (index >= 0 && index < prompts.length) {
      const prompt = prompts[index];
      navigator.clipboard.writeText(prompt.content)
        .then(() => {
          const promptList = document.getElementById('prompt-list');
          if (promptList && promptList.children[index]) {
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

// Display prompts in the UI (robust)
export function displayPrompts(prompts) {
  const promptList = document.getElementById('prompt-list');
  const emptyState = document.getElementById('empty-state');
  promptList.innerHTML = '';
  if (prompts.length === 0) {
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
    copyBtn.style.backgroundColor = '#ffffff00';
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
    editBtn.style.backgroundColor = '#ffffff00';
    editBtn.appendChild(editImg);
    editBtn.addEventListener('click', () => {
      editPrompt(index);
    });
    li.appendChild(editBtn);
    const delBtn = document.createElement('button');
    const delImg = document.createElement('img');
    delImg.src = '../icons/delete.svg';
    delImg.alt = 'Delete';
    delImg.title = 'Delete';
    delImg.width = 18;
    delImg.height = 18;
    delImg.style.verticalAlign = 'middle';
    delBtn.style.display = 'none';
    delBtn.style.backgroundColor = '#ffffff00';
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

// Normalize prompt format and upgrade storage if needed
export async function normalizePromptFormat() {
  try {
    let storage = await getPromptStorage();
    let needsUpdate = false;
    // If legacy or missing version, upgrade to versioned format
    if (typeof storage.version !== 'number' || !Array.isArray(storage.prompts)) {
      storage = { version: PROMPT_STORAGE_VERSION, prompts: normalizePromptArray(storage.prompts || []) };
      needsUpdate = true;
    } else {
      // Always normalize all prompts
      const normalizedPrompts = normalizePromptArray(storage.prompts);
      if (JSON.stringify(normalizedPrompts) !== JSON.stringify(storage.prompts)) {
        storage.prompts = normalizedPrompts;
        needsUpdate = true;
      }
    }
    if (needsUpdate) {
      await setPromptStorage(storage);
      console.log('Normalized and upgraded prompt storage format.');
    }
    return storage.prompts;
  } catch (error) {
    console.error('Error normalizing prompt format:', error);
    return [];
  }
}

// Load prompts from local storage and display them
export function loadPrompts() {
  normalizePromptFormat().then(prompts => {
    displayPrompts(prompts);
  });
}


