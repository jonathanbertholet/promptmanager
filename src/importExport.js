// importExport.js

import { loadPrompts } from './prompts.js';

// Export prompts from local storage as JSON
export function exportPrompts() {
  chrome.storage.local.get('prompts', data => {
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

// Import prompts from a JSON file and merge with local prompts
export function importPrompts(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const importedPrompts = JSON.parse(reader.result);
      if (Array.isArray(importedPrompts)) {
        chrome.storage.local.get('prompts', data => {
          const existingPrompts = data.prompts || [];
          // Create a map of existing prompts by uuid
          const existingPromptsMap = new Map(
            existingPrompts.map(p => [p.uuid, p])
          );
          // Merge imported prompts
          importedPrompts.forEach(importedPrompt => {
            if (importedPrompt.uuid)
              if (existingPromptsMap.has(importedPrompt.uuid)) {
                // Update existing prompt if imported version is newer
                const existing = existingPromptsMap.get(importedPrompt.uuid);
                const existingDate = existing.updatedAt || existing.createdAt;
                const importedDate = importedPrompt.updatedAt || importedPrompt.createdAt;
                if (new Date(importedDate) > new Date(existingDate)) {
                  existingPromptsMap.set(importedPrompt.uuid, importedPrompt);
                }
              } else {
                // Add new prompt
                existingPromptsMap.set(importedPrompt.uuid, importedPrompt);
              }
          });
          // Convert map back to array
          const mergedPrompts = Array.from(existingPromptsMap.values());
          // Save merged prompts
          chrome.storage.local.set({ prompts: mergedPrompts }, loadPrompts);
        });
      } else {
        console.error('Invalid JSON format');
      }
    } catch (e) {
      console.error('Failed to parse JSON:', e);
    }
  };
  reader.readAsText(file);
}
