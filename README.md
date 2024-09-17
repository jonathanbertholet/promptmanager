# ChatGPT Prompt Manager Chrome Extension

ChatGPT Prompt Manager is a Google Chrome extension that enhances the ChatGPT interface by adding a dropdown menu with predefined prompts. You can manage (add, edit, delete) prompts via a popup interface and export/import them in CSV format for easy backup and sharing.

## Features

- **Add Prompts**: Users can add new prompts through the popup interface.
- **Edit Prompts**: Existing prompts can be updated using the popup interface.
- **Delete Prompts**: Prompts can be removed from the list when no longer needed.
- **Dropdown in ChatGPT**: A dropdown menu is injected into the ChatGPT input box to allow easy prompt selection.
- **Export/Import Prompts**: Prompts can be exported to a CSV file and imported from a CSV file for easy backup and sharing.
  
## Installation

### Store link

[Link to chrome web store page](https://chromewebstore.google.com/detail/gmhaghdbihgenofhnmdbglbkbplolain?hl=en-GB&authuser=0)

### Github

1. Clone or download the repository.
2. Open Chrome and go to `chrome://extensions/`.
3. Enable **Developer Mode** (toggle on the top right).
4. Click **Load unpacked** and select the folder where the extension files are located.

## Usage

### Adding and Managing Prompts

1. Click the extension icon next to the Chrome address bar to open the popup.
2. Enter a title and content for your new prompt, then click **Add Prompt**.
3. Existing prompts will appear in the list with options to **Edit** or **Delete** them.
4. If you want to edit a prompt, click **Edit**, update the prompt, and click **Update Prompt**.
5. Click **Cancel** to discard changes and return to add mode.

### Using Prompts in ChatGPT

1. Visit [ChatGPT](https://chatgpt.com/).
2. After the page loads, a dropdown will appear in the input box area.
3. Select a prompt from the dropdown to automatically insert its content into the input box.

### Exporting Prompts

1. In the extension popup, click the **Export Prompts** button.
2. A CSV file containing all your prompts will be downloaded.

### Importing Prompts

1. In the extension popup, click **Import Prompts**.
2. Select the CSV file containing your prompts.
3. The imported prompts will appear in the list and will be available in the dropdown in ChatGPT.

## Permissions

The extension requires the following permissions:

- **storage**: To store the list of prompts and synchronize them across devices.
- **downloads**: To handle exporting prompts as a CSV file.
- **tabs**: For links to open in a new tab (github, donation link) 

## Issues

If you find any bugs or have suggestions for new features, feel free to submit an issue or reach out at `bejo@odoo.com`.

## Accreditations

App icon : 
Prompt by Rikas Dzihab from <a href="https://thenounproject.com/browse/icons/term/prompt/" target="_blank" title="Prompt Icons">Noun Project</a> (CC BY 3.0)
