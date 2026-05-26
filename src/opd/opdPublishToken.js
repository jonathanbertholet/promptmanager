/**
 * Per-profile publish secret in chrome.storage.sync (pseudonymous publisher id).
 */
import { OPD_CATALOG_URL } from './opdConstants.js';

export const OPD_PUBLISH_TOKEN_KEY = 'opdPublishToken';
export const OPD_PUBLISH_ENABLED_KEY = 'opdPublishEnabled';
export const OPD_USERNAME_KEY = 'opdUsername';
// COMMENT: Draft handle for new users — locked in on first catalog upload
export const OPD_PENDING_USERNAME_KEY = 'opdPendingUsername';
export const OPD_API_BASE_URL_KEY = 'opdApiBaseUrl';
// COMMENT: Local TTL stamp — avoids hitting /publishers/me on every settings open
export const OPD_PUBLISHER_SYNCED_AT_KEY = 'opdPublisherSyncedAt';

function syncGet(keys) {
  return new Promise((resolve) => chrome.storage.sync.get(keys, resolve));
}

function syncSet(obj) {
  return new Promise((resolve) => chrome.storage.sync.set(obj, resolve));
}

function syncRemove(keys) {
  return new Promise((resolve) => chrome.storage.sync.remove(keys, resolve));
}

function localGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

function localSet(obj) {
  return new Promise((resolve) => chrome.storage.local.set(obj, resolve));
}

function localRemove(keys) {
  return new Promise((resolve) => chrome.storage.local.remove(keys, resolve));
}

/**
 * @returns {Promise<string>}
 */
export async function getOrCreatePublishToken() {
  const data = await syncGet([OPD_PUBLISH_TOKEN_KEY]);
  if (data[OPD_PUBLISH_TOKEN_KEY]) {
    return data[OPD_PUBLISH_TOKEN_KEY];
  }
  const token = crypto.randomUUID();
  await syncSet({ [OPD_PUBLISH_TOKEN_KEY]: token });
  return token;
}

/**
 * @returns {Promise<string|null>}
 */
export async function getPublishToken() {
  const data = await syncGet([OPD_PUBLISH_TOKEN_KEY]);
  return data[OPD_PUBLISH_TOKEN_KEY] || null;
}

/**
 * @returns {Promise<string>}
 */
export async function getOpdApiBaseUrl() {
  const data = await syncGet([OPD_API_BASE_URL_KEY]);
  return (data[OPD_API_BASE_URL_KEY] || OPD_CATALOG_URL).replace(/\/$/, '');
}

/**
 * @returns {Promise<{ enabled: boolean, username: string|null, token: string|null }>}
 */
export async function getPublishSettings() {
  const data = await syncGet([
    OPD_PUBLISH_ENABLED_KEY,
    OPD_USERNAME_KEY,
    OPD_PUBLISH_TOKEN_KEY,
    OPD_PENDING_USERNAME_KEY,
  ]);
  // COMMENT: New installs default to publish on until the user explicitly turns it off
  const enabled = data[OPD_PUBLISH_ENABLED_KEY] === undefined
    ? true
    : Boolean(data[OPD_PUBLISH_ENABLED_KEY]);

  return {
    enabled,
    username: data[OPD_USERNAME_KEY] || null,
    token: data[OPD_PUBLISH_TOKEN_KEY] || null,
    pendingUsername: data[OPD_PENDING_USERNAME_KEY] || null,
  };
}

/**
 * @param {boolean} enabled
 */
export async function setPublishEnabled(enabled) {
  await syncSet({ [OPD_PUBLISH_ENABLED_KEY]: enabled });
  if (enabled) {
    await getOrCreatePublishToken();
  }
}

/**
 * @param {string} username
 */
export async function setOpdUsername(username) {
  await syncSet({ [OPD_USERNAME_KEY]: username });
}

/**
 * @returns {Promise<string|null>}
 */
export async function getOpdPendingUsername() {
  const data = await syncGet([OPD_PENDING_USERNAME_KEY]);
  return data[OPD_PENDING_USERNAME_KEY] || null;
}

/**
 * @param {string} username
 */
export async function setOpdPendingUsername(username) {
  await syncSet({ [OPD_PENDING_USERNAME_KEY]: username });
}

export async function clearOpdPendingUsername() {
  await syncRemove([OPD_PENDING_USERNAME_KEY]);
}

/**
 * @returns {Promise<number>}
 */
export async function getPublisherSyncedAt() {
  const data = await localGet([OPD_PUBLISHER_SYNCED_AT_KEY]);
  return Number(data[OPD_PUBLISHER_SYNCED_AT_KEY]) || 0;
}

/**
 * @param {number} [timestamp]
 */
export async function setPublisherSyncedAt(timestamp = Date.now()) {
  await localSet({ [OPD_PUBLISHER_SYNCED_AT_KEY]: timestamp });
}

export async function clearPublisherSyncedAt() {
  await localRemove([OPD_PUBLISHER_SYNCED_AT_KEY]);
}
