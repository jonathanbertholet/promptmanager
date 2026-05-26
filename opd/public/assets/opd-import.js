/**
 * Import catalog prompts into Open Prompt Manager.
 * Store builds: externally_connectable + sendMessage (no extra site permission).
 * Local dev: content-script bridge on localhost when unpacked id ≠ store id.
 */
import { apiGet } from './opd-common.js';

/** Chrome Web Store extension id — used for sendMessage on production catalog pages. */
export const OPM_EXTENSION_ID = 'gmhaghdbihgenofhnmdbglbkbplolain';

export const CHROME_STORE_URL = `https://chromewebstore.google.com/detail/open-prompt-manager/${OPM_EXTENSION_ID}`;

const OPD_REQUEST_IMPORT = 'OPD_REQUEST_IMPORT';
const OPD_IMPORT_RESULT = 'OPD_IMPORT_RESULT';
const BRIDGE_WAIT_MS = 5000;

/**
 * @typedef {'imported'|'already'|'updated'} OpdImportStatus
 * @typedef {'ok'|'already'|'updated'|'no_extension'|'error'} OpdImportResult
 */

/**
 * Normalize API prompt for OPD_IMPORT_PROMPT payload.
 * @param {object} p
 */
export function promptForImport(p) {
  return {
    id: p.id,
    title: p.title,
    content: p.content,
    tags: Array.isArray(p.tags) ? p.tags : [],
    author: p.author,
    publishedAt: p.publishedAt,
  };
}

/**
 * Stable library uuid used by OPM for this catalog row (opd:{id}).
 * @param {string} catalogId
 */
export function catalogLocalUuid(catalogId) {
  return `opd:${String(catalogId || '').trim()}`;
}

/**
 * Map extension response to site UI result.
 * @param {object | null | undefined} response
 * @returns {OpdImportResult}
 */
export function mapOpdImportResponse(response) {
  if (!response?.ok) {
    return 'error';
  }
  const status = response.status;
  if (status === 'already') {
    return 'already';
  }
  if (status === 'updated') {
    return 'updated';
  }
  return 'ok';
}

/**
 * List/card API returns snippet only — fetch full body before import.
 * @param {object} prompt
 */
export async function resolvePromptForImport(prompt) {
  if (!prompt?.id) {
    throw new Error('missing_prompt_id');
  }
  if (typeof prompt.content === 'string' && prompt.content.length > 0) {
    return prompt;
  }
  const { prompt: full } = await apiGet(`/prompts/${encodeURIComponent(prompt.id)}`);
  return full;
}

/** True when opd-bridge.js is injected (local dev). */
function isOpmBridgePresent() {
  return document.documentElement?.dataset?.opmBridge === '1';
}

/**
 * Import via OPM content script on this page (localhost dev / unpacked builds).
 * @param {object} payload — { type, prompt }
 * @returns {Promise<OpdImportResult | null>} null = bridge not available / timed out
 */
function importViaOpmBridge(payload) {
  return new Promise((resolve) => {
    const requestId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `opd-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const timeout = window.setTimeout(() => {
      window.removeEventListener('message', onResult);
      resolve(null);
    }, BRIDGE_WAIT_MS);

    function onResult(event) {
      if (event.source !== window || !event.data || event.data.type !== OPD_IMPORT_RESULT) {
        return;
      }
      if (event.data.requestId !== requestId) return;

      window.clearTimeout(timeout);
      window.removeEventListener('message', onResult);

      if (!event.data.ok) {
        resolve('error');
        return;
      }
      resolve(mapOpdImportResponse(event.data.response));
    }

    window.addEventListener('message', onResult);
    window.postMessage(
      {
        type: OPD_REQUEST_IMPORT,
        requestId,
        prompt: payload.prompt,
      },
      '*'
    );
  });
}

/**
 * Check whether the store-listed extension answers on this page (externally_connectable).
 * @returns {Promise<boolean>}
 */
export function canReachStoreExtension() {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      resolve(false);
      return;
    }
    chrome.runtime.sendMessage(OPM_EXTENSION_ID, { type: 'OPD_PING' }, (response) => {
      resolve(!chrome.runtime.lastError && response?.ok === true);
    });
  });
}

/**
 * Primary path for production: message the store extension (externally_connectable).
 * Requires Web Store build 2.9+ with onMessageExternal; dev/unpacked builds need the bridge.
 * @param {object} payload
 * @returns {Promise<OpdImportResult | 'no_extension'>}
 */
function importViaExternalMessage(payload) {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      resolve('no_extension');
      return;
    }

    chrome.runtime.sendMessage(OPM_EXTENSION_ID, payload, (response) => {
      if (chrome.runtime.lastError) {
        resolve('no_extension');
        return;
      }
      resolve(mapOpdImportResponse(response));
    });
  });
}

/** User-facing hint when import cannot reach the extension. */
export function opmImportHelpMessage() {
  if (isOpmBridgePresent()) {
    return '';
  }
  return (
    'Install Open Prompt Manager from the Chrome Web Store, or open the extension → Settings → ' +
    '“Enable catalog import on openpromptdatabase.com”, then reload this page.'
  );
}

/**
 * Request import via extension; opens Chrome Web Store only if OPM is not installed.
 * @param {object} prompt — list item (snippet) or detail item (full content)
 * @returns {Promise<OpdImportResult>}
 */
export async function importPromptToOpm(prompt) {
  let full;
  try {
    full = await resolvePromptForImport(prompt);
  } catch {
    return 'error';
  }

  const payload = {
    type: 'OPD_IMPORT_PROMPT',
    prompt: promptForImport(full),
  };

  // COMMENT: Production catalog — external message first (avoids 5s bridge timeout).
  if (!isOpmBridgePresent()) {
    const externalResult = await importViaExternalMessage(payload);
    if (externalResult !== 'no_extension') {
      return externalResult;
    }
  }

  const bridgeResult = await importViaOpmBridge(payload);
  if (bridgeResult && bridgeResult !== 'no_extension') {
    return bridgeResult;
  }

  const externalResult = await importViaExternalMessage(payload);
  if (externalResult !== 'no_extension') {
    return externalResult;
  }

  // COMMENT: Only nudge install when the browser exposes no extension messaging API.
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
    window.open(CHROME_STORE_URL, '_blank', 'noopener,noreferrer');
  }
  return 'no_extension';
}
