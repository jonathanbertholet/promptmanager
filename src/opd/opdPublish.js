/**
 * Map local prompts to catalog POST /v1/prompts and persist opdPublicId locally.
 */
import { publishPrompt, deletePublishedPrompt, getCatalogPrompt } from './opdClient.js';
import { getOpdApiBaseUrl } from './opdPublishToken.js';
import { ensurePublisherRegisteredForUpload, getPublisherStatus } from './opdPublisher.js';
import { getPrompts, updatePrompt } from '../storage/promptStorage.js';
import { generateUUID } from '../utils.js';

/**
 * Stable catalog id for create/update — avoids duplicate rows when re-sharing.
 * @param {object} local — normalised prompt from storage
 */
export function resolveCatalogClientId(local) {
  if (typeof local?.opdPublicId === 'string' && local.opdPublicId.length > 0) {
    return local.opdPublicId;
  }
  const uuid = typeof local?.uuid === 'string' ? local.uuid : '';
  if (uuid.startsWith('opd:')) {
    return uuid.slice(4);
  }
  if (/^[0-9a-f-]{36}$/i.test(uuid)) {
    return uuid;
  }
  return undefined;
}

/**
 * @param {object} local — normalised prompt from storage
 */
export function localPromptToCatalogBody(local, { forceNew = false } = {}) {
  const body = {
    title: local.title,
    content: local.content,
    tags: Array.isArray(local.tags) ? local.tags : [],
  };
  if (!forceNew) {
    const id = resolveCatalogClientId(local);
    if (id) body.id = id;
  }
  return body;
}

/**
 * @param {string} catalogId
 * @param {string} apiBase
 */
export function buildCatalogPromptUrl(catalogId, apiBase) {
  return `${apiBase}/p/${encodeURIComponent(catalogId)}`;
}

/**
 * True when this local row is already tied to a catalog prompt (published or imported).
 * @param {object} local
 */
function hasKnownCatalogLink(local) {
  if (typeof local?.opdPublicId === 'string' && local.opdPublicId.length > 0) return true;
  return String(local?.uuid || '').startsWith('opd:');
}

/**
 * Share flow: reuse an existing catalog row when possible, otherwise create/update in place.
 * @param {string} localUuid
 * @param {string} [turnstileToken]
 * @returns {Promise<{ ok: boolean, catalogId?: string, url?: string, reused?: boolean, error?: string }>}
 */
export async function shareLocalPrompt(localUuid, turnstileToken = '') {
  const registration = await ensurePublisherRegisteredForUpload();
  if (!registration.ok) {
    return { ok: false, error: registration.error || 'not_registered' };
  }

  const status = await getPublisherStatus();
  if (!status.enabled || !status.registered || !status.username) {
    return { ok: false, error: 'not_registered' };
  }

  const prompts = await getPrompts();
  const local = prompts.find((p) => p.uuid === localUuid);
  if (!local) {
    return { ok: false, error: 'prompt_not_found' };
  }

  const apiBase = await getOpdApiBaseUrl();
  const catalogId = resolveCatalogClientId(local);

  // COMMENT: Local UUIDs look like catalog ids — only GET when this row was already published/imported
  if (hasKnownCatalogLink(local) && catalogId) {
    const existing = await getCatalogPrompt(catalogId);
    if (existing.ok && existing.data?.prompt) {
      const remote = existing.data.prompt;
      const url = buildCatalogPromptUrl(catalogId, apiBase);
      const ownsPrompt = remote.author === status.username;

      if (ownsPrompt) {
        const res = await publishPrompt(
          localPromptToCatalogBody({ ...local, opdPublicId: catalogId }),
          turnstileToken,
        );
        if (!res.ok || !res.data?.prompt?.id) {
          return { ok: false, error: res.data?.error || 'publish_failed' };
        }
        await updatePrompt(localUuid, {
          opdPublicId: catalogId,
          opdLastPublishedAt: new Date().toISOString(),
        });
        return { ok: true, catalogId, url, reused: true };
      }

      // COMMENT: Imported someone else's prompt — publish a new catalog row for this user's copy
      return publishLocalPrompt(localUuid, turnstileToken, { forceNewCatalogRow: true });
    }

    // COMMENT: Known catalog id but lookup failed — don't POST a duplicate (404 means recreate)
    if (existing.status !== 404) {
      return { ok: false, error: 'catalog_lookup_failed' };
    }
  }

  return publishLocalPrompt(localUuid, turnstileToken);
}

/**
 * @param {string} localUuid
 * @param {string} [turnstileToken]
 * @returns {Promise<{ ok: boolean, catalogId?: string, url?: string, error?: string }>}
 */
export async function publishLocalPrompt(localUuid, turnstileToken = '', { forceNewCatalogRow = false } = {}) {
  const registration = await ensurePublisherRegisteredForUpload();
  if (!registration.ok) {
    return { ok: false, error: registration.error || 'not_registered' };
  }

  const status = await getPublisherStatus();
  if (!status.enabled || !status.registered || !status.username) {
    return { ok: false, error: 'not_registered' };
  }

  const prompts = await getPrompts();
  const local = prompts.find((p) => p.uuid === localUuid);
  if (!local) {
    return { ok: false, error: 'prompt_not_found' };
  }

  const res = await publishPrompt(
    localPromptToCatalogBody(local, { forceNew: forceNewCatalogRow }),
    turnstileToken,
  );
  if (!res.ok || !res.data?.prompt?.id) {
    return { ok: false, error: res.data?.error || 'publish_failed' };
  }

  const catalogId = res.data.prompt.id;
  const apiBase = await getOpdApiBaseUrl();
  const now = new Date().toISOString();
  // COMMENT: Imported rows keep opd:{catalogId} — fork a local uuid so re-import cannot clobber this copy
  const patch = {
    opdPublicId: catalogId,
    opdLastPublishedAt: now,
  };
  if (forceNewCatalogRow && String(local.uuid || '').startsWith('opd:')) {
    patch.uuid = generateUUID();
  }
  await updatePrompt(localUuid, patch);

  return {
    ok: true,
    catalogId,
    url: buildCatalogPromptUrl(catalogId, apiBase),
  };
}

/**
 * @param {string} localUuid
 */
export async function unpublishLocalPrompt(localUuid) {
  const prompts = await getPrompts();
  const local = prompts.find((p) => p.uuid === localUuid);
  if (!local?.opdPublicId) {
    return { ok: false, error: 'not_published' };
  }

  const res = await deletePublishedPrompt(local.opdPublicId);
  if (!res.ok && res.status !== 204) {
    return { ok: false, error: res.data?.error || 'delete_failed' };
  }

  await updatePrompt(localUuid, {
    opdPublicId: undefined,
    opdLastPublishedAt: undefined,
  });
  return { ok: true };
}
