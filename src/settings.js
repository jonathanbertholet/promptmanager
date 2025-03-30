import { exportSyncPrompts } from './importExport.js';

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

function deleteAllPrompts() {
  if (confirm('Are you sure you want to delete all prompts? This action cannot be undone.')) {
    chrome.storage.local.set({ prompts: [] }, () => {
      alert('All prompts have been deleted');
    });
  }
}