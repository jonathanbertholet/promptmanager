import { loadPrompts } from './promptManager.js';

export function exportPrompts() {
    chrome.storage.sync.get('prompts', data => {
        const prompts = data.prompts || [];
        let csvContent = 'Title,Content,Folder\n';
        prompts.forEach(prompt => {
            csvContent += `"${prompt.title.replace(/"/g, '""')}","${prompt.content.replace(/"/g, '""')}","${prompt.folder}"\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'prompts.csv';
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
        const csvText = reader.result;
        const lines = csvText.split('\n').slice(1);
        const prompts = lines.reduce((acc, line) => {
            const [title, content, folder] = parseCSVLine(line);
            if (title && content) acc.push({ title, content, folder });
            return acc;
        }, []);
        chrome.storage.sync.set({ prompts }, loadPrompts);
    };
    reader.readAsText(file);
}

function parseCSVLine(line) {
    const regex = /"(.*?)","(.*?)","(.*?)"/;
    const match = line.match(regex);
    return match ? [match[1], match[2], match[3]] : [];
}