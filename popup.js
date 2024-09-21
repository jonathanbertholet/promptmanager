import { loadPrompts, addPrompt, updatePrompt } from './promptManager.js';
import { exportPrompts, importPrompts } from './csvHandler.js';
import { displayPrompts, resetForm } from './uiHandler.js';

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('prompt-form');
    const exportBtn = document.getElementById('export-btn');
    const importBtn = document.getElementById('import-btn');
    const importFile = document.getElementById('import-file');

    loadPrompts();

    form.addEventListener('submit', handleFormSubmit);
    document.getElementById('cancel-edit-button').addEventListener('click', resetForm);
    exportBtn.addEventListener('click', exportPrompts);
    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', handleFileImport);
});

function handleFormSubmit(event) {
    event.preventDefault();
    const title = document.getElementById('prompt-title').value.trim();
    const content = document.getElementById('prompt-content').value.trim();
    const index = document.getElementById('prompt-index').value;

    if (index === '') {
        addPrompt(title, content);
    } else {
        updatePrompt(parseInt(index), title, content);
    }

    resetForm();
}

function handleFileImport(event) {
    const file = event.target.files[0];
    if (file) importPrompts(file);
}