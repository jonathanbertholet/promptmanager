/**
 * Import count telemetry after successful OPM import.
 */
import { jsonResponse } from './cors.js';
import { checkRateLimit, clientIp } from './rateLimit.js';

/**
 * POST /v1/prompts/:id/import
 */
export async function postPromptImport(request, db, env, promptId) {
  const ip = clientIp(request);
  const rl = await checkRateLimit(env, `rl:ip:${ip}:import`, 60, 3600);
  if (!rl.allowed) {
    return jsonResponse({ error: 'rate_limited' }, request, 429);
  }

  const result = await db
    .prepare(
      `UPDATE prompts SET import_count = import_count + 1
       WHERE id = ? AND deleted_at IS NULL`
    )
    .bind(promptId)
    .run();

  if (!result.meta?.changes) {
    return jsonResponse({ error: 'not_found' }, request, 404);
  }

  return new Response(null, { status: 204 });
}
