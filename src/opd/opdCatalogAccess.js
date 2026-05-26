/**
 * Optional access to Open Prompt Database — injects opd-bridge.js after the user
 * grants host permission (store-safe; not in required permissions).
 * Production can also use externally_connectable + sendMessage without this.
 */
import { OPD_CATALOG_URL } from './opdConstants.js';

/** Keep in sync with manifest optional_host_permissions + externally_connectable. */
export const OPD_CATALOG_ORIGINS = [
  'https://openpromptdatabase.com/*',
  'http://localhost:8787/*',
  'http://127.0.0.1:8787/*',
];

const OPD_BRIDGE_SCRIPT_ID = 'opd-catalog-bridge';

/**
 * @param {string} [url]
 */
export function isOpdCatalogUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (u.origin === OPD_CATALOG_URL) return true;
    if ((u.hostname === 'localhost' || u.hostname === '127.0.0.1') && u.port === '8787') {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

/** @param {string} [url] */
export function isAllowedOpdMessageOrigin(url) {
  if (!url) return false;
  try {
    const origin = new URL(url).origin;
    if (origin === OPD_CATALOG_URL) return true;
    if (origin === 'http://localhost:8787' || origin === 'http://127.0.0.1:8787') {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

/** True when optional host permission for the catalog is granted. */
export async function hasOpdCatalogPermission() {
  for (const origin of OPD_CATALOG_ORIGINS) {
    if (await chrome.permissions.contains({ origins: [origin] })) {
      return true;
    }
  }
  return false;
}

/** Ask for catalog host access (one-time prompt). */
export async function requestOpdCatalogPermission() {
  return new Promise((resolve) => {
    chrome.permissions.request({ origins: OPD_CATALOG_ORIGINS }, (granted) => {
      resolve(Boolean(granted));
    });
  });
}

/** Register bridge content script for catalog origins (after permission grant). */
export async function registerOpdBridgeContentScript() {
  const existing = await chrome.scripting.getRegisteredContentScripts({
    ids: [OPD_BRIDGE_SCRIPT_ID],
  });
  if (existing?.length) return;

  await chrome.scripting.registerContentScripts([
    {
      id: OPD_BRIDGE_SCRIPT_ID,
      matches: OPD_CATALOG_ORIGINS,
      js: ['opd/opd-bridge.js'],
      runAt: 'document_start',
      persistAcrossSessions: true,
    },
  ]);
}

export async function unregisterOpdBridgeContentScript() {
  try {
    await chrome.scripting.unregisterContentScripts({ ids: [OPD_BRIDGE_SCRIPT_ID] });
  } catch {
    /* not registered */
  }
}

/**
 * Inject bridge into an open tab (e.g. right after permission grant).
 * @param {number} tabId
 */
export async function ensureOpdBridgeForTab(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['opd/opd-bridge.js'],
    });
    return true;
  } catch {
    return false;
  }
}

/** Apply or remove dynamic bridge registration based on current permissions. */
export async function syncOpdCatalogAccess() {
  if (await hasOpdCatalogPermission()) {
    await registerOpdBridgeContentScript();
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id && isOpdCatalogUrl(tab.url)) {
        await ensureOpdBridgeForTab(tab.id);
      }
    }
  } else {
    await unregisterOpdBridgeContentScript();
  }
}

/** Wire permission + tab listeners (call once from service worker). */
export function initOpdCatalogAccess() {
  chrome.permissions.onAdded.addListener((perms) => {
    if (perms.origins?.some((o) => OPD_CATALOG_ORIGINS.includes(o))) {
      syncOpdCatalogAccess().catch(console.error);
    }
  });

  chrome.permissions.onRemoved.addListener((perms) => {
    if (perms.origins?.some((o) => OPD_CATALOG_ORIGINS.includes(o))) {
      unregisterOpdBridgeContentScript().catch(console.error);
    }
  });

  chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
    if (info.status !== 'complete' || !isOpdCatalogUrl(tab.url)) return;
    hasOpdCatalogPermission().then((ok) => {
      if (ok) ensureOpdBridgeForTab(tabId).catch(console.error);
    });
  });

  syncOpdCatalogAccess().catch(console.error);
}
