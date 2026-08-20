// learnedInputStorage.js — auto-learned chat/input selectors from successful inserts

const LEARNED_INPUTS_KEY = 'learned_inputs_v1';

function storageGet(keys) {
  return new Promise(resolve => chrome.storage.local.get(keys, resolve));
}

function storageSet(obj) {
  return new Promise(resolve => chrome.storage.local.set(obj, resolve));
}

/**
 * COMMENT: Normalize hostname keys so learned inputs are scoped to the site.
 * @param {string} hostname
 * @returns {string}
 */
function normalizeHostname(hostname) {
  return String(hostname || '').trim().toLowerCase();
}

/**
 * COMMENT: Load the full learned-input map from storage.
 * @returns {Promise<Record<string, object>>}
 */
export async function getAllLearnedInputs() {
  const data = await storageGet([LEARNED_INPUTS_KEY]);
  const map = data?.[LEARNED_INPUTS_KEY];
  return map && typeof map === 'object' ? map : {};
}

/**
 * COMMENT: Read a learned input descriptor for one hostname.
 * @param {string} hostname
 * @returns {Promise<object|null>}
 */
export async function getLearnedForHostname(hostname) {
  const key = normalizeHostname(hostname);
  if (!key) return null;
  const map = await getAllLearnedInputs();
  return map[key] || null;
}

/**
 * COMMENT: Save or replace the learned input descriptor for a hostname.
 * @param {string} hostname
 * @param {object} entry
 * @returns {Promise<object>}
 */
export async function setLearnedForHostname(hostname, entry) {
  const key = normalizeHostname(hostname);
  if (!key || !entry?.selector) {
    throw new Error('Learned input requires a hostname and selector.');
  }

  const map = await getAllLearnedInputs();
  const previous = map[key];
  map[key] = {
    selector: entry.selector,
    label: entry.label || '',
    deepShadow: Boolean(entry.deepShadow),
    learnedAt: entry.learnedAt || new Date().toISOString(),
    successCount: Number(previous?.successCount || 0) + 1,
  };
  await storageSet({ [LEARNED_INPUTS_KEY]: map });
  return map[key];
}

/**
 * COMMENT: Remove a learned input for one hostname.
 * @param {string} hostname
 * @returns {Promise<boolean>}
 */
export async function removeLearnedForHostname(hostname) {
  const key = normalizeHostname(hostname);
  if (!key) return false;

  const map = await getAllLearnedInputs();
  if (!map[key]) return false;

  delete map[key];
  await storageSet({ [LEARNED_INPUTS_KEY]: map });
  return true;
}
