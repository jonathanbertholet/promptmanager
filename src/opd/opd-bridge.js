/**
 * COMMENT: Relays import postMessage to the service worker on the catalog origin.
 * Store builds also accept externally_connectable sendMessage; this bridge covers
 * unpacked installs whose extension id differs from the Web Store id.
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
