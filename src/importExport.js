// importExport.js

import { loadPrompts } from './prompts.js';
import * as PromptStorage from './promptStorage.js';

// Export prompts from local storage as JSON
export async function exportPrompts() {
  // Unified manager handles download & formatting
  await PromptStorage.exportPrompts();
}

// Import prompts from a JSON file and merge with local prompts
export function importPrompts(file) {
  // Delegate to unified manager then refresh UI on completion
  PromptStorage.importPrompts(file)
    .then(loadPrompts)
    .catch(err => console.error('Import failed:', err));
}
