/**
 * COMMENT: Runs on local OPD dev (localhost). Relays import postMessage to the
 * service worker — needed for unpacked builds whose id differs from the store id.
 * Production catalog uses externally_connectable + chrome.runtime.sendMessage (no
 * content script on openpromptdatabase.com) so store updates avoid new host access.
 */
const OPD_REQUEST_IMPORT = 'OPD_REQUEST_IMPORT';
const OPD_IMPORT_RESULT = 'OPD_IMPORT_RESULT';

const browserAPI = globalThis.browser ?? globalThis.chrome;

window.addEventListener('message', (event) => {
  if (event.source !== window || !event.data || event.data.type !== OPD_REQUEST_IMPORT) {
    return;
  }

  const { requestId, prompt } = event.data;
  if (!requestId || !prompt) return;

  browserAPI.runtime.sendMessage({ type: 'OPD_IMPORT_PROMPT', prompt }, (response) => {
    const lastError = browserAPI.runtime.lastError?.message;
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
