/**
 * Cloudflare Turnstile siteverify (skipped when TURNSTILE_SECRET_KEY unset — local dev).
 */

/**
 * @param {import('../worker.js').Env} env
 * @param {string} token
 * @param {string} remoteip
 */
export async function verifyTurnstile(env, token, remoteip) {
  if (!env.TURNSTILE_SECRET_KEY) {
    return { ok: true, skipped: true };
  }
  if (!token) {
    return { ok: false, error: 'missing_token' };
  }

  const form = new URLSearchParams();
  form.set('secret', env.TURNSTILE_SECRET_KEY);
  form.set('response', token);
  if (remoteip) form.set('remoteip', remoteip);

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  const data = await res.json();
  if (!data.success) {
    return { ok: false, error: 'verification_failed' };
  }
  return { ok: true };
}
