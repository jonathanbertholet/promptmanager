// Catalog bridge for Firefox and unpacked Chrome builds. Safe to inject repeatedly.
(() => {
  if (window.__OPM_CATALOG_BRIDGE__) return;
  const allowed = new Set(['https://openpromptdatabase.com', 'https://www.openpromptdatabase.com']);
  if (!allowed.has(location.origin)) return;
  window.__OPM_CATALOG_BRIDGE__ = true;

  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin) return;
    const { type, requestId, prompt } = event.data || {};
    if (type !== 'OPD_REQUEST_IMPORT' || typeof requestId !== 'string' || !prompt) return;
    OPMApi.runtime.sendMessage({ type: 'OPD_IMPORT_PROMPT', prompt }, response => {
      const lastError = OPMApi.runtime.lastError?.message;
      window.postMessage({
        type: 'OPD_IMPORT_RESULT', requestId,
        ok: !lastError && Boolean(response?.ok),
        error: lastError || response?.error || null,
        response: response || null,
      }, location.origin);
    });
  });

  const announce = () => {
    document.documentElement.dataset.opmBridge = '1';
    window.dispatchEvent(new Event('opm-bridge-ready'));
  };
  if (document.documentElement) announce();
  else document.addEventListener('DOMContentLoaded', announce, { once: true });
})();
