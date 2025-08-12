import { exportSyncPrompts } from './importExport.js';
import { setPrompts } from './promptStorage.js'; // COMMENT: Use unified manager for destructive ops

console.log('settings.js loaded'); // Debug line

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM Content Loaded'); // Debug line
  const exportButton = document.getElementById('export-sync-prompts');
  console.log('Export button found:', exportButton); // Debug line

  exportButton.addEventListener('click', () => {
    console.log('Export button clicked'); // Debug line
    exportSyncPrompts();
  });
});

document.getElementById('delete-all-prompts').addEventListener('click', deleteAllPrompts);

async function deleteAllPrompts() {
  // COMMENT: Use unified prompt storage to clear all prompts (canonical + legacy mirrored)
  if (confirm('Are you sure you want to delete all prompts? This action cannot be undone.')) {
    await setPrompts([]);
    alert('All prompts have been deleted');
  }
}