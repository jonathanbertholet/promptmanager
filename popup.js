<!DOCTYPE html>
<html>
<head>
  <title>Simple Prompt Manager</title>
  <link rel="stylesheet" href="styles.css">
  <meta charset="UTF-8">
</head>
<body>
  <div class="title">
    <img class="icon" src="icon128.png" alt="Extension Icon" style="width: 22px; height: 22px; margin-bottom: 15px;">
    <h2>Simple Prompt Manager</h2>
  </div>
  <form id="prompt-form">
    <input type="hidden" id="prompt-index">
    <input type="text" id="prompt-title" placeholder="Name" required><br>
    <textarea id="prompt-content" placeholder="Prompt" required></textarea><br>
    <button class="main" type="submit" id="submit-button" style="vertical-align: middle; display: flex; justify-content: center; align-items: center;">
      <img src="icons/add-icon.png" alt="Add" style="width: 16px; height: 16px; vertical-align: middle; margin-right: 5px;">
      Save prompt
    </button>
    <button type="button" id="cancel-edit-button" style="display: none;">Cancel</button>
  </form>

  <div class="prompts-container">
    <div class="prompts-section">
      <ul id="prompt-list"></ul>
    </div>
  </div>

  <table class="dataimpexp" style="width: 100%;">
    <tr>
      <td>
        <button class="main" id="export-btn">Export prompts</button>
      </td>
      <td>
        <input type="file" id="import-file" accept=".json" hidden>
        <button class="main" id="import-btn">Import prompts</button>
      </td>
    </tr>
  </table>
  <p></p>
  <script type="module" src="popup.js"></script>
  <table class="footer-table" style="width: 100%;">
    <tr>
      <td>
        <div class="link-container">
          <a id="link" href="https://chatgpt.com" target="_blank"><img src="icons/chatgpt-icon.png" alt="ChatGPT" style="width: 16px; height: 16px; vertical-align: middle;"></a>
          <a id="link" href="https://claude.ai/new" target="_blank"><img src="icons/claude-icon.png" alt="Claude" style="width: 16px; height: 16px; vertical-align: middle;"></a>
          <a id="link" href="https://notebooklm.google.com" target="_blank"><img src="icons/notebooklm-icon.png" alt="NotebookLM" style="width: 16px; height: 16px; vertical-align: middle;"></a>
          <a id="link" href="https://gemini.google.com" target="_blank"><img src="icons/gemini-icon.png" alt="Gemini" style="width: 16px; height: 16px; vertical-align: middle;"></a>
          <a id="link" href="https://poe.com" target="_blank"><img src="icons/poe-icon.png" alt="Poe" style="width: 16px; height: 16px; vertical-align: middle;"></a>
        </div>
      </td>
      <td style="text-align: right;">
        <a id="link" href="https://github.com/jonathanbertholet/promptmanager" target="_blank"><img src="icons/github-icon.png" alt="Github" style="width: 16px; height: 16px; vertical-align: middle; margin-right: 5px;"></a>
        <a id="link" href="https://chromewebstore.google.com/detail/simple-prompt-manager-cha/gmhaghdbihgenofhnmdbglbkbplolain?authuser=0&hl=en-GB" target="_blank"><img src="icons/review-icon.png" alt="Review me" style="width: 16px; height: 16px; vertical-align: middle; margin-right: 5px;"></a>
        <!-- <a href="settings.html"><img src="settings-icon.png" alt="Settings" style="width: 16px; height: 16px; vertical-align: middle;"></a> -->

      </td>
    </tr>
  </table>
</body>
</html>
