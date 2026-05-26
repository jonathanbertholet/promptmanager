/**
 * KV-backed rate limits (no-op when RATE_LIMIT binding is absent — local dev).
 */

/**
 * @param {{ RATE_LIMIT?: KVNamespace }} env
 * @param {string} key
 * @param {number} limit
 * @param {number} windowSec
 */
export async function checkRateLimit(env, key, limit, windowSec) {
  if (!env.RATE_LIMIT) return { allowed: true };

  const now = Math.floor(Date.now() / 1000);
  const bucket = `${key}:${Math.floor(now / windowSec)}`;
  const current = Number.parseInt((await env.RATE_LIMIT.get(bucket)) || '0', 10) || 0;
  if (current >= limit) {
    return { allowed: false, retryAfter: windowSec - (now % windowSec) };
  }
  await env.RATE_LIMIT.put(bucket, String(current + 1), { expirationTtl: windowSec + 5 });
  return { allowed: true };
}

/**
 * @param {Request} request
 */
export function clientIp(request) {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    '0.0.0.0'
  );
}
