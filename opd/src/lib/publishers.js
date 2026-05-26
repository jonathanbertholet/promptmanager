/**
 * Publisher registration and handle availability.
 */
import { hashPublishToken, readPublishToken, resolvePublisher } from './auth.js';
import { jsonResponse } from './cors.js';
import { checkRateLimit, clientIp } from './rateLimit.js';
import { verifyTurnstile } from './turnstile.js';
import { normalizeHandle, readTurnstileToken } from './validate.js';

/**
 * @param {unknown} body
 */
async function parseJsonBody(request, body) {
  if (body !== undefined) return body;
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/**
 * GET /v1/handles/:handle/available
 */
export async function getHandleAvailable(request, db, handleSegment, env) {
  const ip = clientIp(request);
  const rl = await checkRateLimit(env, `rl:ip:${ip}:handle_check`, 60, 3600);
  if (!rl.allowed) {
    return jsonResponse({ error: 'rate_limited' }, request, 429);
  }

  const parsed = normalizeHandle(decodeURIComponent(handleSegment || ''));
  if (!parsed.ok) {
    return jsonResponse({ available: false, reason: parsed.reason }, request);
  }

  const existing = await db
    .prepare(`SELECT username FROM publishers WHERE username = ?`)
    .bind(parsed.handle)
    .first();

  if (existing) {
    return jsonResponse({ available: false, reason: 'taken' }, request);
  }
  return jsonResponse({ available: true }, request);
}

/**
 * GET /v1/publishers/me
 */
export async function getPublisherMe(request, db) {
  const rawToken = readPublishToken(request);
  if (!rawToken) {
    return jsonResponse({ error: 'unauthorized' }, request, 401);
  }
  const publisher = await resolvePublisher(db, rawToken);
  if (!publisher || publisher.banned) {
    return jsonResponse({ error: publisher?.banned ? 'forbidden' : 'not_registered' }, request, 404);
  }
  return jsonResponse(
    {
      username: publisher.username,
      createdAt: publisher.createdAt,
      updatedAt: publisher.updatedAt,
    },
    request
  );
}

/**
 * POST /v1/publishers — register @handle for token.
 */
export async function postPublisher(request, db, env, body) {
  const rawToken = readPublishToken(request);
  if (!rawToken) {
    return jsonResponse({ error: 'unauthorized' }, request, 401);
  }

  const ip = clientIp(request);
  const rl = await checkRateLimit(env, `rl:ip:${ip}:register`, 5, 3600);
  if (!rl.allowed) {
    return jsonResponse({ error: 'rate_limited' }, request, 429);
  }

  const payload = await parseJsonBody(request, body);
  const ts = readTurnstileToken(request, payload);
  const tsResult = await verifyTurnstile(env, ts, ip);
  if (!tsResult.ok) {
    return jsonResponse({ error: 'turnstile_failed' }, request, 403);
  }

  const parsed = normalizeHandle(payload?.username);
  if (!parsed.ok) {
    return jsonResponse({ error: 'username_invalid', reason: parsed.reason }, request, 400);
  }

  const tokenHash = await hashPublishToken(rawToken);
  const existing = await db
    .prepare(`SELECT username, banned_at FROM publishers WHERE token_hash = ?`)
    .bind(tokenHash)
    .first();

  if (existing) {
    if (existing.banned_at) {
      return jsonResponse({ error: 'forbidden' }, request, 403);
    }
    if (existing.username === parsed.handle) {
      return jsonResponse({ username: parsed.handle }, request, 200);
    }
    return jsonResponse({ error: 'already_registered' }, request, 409);
  }

  const taken = await db
    .prepare(`SELECT token_hash FROM publishers WHERE username = ?`)
    .bind(parsed.handle)
    .first();
  if (taken) {
    return jsonResponse({ error: 'username_taken' }, request, 409);
  }

  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO publishers (token_hash, username, created_at) VALUES (?, ?, ?)`
    )
    .bind(tokenHash, parsed.handle, now)
    .run();

  return jsonResponse({ username: parsed.handle, createdAt: now }, request, 201);
}
