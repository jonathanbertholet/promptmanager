// importExport.js

// COMMENT: Use unified prompt storage; remove dependency on prompts.js
import * as PromptStorage from './storage/promptStorage.js';

// Export prompts from local storage as JSON
export async function exportPrompts() {
  // Unified manager handles download & formatting
  await PromptStorage.exportPrompts();
}

// Import prompts from a JSON file and merge with local prompts
export async function importPrompts(file) {
  // COMMENT: Delegate to unified manager; callers should re-render via onPromptsChanged
  return PromptStorage.importPrompts(file);
}
