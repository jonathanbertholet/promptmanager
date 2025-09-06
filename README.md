# Open Prompt Manager

A lightweight Chrome extension for managing prompts across multiple AI chatbots including ChatGPT, Claude, Gemini, NotebookLM, Deepseek,Copilot, Grok, and Poe.

## Features

- 🚀 Save, edit and organize your favorite prompts
- Advanced organization using tags
- 🔍 Quick search functionality & keyboard navigation
- 💾 Import/Export prompts for sharing
- 🌓 Supports both light and dark modes
- 🔄 Variable support with `#variable#` syntax
- 🎯 Works with multiple AI platforms:
  <!--
    The previous list of supported platforms was not formatted as a valid Markdown table.
    Below is a properly formatted Markdown table for better rendering.
  -->
  | ChatGPT    | Claude     | Google Gemini |
  |------------|------------|---------------|
  | NotebookLM | Deepseek   | Copilot       |
  | Grok       | Poe        | Qwen          |
  | Perplexity | Kimi       | Mistral       |
  | Abacus     | OpenRouter |               |


## Installation

1. Install from the [Chrome Web Store](https://chromewebstore.google.com/detail/open-prompt-manager/gmhaghdbihgenofhnmdbglbkbplolain)
2. Use permissions to grant access to the LLMs you want.

### Keyboard Shortcuts

- **⌘ + Shift + P** (Mac) or **Ctrl + M** (Windows/Linux): Open/close prompt list
- **↑/↓**: Navigate through prompts
- **Enter**: Select a prompt
- **Esc**: Close the prompt manager

## Testing

This project includes automated tests using **Puppeteer** and **Jest**. For more advanced testing, refer to the [Puppeteer API documentation](https://pptr.dev/).

For detailed instructions on how to run and debug tests, see the [Testing Guide](TESTING.md).

## Privacy

- All prompts are stored locally in your browser
- No data is sent to external servers
- Your prompts are saved in local storage for maximum capacity

## License

This project is open source and available under the MIT License.

## Attributions

### Contributing members :

- Thanks to Hexodus for identifying a bug & helping me resolve it
- Thanks to Abdallahheidar for his ideas, contributions, and teamwork on this project!
- Thanks to HideMaru for the nice icon!

<a href="https://www.flaticon.com/free-icons/chatbot" title="chatbot icons">Chatbot icons created by HideMaru - Flaticon</a>
