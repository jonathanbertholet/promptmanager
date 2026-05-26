/**
 * Keep prompt_tags, prompts_fts, and catalog_tags in sync after publish writes.
 */
import { parseTagsJson } from './validate.js';

/**
 * @param {D1Database} db
 * @param {string} promptId
 */
export async function deletePromptTags(db, promptId) {
  await db.prepare(`DELETE FROM prompt_tags WHERE prompt_id = ?`).bind(promptId).run();
}

/**
 * @param {D1Database} db
 * @param {string} promptId
 * @param {string[]} tags
 */
export async function insertPromptTags(db, promptId, tags) {
  for (const tag of tags) {
    await db
      .prepare(`INSERT INTO prompt_tags (prompt_id, tag) VALUES (?, ?)`)
      .bind(promptId, tag)
      .run();
  }
}

/**
 * @param {D1Database} db
 * @param {string} promptId
 * @param {string} title
 * @param {string} content
 */
export async function upsertPromptFts(db, promptId, title, content) {
  await db.prepare(`DELETE FROM prompts_fts WHERE id = ?`).bind(promptId).run();
  await db
    .prepare(`INSERT INTO prompts_fts (id, title, content) VALUES (?, ?, ?)`)
    .bind(promptId, title, content)
    .run();
}

/**
 * @param {D1Database} db
 * @param {string[]} tags
 * @param {number} delta
 */
async function adjustCatalogTagCounts(db, tags, delta) {
  for (const tag of tags) {
    if (delta > 0) {
      await db
        .prepare(
          `INSERT INTO catalog_tags (tag, count) VALUES (?, ?)
           ON CONFLICT(tag) DO UPDATE SET count = count + ?`
        )
        .bind(tag, delta, delta)
        .run();
    } else if (delta < 0) {
      await db
        .prepare(`UPDATE catalog_tags SET count = MAX(0, count - 1) WHERE tag = ?`)
        .bind(tag)
        .run();
      await db.prepare(`DELETE FROM catalog_tags WHERE tag = ? AND count <= 0`).bind(tag).run();
    }
  }
}

/**
 * @param {D1Database} db
 * @param {string} promptId
 * @param {string[]} oldTags
 * @param {string[]} newTags
 */
export async function syncCatalogTagsForPrompt(db, promptId, oldTags, newTags) {
  const oldSet = new Set(oldTags);
  const newSet = new Set(newTags);
  const removed = [...oldSet].filter((t) => !newSet.has(t));
  const added = [...newSet].filter((t) => !oldSet.has(t));
  await adjustCatalogTagCounts(db, removed, -1);
  await adjustCatalogTagCounts(db, added, 1);
}

/**
 * Full tag + FTS sync for one prompt row.
 * @param {D1Database} db
 * @param {object} opts
 */
export async function syncPromptIndexes(db, opts) {
  const { promptId, title, content, tags, previousTags = [] } = opts;
  await deletePromptTags(db, promptId);
  await insertPromptTags(db, promptId, tags);
  await upsertPromptFts(db, promptId, title, content);
  await syncCatalogTagsForPrompt(db, promptId, previousTags, tags);
}

/**
 * @param {D1Database} db
 * @param {string} promptId
 */
export async function loadPromptTags(db, promptId) {
  const row = await db
    .prepare(`SELECT tags FROM prompts WHERE id = ?`)
    .bind(promptId)
    .first();
  return parseTagsJson(String(row?.tags || '[]'));
}
