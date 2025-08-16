// sidepanel.js

// COMMENT: Use unified prompt storage for all prompt operations
import * as PromptStorage from '../promptStorage.js';
import { exportPrompts, importPrompts } from '../importExport.js';

// COMMENT: Helper to check if any provider permissions are granted
async function hasAnyGrantedProviderPermission() {
  return new Promise(resolve => {
    try {
      chrome.storage.local.get(['aiProvidersMap'], result => {
        if (!result || !result.aiProvidersMap) {
          resolve(false);
          return;
        }
        const providersMap = result.aiProvidersMap;
        const anyGranted = Object.values(providersMap).some(p => p && p.hasPermission === 'Yes');
        resolve(anyGranted);
      });
    } catch (err) {
      resolve(false);
    }
  });
}

// COMMENT: Toggle visibility between permissions shortcut and prompt list based on granted permissions
async function renderPermissionsGate() {
  const shortcut = document.getElementById('permissions-shortcut');
  const promptList = document.getElementById('prompt-list');
  const emptyState = document.getElementById('empty-state');
  if (!shortcut || !promptList) return;
  const allowed = await hasAnyGrantedProviderPermission();
  if (allowed) {
    // Hide shortcut, show list normally
    shortcut.style.display = 'none';
    promptList.style.display = 'block';
    if (emptyState && promptList.children.length === 0) {
      emptyState.style.display = 'block';
    }
  } else {
    // Show shortcut, hide list and empty state
    shortcut.style.display = 'block';
    promptList.style.display = 'none';
    if (emptyState) emptyState.style.display = 'none';
  }
}

// COMMENT: Render the list of prompts in the sidepanel UI
function displayPrompts(prompts) {
  const promptList = document.getElementById('prompt-list');
  const emptyState = document.getElementById('empty-state');
  const shortcut = document.getElementById('permissions-shortcut');
  promptList.innerHTML = '';
  if (!Array.isArray(prompts) || prompts.length === 0) {
    // If permissions shortcut is visible, prefer it over empty-state
    const shortcutVisible = shortcut && shortcut.style.display !== 'none';
    if (emptyState) emptyState.style.display = shortcutVisible ? 'none' : 'block';
    return;
  }
  if (emptyState) emptyState.style.display = 'none';
  prompts.forEach((prompt, index) => {
    const li = document.createElement('li');
    const titleSpan = document.createElement('span');
    titleSpan.textContent = prompt.title;
    titleSpan.style.margin = '2px';
    titleSpan.style.padding = '3px';
    titleSpan.style.verticalAlign = 'middle';
    titleSpan.style.display = 'inline-block';
    li.appendChild(titleSpan);

    // COMMENT: Copy button (revealed on hover)
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
    copyBtn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(prompt.content);
    });
    li.appendChild(copyBtn);

    // COMMENT: Edit button (revealed on hover)
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
      // COMMENT: Populate the form for editing
      document.getElementById('prompt-title').value = prompt.title;
      document.getElementById('prompt-content').value = prompt.content;
      document.getElementById('prompt-index').value = index;
      document.getElementById('submit-button').textContent = 'Update';
      document.getElementById('cancel-edit-button').style.display = 'inline';
    });
    li.appendChild(editBtn);

    // COMMENT: Delete button (revealed on hover)
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
    delBtn.addEventListener('click', async () => {
      if (!window.confirm('Are you sure you want to delete this prompt?')) return;
      const current = await PromptStorage.getPrompts();
      if (index < 0 || index >= current.length) return;
      await PromptStorage.deletePrompt(current[index].uuid);
    });
    li.appendChild(delBtn);

    // COMMENT: Hover interactions for action buttons
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

    document.getElementById('prompt-list').appendChild(li);
  });
}

// COMMENT: Load prompts from storage and render them
async function loadPrompts() {
  const prompts = await PromptStorage.getPrompts();
  displayPrompts(prompts);
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('prompt-form');
  const titleInput = document.getElementById('prompt-title');
  const contentInput = document.getElementById('prompt-content');
  const promptIndexInput = document.getElementById('prompt-index');
  const submitButton = document.getElementById('submit-button');
  const cancelEditButton = document.getElementById('cancel-edit-button');
  const exportBtn = document.getElementById('export-btn');
  const importBtn = document.getElementById('import-btn');
  const importFile = document.getElementById('import-file');
  // COMMENT: Info banner elements for close/dismiss behavior
  const infoBanner = document.getElementById('info-banner');
  const infoBannerClose = document.getElementById('info-banner-close');

  // Load prompts and display
  loadPrompts();
  // COMMENT: Evaluate permissions gate on load
  renderPermissionsGate();

  // COMMENT: Refresh UI whenever prompts change in storage
  PromptStorage.onPromptsChanged(loadPrompts);

  // COMMENT: React to permissions updates live (permissions page writes aiProvidersMap)
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.aiProvidersMap) {
        renderPermissionsGate();
      }
    });
  } catch (err) {
    // Ignore if not available
  }

  // COMMENT: Restore banner visibility from localStorage (persist dismissal)
  try {
    const dismissed = localStorage.getItem('spm_info_banner_dismissed');
    if (dismissed === 'true' && infoBanner) {
      infoBanner.style.display = 'none';
    }
  } catch (err) {
    // Swallow storage access issues, banner will show by default
  }

  // COMMENT: Close banner and persist choice
  if (infoBannerClose) {
    infoBannerClose.addEventListener('click', () => {
      if (infoBanner) infoBanner.style.display = 'none';
      try {
        localStorage.setItem('spm_info_banner_dismissed', 'true');
      } catch (err) {
        // Ignore storage errors
      }
    });
  }

  // Add or update prompt
  form.addEventListener('submit', event => {
    event.preventDefault();
    const title = titleInput.value.trim();
    const content = contentInput.value;

    if (promptIndexInput.value === '') {
      // COMMENT: Add new prompt via unified manager
      PromptStorage.savePrompt({ title, content }).catch(console.error);
    } else {
      // COMMENT: Update existing prompt by mapping index to uuid via unified manager
      const index = parseInt(promptIndexInput.value, 10);
      PromptStorage.getPrompts().then(prompts => {
        if (index >= 0 && index < prompts.length) {
          const uuid = prompts[index].uuid;
          return PromptStorage.updatePrompt(uuid, { title, content });
        }
      }).catch(console.error);
    }

    // Reset form
    titleInput.value = '';
    contentInput.value = '';
    promptIndexInput.value = '';
    submitButton.textContent = 'Save prompt';
    cancelEditButton.style.display = 'none';
  });

  // Cancel edit
  cancelEditButton.addEventListener('click', () => {
    // Reset form
    titleInput.value = '';
    contentInput.value = '';
    promptIndexInput.value = '';
    submitButton.textContent = 'Add Prompt';
    cancelEditButton.style.display = 'none';
  });

  // Export prompts
  exportBtn.addEventListener('click', exportPrompts);

  // Import prompts
  importBtn.addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', event => {
    const file = event.target.files[0];
    if (file) importPrompts(file);
  });
});
