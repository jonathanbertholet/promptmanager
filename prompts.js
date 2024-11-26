// prompts.js

import { generateUUID } from './utils.js';

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
      prompts.push({ 
        id: generateUUID(),
        title, 
        content,
        createdAt: new Date().toISOString()
      });
      chrome.storage.sync.set({ prompts }, loadPrompts);
    });
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
  

