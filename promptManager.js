import { displayPrompts } from './uiHandler.js';

export function loadPrompts() {
    chrome.storage.sync.get('prompts', data => {
        const prompts = data.prompts || [];
        displayPrompts(prompts);
    });
}

export function addPrompt(title, content) {
    if (!title || !content) return;
    chrome.storage.sync.get('prompts', data => {
        const prompts = data.prompts || [];
        prompts.push({ title, content });
        chrome.storage.sync.set({ prompts }, loadPrompts);
    });
}

export function updatePrompt(index, title, content) {
    chrome.storage.sync.get('prompts', data => {
        const prompts = data.prompts || [];
        if (index >= 0 && index < prompts.length) {
            prompts[index] = { title, content};
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