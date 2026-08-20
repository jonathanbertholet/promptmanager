// Shared tag helpers — keep in sync with the classic-script copies in
// content.shared.js (TagUI / TagService cannot import ESM).

/** COMMENT: Trim + lowercase so filters and storage share one tag identity. */
export function normalizeTag(tag) {
  return typeof tag === 'string' ? tag.trim().toLowerCase() : '';
}

/** COMMENT: Unique normalized tags, first-seen order. Non-strings are dropped. */
export function uniqueNormalizedTags(tags) {
  const seen = new Set();
  const out = [];
  if (!Array.isArray(tags)) return out;
  for (const raw of tags) {
    if (typeof raw !== 'string') continue;
    const tag = normalizeTag(raw);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out;
}
