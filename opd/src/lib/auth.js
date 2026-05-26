/**
 * Publisher token hashing and resolution (never store raw tokens).
 */

/**
 * SHA-256 hex digest of UTF-8 token string.
 * @param {string} rawToken
 */
export async function hashPublishToken(rawToken) {
  const bytes = new TextEncoder().encode(String(rawToken || '').trim());
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * @param {Request} request
 * @returns {string|null}
 */
export function readPublishToken(request) {
  const header = request.headers.get('X-OPD-Token') || '';
  const trimmed = header.trim();
  if (trimmed.length < 16 || trimmed.length > 256) return null;
  return trimmed;
}

/**
 * @param {D1Database} db
 * @param {string} rawToken
 */
export async function resolvePublisher(db, rawToken) {
  const tokenHash = await hashPublishToken(rawToken);
  const row = await db
    .prepare(
      `SELECT token_hash, username, created_at, updated_at, banned_at
       FROM publishers WHERE token_hash = ?`
    )
    .bind(tokenHash)
    .first();
  if (!row) return null;
  if (row.banned_at) return { banned: true, tokenHash };
  return {
    banned: false,
    tokenHash: row.token_hash,
    username: row.username,
    createdAt: row.created_at,
    updatedAt: row.updated_at || null,
  };
}
