/**
 * Admin moderation routes (secret OPD_ADMIN_TOKEN).
 */
import { jsonResponse } from './cors.js';
import { loadPromptTags, syncPromptIndexes } from './catalogSync.js';

/**
 * @param {Request} request
 * @param {{ OPD_ADMIN_TOKEN?: string }} env
 */
function isAdmin(request, env) {
  const token = request.headers.get('X-OPD-Admin-Token') || '';
  return Boolean(env.OPD_ADMIN_TOKEN && token === env.OPD_ADMIN_TOKEN);
}

/**
 * DELETE /v1/admin/prompts/:id
 */
export async function adminDeletePrompt(request, db, env, promptId) {
  if (!isAdmin(request, env)) {
    return jsonResponse({ error: 'unauthorized' }, request, 401);
  }

  const row = await db
    .prepare(`SELECT id FROM prompts WHERE id = ? AND deleted_at IS NULL`)
    .bind(promptId)
    .first();
  if (!row) {
    return jsonResponse({ error: 'not_found' }, request, 404);
  }

  const previousTags = await loadPromptTags(db, promptId);
  const now = new Date().toISOString();
  await db
    .prepare(`UPDATE prompts SET deleted_at = ?, updated_at = ? WHERE id = ?`)
    .bind(now, now, promptId)
    .run();
  await syncPromptIndexes(db, {
    promptId,
    title: '',
    content: '',
    tags: [],
    previousTags,
  });
  await db.prepare(`DELETE FROM prompts_fts WHERE id = ?`).bind(promptId).run();

  return new Response(null, { status: 204 });
}

/**
 * POST /v1/admin/publishers/:handle/ban
 */
export async function adminBanPublisher(request, db, env, handleSegment) {
  if (!isAdmin(request, env)) {
    return jsonResponse({ error: 'unauthorized' }, request, 401);
  }

  const handle = decodeURIComponent(handleSegment || '').trim().toLowerCase();
  const now = new Date().toISOString();
  const result = await db
    .prepare(`UPDATE publishers SET banned_at = ?, updated_at = ? WHERE username = ?`)
    .bind(now, now, handle)
    .run();

  if (!result.meta?.changes) {
    return jsonResponse({ error: 'not_found' }, request, 404);
  }
  return jsonResponse({ ok: true, username: handle, bannedAt: now }, request);
}
