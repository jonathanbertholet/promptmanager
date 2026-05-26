/**
 * Publisher registration orchestration (token + username).
 */
import { getPublisherMe, registerPublisher, checkHandleAvailable } from './opdClient.js';
import {
  getOrCreatePublishToken,
  setOpdUsername,
  getPublishSettings,
  getPublisherSyncedAt,
  setPublisherSyncedAt,
  getOpdPendingUsername,
  setOpdPendingUsername,
  clearOpdPendingUsername,
} from './opdPublishToken.js';

// COMMENT: Reuse cached handle from storage; refresh from API only when stale or forced
const PUBLISHER_SYNC_TTL_MS = 24 * 60 * 60 * 1000;

/** Word lists for random handle suggestions (adj_noun_NNN). */
const HANDLE_ADJECTIVES = [
  'swift', 'bright', 'calm', 'bold', 'keen', 'warm', 'cool', 'fair',
  'quick', 'clear', 'brave', 'happy', 'lucky', 'noble', 'quiet', 'witty',
];
const HANDLE_NOUNS = [
  'falcon', 'river', 'maple', 'comet', 'pixel', 'spark', 'orbit', 'cedar',
  'harbor', 'meadow', 'nova', 'ember', 'ridge', 'cloud', 'stone', 'wave',
];

/**
 * @returns {string}
 */
export function suggestRandomHandle() {
  const adj = HANDLE_ADJECTIVES[Math.floor(Math.random() * HANDLE_ADJECTIVES.length)];
  const noun = HANDLE_NOUNS[Math.floor(Math.random() * HANDLE_NOUNS.length)];
  const num = Math.floor(Math.random() * 900) + 100;
  return `${adj}_${noun}_${num}`;
}

/**
 * COMMENT: Seed a draft handle for new users — persisted until first upload locks it in.
 * @returns {Promise<string>}
 */
export async function getOrCreatePendingUsername() {
  const settings = await getPublishSettings();
  if (settings.username) {
    return settings.username;
  }

  const existing = await getOpdPendingUsername();
  if (existing) {
    return existing;
  }

  const handle = suggestRandomHandle();
  await setOpdPendingUsername(handle);
  return handle;
}

/**
 * COMMENT: Register the draft handle on first catalog upload when the user has no handle yet.
 * @returns {Promise<{ ok: boolean, username?: string, error?: string }>}
 */
export async function ensurePublisherRegisteredForUpload() {
  const settings = await getPublishSettings();
  if (settings.username) {
    return { ok: true, username: settings.username };
  }
  if (!settings.enabled) {
    return { ok: false, error: 'publish_disabled' };
  }

  await getOrCreatePublishToken();

  let handle = await getOrCreatePendingUsername();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const avail = await isHandleAvailable(handle);
    if (!avail.available) {
      handle = suggestRandomHandle();
      await setOpdPendingUsername(handle);
      continue;
    }

    const reg = await registerPublisherHandle(handle);
    if (reg.ok && reg.username) {
      return { ok: true, username: reg.username };
    }

    handle = suggestRandomHandle();
    await setOpdPendingUsername(handle);
  }

  return { ok: false, error: 'register_failed' };
}

/**
 * @param {string} handle
 * @returns {Promise<{ available: boolean, reason?: string }>}
 */
export async function isHandleAvailable(handle) {
  const res = await checkHandleAvailable(handle);
  if (!res.ok || !res.data) {
    return { available: false, reason: 'error' };
  }
  return {
    available: Boolean(res.data.available),
    reason: res.data.reason,
  };
}

/**
 * @param {string} username
 * @param {string} [turnstileToken]
 * @returns {Promise<{ ok: boolean, username?: string, error?: string }>}
 */
export async function registerPublisherHandle(username, turnstileToken = '') {
  await getOrCreatePublishToken();
  const res = await registerPublisher(username, turnstileToken);
  if (res.ok && res.data?.username) {
    await setOpdUsername(res.data.username);
    await clearOpdPendingUsername();
    await setPublisherSyncedAt();
    return { ok: true, username: res.data.username };
  }
  const err = res.data?.error || 'register_failed';
  return { ok: false, error: err };
}

/**
 * @returns {Promise<{ registered: boolean, username: string|null }>}
 */
export async function syncPublisherFromServer() {
  const res = await getPublisherMe();
  if (res.ok && res.data?.username) {
    await setOpdUsername(res.data.username);
    await setPublisherSyncedAt();
    return { registered: true, username: res.data.username };
  }
  return { registered: false, username: null };
}

/**
 * @param {{ forceSync?: boolean }} [options]
 * @returns {Promise<{ enabled: boolean, username: string|null, registered: boolean }>}
 */
export async function getPublisherStatus({ forceSync = false } = {}) {
  const settings = await getPublishSettings();

  if (!settings.token) {
    return {
      enabled: settings.enabled,
      username: settings.username,
      registered: Boolean(settings.username),
    };
  }

  if (!forceSync && settings.username) {
    const syncedAt = await getPublisherSyncedAt();
    if (!syncedAt) {
      // COMMENT: Existing installs already had opdUsername — seed cache without an API call
      await setPublisherSyncedAt();
      return {
        enabled: settings.enabled,
        username: settings.username,
        registered: true,
      };
    }
    if ((Date.now() - syncedAt) < PUBLISHER_SYNC_TTL_MS) {
      return {
        enabled: settings.enabled,
        username: settings.username,
        registered: true,
      };
    }
  }

  const server = await syncPublisherFromServer();
  return {
    enabled: settings.enabled,
    username: server.username || settings.username,
    registered: server.registered || Boolean(settings.username),
  };
}
