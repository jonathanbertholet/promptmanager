/**
 * Abuse reports for catalog prompts.
 */
import { jsonResponse } from './cors.js';
import { hashPublishToken } from './auth.js';
import { checkRateLimit, clientIp } from './rateLimit.js';
import { verifyTurnstile } from './turnstile.js';
import { readTurnstileToken, validateReportBody } from './validate.js';

/**
 * POST /v1/prompts/:id/report
 */
export async function postPromptReport(request, db, env, promptId) {
  const ip = clientIp(request);
  const rl = await checkRateLimit(env, `rl:ip:${ip}:report`, 10, 3600);
  if (!rl.allowed) {
    return jsonResponse({ error: 'rate_limited' }, request, 429);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const ts = readTurnstileToken(request, body);
  const tsResult = await verifyTurnstile(env, ts, ip);
  if (!tsResult.ok) {
    return jsonResponse({ error: 'turnstile_failed' }, request, 403);
  }

  const validated = validateReportBody(body);
  if (!validated.ok) {
    return jsonResponse({ error: 'validation_failed', detail: validated.error }, request, 400);
  }

  const prompt = await db
    .prepare(`SELECT id FROM prompts WHERE id = ? AND deleted_at IS NULL`)
    .bind(promptId)
    .first();
  if (!prompt) {
    return jsonResponse({ error: 'not_found' }, request, 404);
  }

  const ipHash = await hashPublishToken(`ip:${ip}`);
  const reportId = crypto.randomUUID();
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO reports (id, prompt_id, reason, detail, reporter_ip_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(
      reportId,
      promptId,
      validated.data.reason,
      validated.data.detail || null,
      ipHash.slice(0, 32),
      now
    )
    .run();

  return jsonResponse({ ok: true, id: reportId }, request, 202);
}
