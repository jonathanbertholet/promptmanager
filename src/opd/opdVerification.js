import '../platform.js';
import { getOpdApiBaseUrl } from './opdPublishToken.js';

let inProgress;

/** Human verification happens on OPD, without exposing the publisher token in a URL. */
export function verifyPublisher(opdFetch) {
  if (!inProgress) inProgress = completeVerification(opdFetch).finally(() => { inProgress = null; });
  return inProgress;
}

async function completeVerification(opdFetch) {
  const started = await opdFetch('/v1/publisher-verifications', { method: 'POST' });
  if (!started.ok || !started.data?.id || !started.data?.verificationUrl) {
    return { ok: false, error: started.data?.error || 'verification_unavailable' };
  }
  const base = new URL(await getOpdApiBaseUrl());
  const url = new URL(started.data.verificationUrl);
  const local = ['localhost', '127.0.0.1'].includes(base.hostname);
  if (url.origin !== base.origin || url.pathname !== '/verify'
    || url.searchParams.get('id') !== started.data.id || (url.protocol !== 'https:' && !local)) {
    return { ok: false, error: 'invalid_verification_url' };
  }
  const tab = await OPMApi.tabs.create({ url: url.toString(), active: true });
  const deadline = Date.now() + 4 * 60 * 1000;
  while (Date.now() < deadline) {
    const result = await opdFetch(`/v1/publisher-verifications/${encodeURIComponent(started.data.id)}`, { method: 'GET' });
    if (result.ok && result.data?.verified) {
      try {
        const current = await OPMApi.tabs.get(tab.id);
        if (current.url === url.toString()) await OPMApi.tabs.remove(tab.id);
      } catch { /* The user may have closed the completed verification page. */ }
      return { ok: true };
    }
    if (!result.ok) return { ok: false, error: result.data?.error || 'verification_failed' };
    try { await OPMApi.tabs.get(tab.id); }
    catch { return { ok: false, error: 'verification_cancelled' }; }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  return { ok: false, error: 'verification_expired' };
}
