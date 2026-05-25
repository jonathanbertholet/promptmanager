/**
 * COMMENT: Runs on Open Prompt Database pages. Relays import requests from the
 * page (postMessage) to this extension’s service worker — works for unpacked dev
 * builds and Chrome Web Store installs (no fixed extension id on the page).
 */
const OPD_REQUEST_IMPORT = 'OPD_REQUEST_IMPORT';
const OPD_IMPORT_RESULT = 'OPD_IMPORT_RESULT';

window.addEventListener('message', (event) => {
  if (event.source !== window || !event.data || event.data.type !== OPD_REQUEST_IMPORT) {
    return;
  }

  const { requestId, prompt } = event.data;
  if (!requestId || !prompt) return;

  chrome.runtime.sendMessage({ type: 'OPD_IMPORT_PROMPT', prompt }, (response) => {
    const lastError = chrome.runtime.lastError?.message;
    window.postMessage(
      {
        type: OPD_IMPORT_RESULT,
        requestId,
        ok: !lastError && !!response?.ok,
        error: lastError || response?.error || null,
        response: response || null,
      },
      '*'
    );
  });
});

// COMMENT: Page scripts detect the bridge without needing chrome.* in page context.
document.documentElement.dataset.opmBridge = '1';
