// importExport.js

import { loadPrompts } from './prompts.js';

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

export function importPrompts(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const importedPrompts = JSON.parse(reader.result);
      if (Array.isArray(importedPrompts)) {
        chrome.storage.local.get('prompts', data => {
          const existingPrompts = data.prompts || [];
          
          // Create a map of existing prompts by ID
          const existingPromptsMap = new Map(
            existingPrompts.map(p => [p.uuid, p])
          );
          console.log('Existing prompts map:', existingPromptsMap); // Log initial map

          // Merge imported prompts
          importedPrompts.forEach(importedPrompt => {
            console.log('Processing imported prompt:', importedPrompt); // Log each imported prompt
            if (importedPrompt.uuid) {
              if (existingPromptsMap.has(importedPrompt.uuid)) {
                console.log('Found existing prompt with ID:', importedPrompt.uuid); // Log if found
                // Update existing prompt if imported version is newer
                const existing = existingPromptsMap.get(importedPrompt.uuid);
                const existingDate = existing.updatedAt || existing.createdAt;
                const importedDate = importedPrompt.updatedAt || importedPrompt.createdAt;
                console.log('Comparing dates - Existing:', existingDate, 'Imported:', importedDate); // Log dates

                if (new Date(importedDate) > new Date(existingDate)) {
                  console.log('Updating existing prompt with newer version.'); // Log update action
                  existingPromptsMap.set(importedPrompt.uuid, importedPrompt);
                } else {
                  console.log('Keeping existing prompt (it is newer or same age).'); // Log skip action
                }
              } else {
                console.log('Adding new prompt with ID:', importedPrompt.uuid); // Log add action
                // Add new prompt
                existingPromptsMap.set(importedPrompt.uuid, importedPrompt);
              }
            } else {
              console.warn('Imported prompt missing ID:', importedPrompt); // Warn about missing ID
            }
          });

          // Convert map back to array
          const mergedPrompts = Array.from(existingPromptsMap.values());
          console.log('Merged prompts:', mergedPrompts); // Log the final merged array

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

export function exportSyncPrompts() {
  console.log('exportSyncPrompts called'); // Debug line
  chrome.storage.sync.get('prompts', data => {
    console.log('Storage data received:', data); // Debug line
    const prompts = data.prompts || [];
    
    // Check if there are any prompts to export
    if (prompts.length === 0) {
      alert('No prompts found in sync storage.');
      return;
    }

    const jsonContent = JSON.stringify(prompts, null, 2); // Pretty-print with 2 spaces
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'sync_prompts.json';

    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  });
}
