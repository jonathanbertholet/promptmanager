// providerIcons.js — resolve assistant favicons with safe fallbacks

/**
 * COMMENT: Turn provider icon paths into loadable extension or remote URLs.
 * @param {string|undefined} rawIconUrl
 * @param {string|undefined} providerUrl
 * @returns {string}
 */
export function resolveProviderIconUrl(rawIconUrl, providerUrl) {
  if (rawIconUrl && /^(https?:|data:|chrome-extension:)/i.test(rawIconUrl)) {
    return rawIconUrl;
  }

  if (rawIconUrl) {
    const normalized = String(rawIconUrl)
      .replace(/^(\.\.\/)+/, '')
      .replace(/^\.\//, '');
    return chrome.runtime.getURL(normalized);
  }

  return getFaviconFallbackForUrl(providerUrl);
}

/**
 * COMMENT: Fallback when bundled or remote favicons fail to load.
 * @param {string|undefined} providerUrl
 * @returns {string}
 */
export function getFaviconFallbackForUrl(providerUrl) {
  try {
    const { hostname } = new URL(providerUrl);
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=32`;
  } catch (_) {
    return chrome.runtime.getURL('icons/language.svg');
  }
}

/**
 * COMMENT: Attach a one-time error handler so broken favicons recover gracefully.
 * @param {HTMLImageElement} img
 * @param {string|undefined} providerUrl
 */
export function attachProviderIconFallback(img, providerUrl) {
  if (!img) return;

  img.addEventListener('error', () => {
    const fallback = getFaviconFallbackForUrl(providerUrl);
    if (img.src !== fallback) {
      img.src = fallback;
    }
  }, { once: true });
}
