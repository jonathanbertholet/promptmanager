import '../platform.js';
/**
 * Optional access to Open Prompt Database — injects opd-bridge.js after the user
 * grants host permission (store-safe; not in required permissions).
 * Production can also use externally_connectable + sendMessage without this.
 */
import { OPD_CATALOG_URL } from './opdConstants.js';

/** Keep in sync with manifest optional_host_permissions + externally_connectable. */
export const OPD_CATALOG_ORIGINS = [
  'https://openpromptdatabase.com/*',
  'https://www.openpromptdatabase.com/*',
];

const OPD_BRIDGE_SCRIPT_ID = 'opd-catalog-bridge';

/**
 * @param {string} [url]
 */
/** Apex + www catalog hosts (manifest externally_connectable). */
function isOpdCatalogOrigin(origin) {
  if (origin === OPD_CATALOG_URL) return true;
  if (origin === 'https://www.openpromptdatabase.com') return true;
  return false;
}

export function isOpdCatalogUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (isOpdCatalogOrigin(u.origin)) return true;
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
    if (isOpdCatalogOrigin(origin)) return true;
    if (origin === 'http://localhost:8787' || origin === 'http://127.0.0.1:8787') {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

/** Origins we can actually script right now (granted optional hosts or <all_urls>). */
export async function grantedOpdCatalogOrigins() {
  const all = await OPMApi.permissions.getAll();
  const granted = new Set(all.origins || []);
  if (granted.has('<all_urls>')) return [...OPD_CATALOG_ORIGINS];
  return OPD_CATALOG_ORIGINS.filter((origin) => granted.has(origin));
}

/** True when optional host permission for the catalog is granted. */
export async function hasOpdCatalogPermission() {
  return new Promise((resolve) => {
    OPMApi.permissions.contains(
      { origins: ['https://openpromptdatabase.com/*', 'https://www.openpromptdatabase.com/*'] },
      (granted) => resolve(Boolean(granted)),
    );
  });
}

/** Ask for catalog host access (one-time prompt). */
export function requestOpdCatalogPermission({ publish = false } = {}) {
  return new Promise((resolve) => {
    OPMApi.permissions.request(
      publish
        ? OPMPlatform.publishPermissionRequest(OPD_CATALOG_ORIGINS)
        : { origins: OPD_CATALOG_ORIGINS },
      (granted) => {
        const error = OPMApi.runtime.lastError;
        resolve(!error && Boolean(granted));
      }
    );
  });
}

/** Register bridge content script for catalog origins (after permission grant). */
export async function registerOpdBridgeContentScript() {
  const matches = await grantedOpdCatalogOrigins();
  if (matches.length === 0) {
    await unregisterOpdBridgeContentScript();
    return;
  }

  const definition = {
    id: OPD_BRIDGE_SCRIPT_ID,
    matches,
    js: ['platform.js', 'opd/opd-bridge.js'],
    runAt: 'document_start',
    persistAcrossSessions: true,
  };

  const existing = await OPMApi.scripting.getRegisteredContentScripts({
    ids: [OPD_BRIDGE_SCRIPT_ID],
  });
  if (existing?.length) {
    try {
      await OPMApi.scripting.updateContentScripts([definition]);
      return;
    } catch (_) {
      await unregisterOpdBridgeContentScript();
    }
  }

  await OPMApi.scripting.registerContentScripts([definition]);
}

export async function unregisterOpdBridgeContentScript() {
  try {
    await OPMApi.scripting.unregisterContentScripts({ ids: [OPD_BRIDGE_SCRIPT_ID] });
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
    await OPMApi.scripting.executeScript({
      target: { tabId },
      files: ['platform.js', 'opd/opd-bridge.js'],
    });
    return true;
  } catch {
    return false;
  }
}

/** Apply or remove dynamic bridge registration based on current permissions. */
export async function syncOpdCatalogAccess() {
  if (await hasOpdCatalogPermission()) {
    try {
      await registerOpdBridgeContentScript();
    } catch (error) {
      console.warn('[PromptManager] Catalog bridge register failed:', error);
    }
    const tabs = await OPMApi.tabs.query({});
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
  OPMApi.permissions.onAdded.addListener((perms) => {
    if (perms.origins?.some((o) => OPD_CATALOG_ORIGINS.includes(o))) {
      syncOpdCatalogAccess().catch(console.error);
    }
  });

  OPMApi.permissions.onRemoved.addListener((perms) => {
    if (perms.origins?.some((o) => OPD_CATALOG_ORIGINS.includes(o))) {
      // COMMENT: Re-evaluate remaining origins — don't tear down the bridge if another catalog host is still granted
      syncOpdCatalogAccess().catch(console.error);
    }
  });

  OPMApi.tabs.onUpdated.addListener((tabId, info, tab) => {
    if (info.status !== 'complete' || !isOpdCatalogUrl(tab.url)) return;
    hasOpdCatalogPermission().then((ok) => {
      if (ok) ensureOpdBridgeForTab(tabId).catch(console.error);
    });
  });

  syncOpdCatalogAccess().catch(console.error);
}
