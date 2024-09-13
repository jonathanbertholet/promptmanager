// popup.js

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('prompt-form');
    const titleInput = document.getElementById('prompt-title');
    const contentInput = document.getElementById('prompt-content');
    const promptList = document.getElementById('prompt-list');
    const exportBtn = document.getElementById('export-btn');
    const importBtn = document.getElementById('import-btn');
    const importFile = document.getElementById('import-file');
    const promptIndexInput = document.getElementById('prompt-index');
    const submitButton = document.getElementById('submit-button');
    const cancelEditButton = document.getElementById('cancel-edit-button');
  
    // Load prompts and display
    loadPrompts();
  
    // Add or update prompt
    form.addEventListener('submit', event => {
      event.preventDefault();
      const title = titleInput.value.trim();
      const content = contentInput.value.trim();
  
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
  });
  
  // Functions to manage prompts
  function loadPrompts() {
    chrome.storage.sync.get('prompts', data => {
      const prompts = data.prompts || [];
      displayPrompts(prompts);
    });
  }
  
  function addPrompt(title, content) {
    if (!title || !content) return;
    chrome.storage.sync.get('prompts', data => {
      const prompts = data.prompts || [];
      prompts.push({ title, content });
      chrome.storage.sync.set({ prompts }, loadPrompts);
    });
  }
  
  function updatePrompt(index, title, content) {
    chrome.storage.sync.get('prompts', data => {
      const prompts = data.prompts || [];
      if (index >= 0 && index < prompts.length) {
        prompts[index] = { title, content };
        chrome.storage.sync.set({ prompts }, loadPrompts);
      }
    });
  }
  
  function deletePrompt(index) {
    chrome.storage.sync.get('prompts', data => {
      const prompts = data.prompts || [];
      prompts.splice(index, 1);
      chrome.storage.sync.set({ prompts }, loadPrompts);
    });
  }
  
  function editPrompt(index) {
    chrome.storage.sync.get('prompts', data => {
      const prompts = data.prompts || [];
      if (index >= 0 && index < prompts.length) {
        const prompt = prompts[index];
        document.getElementById('prompt-title').value = prompt.title;
        document.getElementById('prompt-content').value = prompt.content;
        document.getElementById('prompt-index').value = index;
        document.getElementById('submit-button').textContent = 'Update Prompt';
        document.getElementById('cancel-edit-button').style.display = 'inline';
      }
    });
  }
  
  function displayPrompts(prompts) {
    const promptList = document.getElementById('prompt-list');
    promptList.innerHTML = '';
    prompts.forEach((prompt, index) => {
      const li = document.createElement('li');
  
      const titleSpan = document.createElement('span');
      titleSpan.textContent = prompt.title;
      li.appendChild(titleSpan);
  
      const editBtn = document.createElement('button');
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => editPrompt(index));
      li.appendChild(editBtn);
  
      const delBtn = document.createElement('button');
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', () => deletePrompt(index));
      li.appendChild(delBtn);
  
      promptList.appendChild(li);
    });
  }
  
  // Export prompts to CSV
  function exportPrompts() {
    chrome.storage.sync.get('prompts', data => {
      const prompts = data.prompts || [];
      let csvContent = 'Title,Content\n';
      prompts.forEach(prompt => {
        csvContent += `"${prompt.title.replace(/"/g, '""')}","${prompt.content.replace(/"/g, '""')}"\n`;
      });
  
      // Create a Blob with the correct MIME type and character encoding
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
  
      // Create a temporary anchor element to trigger the download
      const a = document.createElement('a');
      a.href = url;
      a.download = 'prompts.csv';
  
      // Append the anchor to the document and trigger a click
      document.body.appendChild(a);
      a.click();
  
      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 0);
    });
  }
    
  // Import prompts from CSV
  function importPrompts(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const csvText = reader.result;
      const lines = csvText.split('\n').slice(1); // Skip header
      const prompts = lines.reduce((acc, line) => {
        const [title, content] = parseCSVLine(line);
        if (title && content) acc.push({ title, content });
        return acc;
      }, []);
      chrome.storage.sync.set({ prompts }, loadPrompts);
    };
    reader.readAsText(file);
  }
  
  // Simple CSV parser
  function parseCSVLine(line) {
    const regex = /"(.*?)","(.*?)"/;
    const match = line.match(regex);
    return match ? [match[1], match[2]] : [];
  }
