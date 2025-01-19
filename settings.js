document.getElementById('delete-all-prompts').addEventListener('click', deleteAllPrompts);

function deleteAllPrompts() {
    if (confirm('Are you sure you want to delete all prompts? This action cannot be undone.')) {
        chrome.storage.sync.set({ prompts: [] }, () => {
            alert('All prompts have been deleted');
        });
    }
} 