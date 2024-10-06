// importExport.js

import { loadPrompts } from './prompts.js';

export function exportPrompts() {
  chrome.storage.sync.get('prompts', data => {
    const prompts = data.prompts || [];
    const jsonContent = JSON.stringify(prompts, null, 2); // Pretty-print with 2 spaces
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'prompts.json';

    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  });
}

export function importPrompts(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const prompts = JSON.parse(reader.result);
      if (Array.isArray(prompts)) {
        chrome.storage.sync.set({ prompts }, loadPrompts);
      } else {
        console.error('Invalid JSON format');
      }
    } catch (e) {
      console.error('Failed to parse JSON:', e);
    }
  };
  reader.readAsText(file);
}
