/**
 * Import prompts from Open Prompt Database (OPD) into local storage.
 * Catalog id maps to a stable local uuid: opd:{catalogId}
 */
import { getPrompts, mergePrompts } from '../storage/promptStorage.js';

/** Prefix for stable local UUIDs — re-import updates the same library row. */
export const OPD_LOCAL_UUID_PREFIX = 'opd:';

/**
 * @param {string} catalogId
 * @returns {string}
 */
export function catalogLocalUuid(catalogId) {
  return `${OPD_LOCAL_UUID_PREFIX}${String(catalogId || '').trim()}`;
}

/**
 * @param {string[]} a
 * @param {string[]} b
 */
function tagsEqual(a, b) {
  const norm = (arr) =>
    [...(Array.isArray(arr) ? arr : [])]
      .map((t) => (typeof t === 'string' ? t.trim() : ''))
      .filter(Boolean)
      .sort();
  const sa = norm(a);
  const sb = norm(b);
  return sa.length === sb.length && sa.every((t, i) => t === sb[i]);
}

/**
 * True when an existing library row matches the catalog payload (no write needed).
 * @param {object} existing — normalised local prompt
 * @param {object} local — mapped catalog prompt
 */
export function isSameCatalogPrompt(existing, local) {
  return (
    existing.title === local.title &&
    existing.content === local.content &&
    tagsEqual(existing.tags, local.tags)
  );
}

/**
 * Map a catalog prompt payload to the shape expected by mergePrompts / normalisePrompt.
 * @param {object} catalog — { id, title, content, tags?, author?, publishedAt?, updatedAt? }
 */
export function catalogPromptToLocal(catalog) {
  const id = String(catalog?.id || '').trim();
  const title = typeof catalog?.title === 'string' ? catalog.title.trim() : '';
  const content = typeof catalog?.content === 'string' ? catalog.content : '';

  if (!id || !title || !content) {
    throw new Error('invalid_catalog_prompt');
  }

  const tags = Array.isArray(catalog.tags)
    ? catalog.tags.map((t) => (typeof t === 'string' ? t.trim() : '')).filter(Boolean)
    : [];

  const publishedAt =
    typeof catalog.publishedAt === 'string' && catalog.publishedAt
      ? catalog.publishedAt
      : new Date().toISOString();

  return {
    uuid: catalogLocalUuid(id),
    title,
    content,
    tags,
    createdAt: publishedAt,
  };
}

/**
 * @typedef {'imported'|'already'|'updated'} OpdImportStatus
 */

/**
 * Merge one catalog prompt into chrome.storage; detect duplicates by opd:{id} uuid.
 * @param {object} catalog
 * @returns {Promise<{ ok: true, uuid: string, status: OpdImportStatus }>}
 */
export async function importCatalogPrompt(catalog) {
  const local = catalogPromptToLocal(catalog);
  const prompts = await getPrompts();
  const existing = prompts.find((p) => p.uuid === local.uuid);

  if (existing) {
    if (isSameCatalogPrompt(existing, local)) {
      return { ok: true, uuid: local.uuid, status: 'already' };
    }
    await mergePrompts([
      {
        ...local,
        createdAt: existing.createdAt || local.createdAt,
        updatedAt: new Date().toISOString(),
      },
    ]);
    return { ok: true, uuid: local.uuid, status: 'updated' };
  }

  await mergePrompts([local]);
  return { ok: true, uuid: local.uuid, status: 'imported' };
}
