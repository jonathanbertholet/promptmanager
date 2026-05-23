// pinnedInputStorage.js — per-host pinned chat/input selectors for power users

const PINNED_INPUTS_KEY = 'pinned_inputs_v1';

function storageGet(keys) {
  return new Promise(resolve => chrome.storage.local.get(keys, resolve));
}

function storageSet(obj) {
  return new Promise(resolve => chrome.storage.local.set(obj, resolve));
}

/**
 * COMMENT: Normalize hostname keys so pins are scoped to the site, not the full URL path.
 * @param {string} hostname
 * @returns {string}
 */
function normalizeHostname(hostname) {
  return String(hostname || '').trim().toLowerCase();
}

/**
 * COMMENT: Load the full pinned-input map from storage.
 * @returns {Promise<Record<string, object>>}
 */
export async function getAllPinnedInputs() {
  const data = await storageGet([PINNED_INPUTS_KEY]);
  const map = data?.[PINNED_INPUTS_KEY];
  return map && typeof map === 'object' ? map : {};
}

/**
 * COMMENT: Read a pinned input descriptor for one hostname.
 * @param {string} hostname
 * @returns {Promise<object|null>}
 */
export async function getPinnedForHostname(hostname) {
  const key = normalizeHostname(hostname);
  if (!key) return null;
  const map = await getAllPinnedInputs();
  return map[key] || null;
}

/**
 * COMMENT: Save or replace the pinned input descriptor for a hostname.
 * @param {string} hostname
 * @param {object} entry
 * @returns {Promise<object>}
 */
export async function setPinnedForHostname(hostname, entry) {
  const key = normalizeHostname(hostname);
  if (!key || !entry?.selector) {
    throw new Error('Pinned input requires a hostname and selector.');
  }

  const map = await getAllPinnedInputs();
  map[key] = {
    selector: entry.selector,
    label: entry.label || '',
    deepShadow: Boolean(entry.deepShadow),
    pinnedAt: entry.pinnedAt || new Date().toISOString(),
  };
  await storageSet({ [PINNED_INPUTS_KEY]: map });
  return map[key];
}

/**
 * COMMENT: Remove a pinned input for one hostname.
 * @param {string} hostname
 * @returns {Promise<boolean>}
 */
export async function removePinnedForHostname(hostname) {
  const key = normalizeHostname(hostname);
  if (!key) return false;

  const map = await getAllPinnedInputs();
  if (!map[key]) return false;

  delete map[key];
  await storageSet({ [PINNED_INPUTS_KEY]: map });
  return true;
}
