/**
 * HTTP client for Open Prompt Database /v1 API (service worker only).
 */
import { getOpdApiBaseUrl, getPublishToken } from './opdPublishToken.js';

/**
 * @param {string} path — e.g. /v1/prompts
 * @param {RequestInit} [init]
 */
export async function opdFetch(path, init = {}) {
  const base = await getOpdApiBaseUrl();
  const token = await getPublishToken();
  const headers = new Headers(init.headers || {});
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('X-OPD-Token', token);
  }

  const res = await fetch(`${base}${path}`, { ...init, headers });
  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: 'invalid_json' };
    }
  }
  return { ok: res.ok, status: res.status, data };
}

/**
 * @param {string} handle
 */
export async function checkHandleAvailable(handle) {
  const encoded = encodeURIComponent(handle.trim().toLowerCase());
  return opdFetch(`/v1/handles/${encoded}/available`, { method: 'GET' });
}

/**
 * @param {string} username
 * @param {string} [turnstileToken]
 */
export async function registerPublisher(username, turnstileToken = '') {
  return opdFetch('/v1/publishers', {
    method: 'POST',
    headers: turnstileToken
      ? { 'CF-Turnstile-Response': turnstileToken }
      : undefined,
    body: JSON.stringify({ username, turnstileToken: turnstileToken || undefined }),
  });
}

/**
 * @param {object} payload
 * @param {string} [turnstileToken]
 */
export async function publishPrompt(payload, turnstileToken = '') {
  return opdFetch('/v1/prompts', {
    method: 'POST',
    headers: turnstileToken
      ? { 'CF-Turnstile-Response': turnstileToken }
      : undefined,
    body: JSON.stringify({ ...payload, turnstileToken: turnstileToken || undefined }),
  });
}

/**
 * @param {string} catalogId
 */
export async function deletePublishedPrompt(catalogId) {
  return opdFetch(`/v1/prompts/${encodeURIComponent(catalogId)}`, { method: 'DELETE' });
}

/**
 * @returns {Promise<{ ok: boolean, data: object|null }>}
 */
export async function getPublisherMe() {
  return opdFetch('/v1/publishers/me', { method: 'GET' });
}

/**
 * @param {string} catalogId
 * @returns {Promise<{ ok: boolean, status: number, data: object|null }>}
 */
export async function getCatalogPrompt(catalogId) {
  return opdFetch(`/v1/prompts/${encodeURIComponent(catalogId)}`, { method: 'GET' });
}

/**
 * Fire-and-forget import count bump.
 * @param {string} catalogId
 */
export async function notifyPromptImported(catalogId) {
  try {
    const base = await getOpdApiBaseUrl();
    await fetch(`${base}/v1/prompts/${encodeURIComponent(catalogId)}/import`, {
      method: 'POST',
    });
  } catch {
    /* non-blocking */
  }
}
