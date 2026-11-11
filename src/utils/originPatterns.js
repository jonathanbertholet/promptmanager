import '../platform.js';
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
 * Convert a Chrome origin pattern into a URL prefix regex.
 * @param {string} originPattern
 * @returns {RegExp}
 */
export function originPatternToRegex(originPattern) {
  const regexPattern = String(originPattern || '')
    .replace(/\\/g, '\\\\')
    .replace(/[.]/g, '\\.')
    .replace(/[*]/g, '.*');
  return new RegExp(`^${regexPattern}`);
}

/**
 * True when a page URL matches a Chrome origin / match pattern.
 * @param {string} url
 * @param {string} originPattern
 * @returns {boolean}
 */
export function urlMatchesOriginPattern(url, originPattern) {
  if (!url || !originPattern) return false;
  if (originPattern === '<all_urls>') return /^https?:/i.test(String(url));
  try {
    return originPatternToRegex(originPattern).test(String(url));
  } catch {
    return false;
  }
}

/**
 * True when a page URL matches any of the given origin patterns.
 * @param {string} url
 * @param {string[]} patterns
 * @returns {boolean}
 */
export function urlMatchesAnyOriginPattern(url, patterns) {
  if (!Array.isArray(patterns) || patterns.length === 0) return false;
  return patterns.some((pattern) => urlMatchesOriginPattern(url, pattern));
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
      const granted = await OPMApi.permissions.contains({ origins: [origin] });
      if (granted) return true;
    } catch (_) {
      // Invalid pattern — skip
    }
  }
  return false;
}
