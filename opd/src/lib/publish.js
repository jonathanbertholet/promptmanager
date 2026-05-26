/**
 * POST / DELETE published prompts.
 */
import { readPublishToken, resolvePublisher } from './auth.js';
import { loadPromptTags, syncPromptIndexes } from './catalogSync.js';
import { jsonResponse } from './cors.js';
import { checkRateLimit, clientIp } from './rateLimit.js';
import { verifyTurnstile } from './turnstile.js';
import { readTurnstileToken, rowToPrompt, validatePublishBody } from './validate.js';

/**
 * @param {Request} request
 */
async function parseJsonBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/**
 * POST /v1/prompts — create or update owned prompt.
 */
export async function postPrompt(request, db, env) {
  const rawToken = readPublishToken(request);
  if (!rawToken) {
    return jsonResponse({ error: 'unauthorized' }, request, 401);
  }

  const publisher = await resolvePublisher(db, rawToken);
  if (!publisher) {
    return jsonResponse({ error: 'not_registered' }, request, 403);
  }
  if (publisher.banned) {
    return jsonResponse({ error: 'forbidden' }, request, 403);
  }

  const ip = clientIp(request);
  const rl = await checkRateLimit(env, `rl:token:${publisher.tokenHash}:publish`, 10, 3600);
  if (!rl.allowed) {
    return jsonResponse({ error: 'rate_limited' }, request, 429);
  }

  const body = await parseJsonBody(request);
  const ts = readTurnstileToken(request, body);
  const tsResult = await verifyTurnstile(env, ts, ip);
  if (!tsResult.ok) {
    return jsonResponse({ error: 'turnstile_failed' }, request, 403);
  }

  const validated = validatePublishBody(body);
  if (!validated.ok) {
    return jsonResponse({ error: 'validation_failed', detail: validated.error }, request, 400);
  }

  const { id: clientId, title, content, tags } = validated.data;
  const promptId = clientId || crypto.randomUUID();
  const tagsJson = JSON.stringify(tags);
  const now = new Date().toISOString();

  const existing = await db
    .prepare(
      `SELECT id, publisher_token_hash, tags, deleted_at FROM prompts WHERE id = ?`
    )
    .bind(promptId)
    .first();

  let status = 201;
  let previousTags = [];

  if (existing) {
    if (existing.deleted_at) {
      return jsonResponse({ error: 'not_found' }, request, 404);
    }
    if (existing.publisher_token_hash !== publisher.tokenHash) {
      return jsonResponse({ error: 'forbidden' }, request, 403);
    }
    previousTags = await loadPromptTags(db, promptId);
    status = 200;
    await db
      .prepare(
        `UPDATE prompts SET title = ?, content = ?, tags = ?, author = ?, updated_at = ?
         WHERE id = ?`
      )
      .bind(title, content, tagsJson, publisher.username, now, promptId)
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO prompts (
          id, title, content, tags, author, publisher_token_hash,
          published_at, updated_at, import_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`
      )
      .bind(
        promptId,
        title,
        content,
        tagsJson,
        publisher.username,
        publisher.tokenHash,
        now,
        now
      )
      .run();
  }

  await syncPromptIndexes(db, {
    promptId,
    title,
    content,
    tags,
    previousTags,
  });

  const row = await db
    .prepare(
      `SELECT id, title, content, tags, author, published_at, updated_at, import_count
       FROM prompts WHERE id = ?`
    )
    .bind(promptId)
    .first();

  return jsonResponse({ prompt: rowToPrompt(row) }, request, status);
}

/**
 * DELETE /v1/prompts/:id — soft-delete owned prompt.
 */
export async function deletePrompt(request, db, id) {
  const rawToken = readPublishToken(request);
  if (!rawToken) {
    return jsonResponse({ error: 'unauthorized' }, request, 401);
  }

  const publisher = await resolvePublisher(db, rawToken);
  if (!publisher || publisher.banned) {
    return jsonResponse({ error: 'forbidden' }, request, 403);
  }

  const row = await db
    .prepare(`SELECT id, publisher_token_hash, deleted_at FROM prompts WHERE id = ?`)
    .bind(id)
    .first();

  if (!row || row.deleted_at) {
    return jsonResponse({ error: 'not_found' }, request, 404);
  }
  if (row.publisher_token_hash !== publisher.tokenHash) {
    return jsonResponse({ error: 'forbidden' }, request, 403);
  }

  const previousTags = await loadPromptTags(db, id);
  const now = new Date().toISOString();
  await db
    .prepare(`UPDATE prompts SET deleted_at = ?, updated_at = ? WHERE id = ?`)
    .bind(now, now, id)
    .run();

  await syncPromptIndexes(db, {
    promptId: id,
    title: '',
    content: '',
    tags: [],
    previousTags,
  });
  await db.prepare(`DELETE FROM prompts_fts WHERE id = ?`).bind(id).run();

  return new Response(null, { status: 204 });
}
