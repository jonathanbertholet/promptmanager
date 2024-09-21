import { editPrompt, deletePrompt } from './promptManager.js';

export function displayPrompts(prompts) {
    const promptList = document.getElementById('prompt-list');
    promptList.innerHTML = '';
    prompts.forEach((prompt, index) => {
        const li = document.createElement('li');
        
        const titleSpan = document.createElement('span');
        titleSpan.textContent = `${prompt.title} (${prompt.folder})`;
        li.appendChild(titleSpan);

        const editBtn = document.createElement('button');
        editBtn.textContent = '✏️ Edit';
        editBtn.addEventListener('click', () => editPrompt(index));
        li.appendChild(editBtn);

        const delBtn = document.createElement('button');
        delBtn.textContent = 'Delete';
        delBtn.addEventListener('click', () => deletePrompt(index));
        li.appendChild(delBtn);

        promptList.appendChild(li);
    });
}

export function resetForm() {
    document.getElementById('prompt-title').value = '';
    document.getElementById('prompt-content').value = '';
    document.getElementById('folder-select').value = '';
    document.getElementById('prompt-index').value = '';
    document.getElementById('submit-button').textContent = 'Add Prompt';
    document.getElementById('cancel-edit-button').style.display = 'none';
}