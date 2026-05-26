/** Query param validation for list endpoint. */

/**
 * @param {string|null} raw
 * @param {number} fallback
 * @param {number} max
 */
export function parseLimit(raw, fallback = 20, max = 50) {
  const n = Number.parseInt(raw || '', 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, max);
}

/**
 * @param {string|null} raw
 */
export function parseOffset(raw) {
  const n = Number.parseInt(raw || '', 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, 5000);
}

/**
 * @param {string|null} raw
 * @returns {'recent'|'downloads'|'title'}
 */
export function parseSort(raw) {
  const s = (raw || 'recent').trim().toLowerCase();
  if (s === 'downloads' || s === 'imports' || s === 'popular') return 'downloads';
  if (s === 'title' || s === 'az' || s === 'a-z') return 'title';
  return 'recent';
}

/**
 * @param {string|null} raw
 */
export function parseQuery(raw) {
  if (!raw) return '';
  return raw.trim().slice(0, 120);
}

/**
 * @param {string|null} raw
 */
export function parseTag(raw) {
  if (!raw) return '';
  return raw.trim().toLowerCase().slice(0, 32);
}

/**
 * @param {string|null} raw
 */
export function parseAuthor(raw) {
  if (!raw) return '';
  const clean = raw.trim().toLowerCase();
  if (!/^[a-z0-9_-]{1,32}$/.test(clean)) return '';
  return clean;
}

/**
 * @param {string} rowTagsJson
 * @returns {string[]}
 */
export function parseTagsJson(rowTagsJson) {
  try {
    const tags = JSON.parse(rowTagsJson);
    return Array.isArray(tags) ? tags.filter(t => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * @param {string|null} raw
 * @returns {'card'|'full'}
 */
export function parseView(raw) {
  const v = (raw || 'card').trim().toLowerCase();
  return v === 'full' ? 'full' : 'card';
}

/**
 * @param {string} text
 * @param {number} max
 */
export function makeSnippet(text, max = 180) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

/**
 * Sanitize user query for FTS5 MATCH.
 * @param {string} q
 */
export function ftsQuery(q) {
  const terms = q
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8)
    .map((w) => `"${w.replace(/"/g, '""')}"`);
  return terms.join(' ');
}

/**
 * @param {Record<string, unknown>} row
 * @param {'card'|'full'} view
 */
export function rowToListItem(row, view = 'card') {
  const base = {
    id: row.id,
    title: row.title,
    tags: parseTagsJson(String(row.tags || '[]')),
    author: row.author,
    publishedAt: row.published_at,
    updatedAt: row.updated_at || null,
    stats: { imports: Number(row.import_count) || 0 },
  };
  if (view === 'full') {
    return { ...base, content: row.content };
  }
  return { ...base, snippet: makeSnippet(String(row.content || '')) };
}

/**
 * @param {Record<string, unknown>} row
 */
export function rowToPrompt(row) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    tags: parseTagsJson(String(row.tags || '[]')),
    author: row.author,
    publishedAt: row.published_at,
    updatedAt: row.updated_at || null,
    stats: { imports: Number(row.import_count) || 0 },
  };
}

/** Reserved public handles (lowercase). */
const RESERVED_HANDLES = new Set([
  'admin',
  'api',
  'www',
  'opd',
  'openpromptdatabase',
  'openpromptmanager',
  'support',
  'help',
  'about',
  'browse',
  'tags',
  'home',
  'null',
  'undefined',
]);

const TITLE_MAX = 200;
const CONTENT_MAX = 32 * 1024;
const TAG_MAX = 10;
const TAG_LEN = 32;

/**
 * @param {string|null|undefined} raw
 * @returns {{ ok: true, handle: string } | { ok: false, reason: 'invalid' | 'reserved' }}
 */
export function normalizeHandle(raw) {
  const handle = String(raw || '')
    .trim()
    .toLowerCase();
  if (!/^[a-z0-9_-]{3,32}$/.test(handle)) {
    return { ok: false, reason: 'invalid' };
  }
  if (RESERVED_HANDLES.has(handle)) {
    return { ok: false, reason: 'reserved' };
  }
  return { ok: true, handle };
}

/**
 * @param {unknown} raw
 * @returns {string[]}
 */
export function normalizePublishTags(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = new Set();
  for (const t of raw) {
    if (typeof t !== 'string') continue;
    const tag = t.trim().toLowerCase().slice(0, TAG_LEN);
    if (!tag || !/^[a-z0-9_-]+$/.test(tag)) continue;
    if (seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
    if (out.length >= TAG_MAX) break;
  }
  return out;
}

const BLOCKED_CONTENT = [/<\/script/i, /javascript:/i];

/**
 * @param {unknown} body
 * @returns {{ ok: true, data: { id?: string, title: string, content: string, tags: string[] } } | { ok: false, error: string }}
 */
export function validatePublishBody(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'invalid_body' };
  }
  const title = String(body.title || '').trim().slice(0, TITLE_MAX);
  const content = String(body.content || '').trim().slice(0, CONTENT_MAX);
  if (title.length < 1) return { ok: false, error: 'title_required' };
  if (content.length < 1) return { ok: false, error: 'content_required' };
  for (const pattern of BLOCKED_CONTENT) {
    if (pattern.test(title) || pattern.test(content)) {
      return { ok: false, error: 'unsafe_content' };
    }
  }
  const tags = normalizePublishTags(body.tags);
  let id;
  if (body.id != null && body.id !== '') {
    const rawId = String(body.id).trim();
    if (!/^[a-zA-Z0-9_-]{8,64}$/.test(rawId)) {
      return { ok: false, error: 'invalid_id' };
    }
    id = rawId;
  }
  return { ok: true, data: { id, title, content, tags } };
}

const REPORT_REASONS = new Set(['spam', 'malware', 'illegal', 'harassment', 'other']);

/**
 * @param {unknown} body
 */
export function validateReportBody(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'invalid_body' };
  }
  const reason = String(body.reason || '').trim().toLowerCase();
  if (!REPORT_REASONS.has(reason)) {
    return { ok: false, error: 'invalid_reason' };
  }
  const detail = String(body.detail || '').trim().slice(0, 500);
  return { ok: true, data: { reason, detail } };
}

/**
 * @param {Request} request
 * @param {unknown} body
 */
export function readTurnstileToken(request, body) {
  const header = request.headers.get('CF-Turnstile-Response') || '';
  if (header.trim()) return header.trim();
  if (body && typeof body === 'object' && typeof body.turnstileToken === 'string') {
    return body.turnstileToken.trim();
  }
  return '';
}
