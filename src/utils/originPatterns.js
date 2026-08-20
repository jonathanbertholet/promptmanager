/**
 * Split comma-separated Chrome origin patterns used in llm_providers.json.
 * @param {string} pattern
 * @returns {string[]}
 */
export function expandOriginPatterns(pattern) {
  return String(pattern || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * True when any of the origin patterns is already granted.
 * @param {string|string[]} patternOrList
 * @returns {Promise<boolean>}
 */
export async function hasAnyOriginPermission(patternOrList) {
  const origins = Array.isArray(patternOrList)
    ? patternOrList
    : expandOriginPatterns(patternOrList);
  for (const origin of origins) {
    try {
      const granted = await chrome.permissions.contains({ origins: [origin] });
      if (granted) return true;
    } catch (_) {
      // Invalid pattern — skip
    }
  }
  return false;
}
