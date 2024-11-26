// popup.js

import { loadPrompts, addPrompt, updatePrompt } from './prompts.js';
import { exportPrompts, importPrompts } from './importExport.js';
import { initLinks } from './links.js';

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

  // Load prompts and display
  loadPrompts();

  // Add or update prompt
  form.addEventListener('submit', event => {
    event.preventDefault();
    const title = titleInput.value.trim();
    const content = contentInput.value;

    if (promptIndexInput.value === '') {
      // Add new prompt
      addPrompt(title, content);
    } else {
      // Update existing prompt
      const index = parseInt(promptIndexInput.value);
      updatePrompt(index, title, content);
    }

    // Reset form
    titleInput.value = '';
    contentInput.value = '';
    promptIndexInput.value = '';
    submitButton.textContent = 'Add Prompt';
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

  // Initialize external links
  initLinks();
});
