import '../platform.js';

// Firefox can show assistants before catalog data consent. Keep icon requests local.
const BUNDLED_PROVIDER_ICONS = {
  'chatgpt.com': 'openai-pg-icon.png',
  'chat.openai.com': 'openai-pg-icon.png',
  'platform.openai.com': 'openai-pg-icon.png',
  'chat.deepseek.com': 'deepseek-icon.png',
  'copilot.microsoft.com': 'copilot.png',
  'github.com': 'github-icon.png',
  'chat.mistral.ai': 'mistral.png',
  'apps.abacus.ai': 'chatllm.png',
  'perplexity.ai': 'perplexity-icon.png',
  'chat.qwen.ai': 'qwen-icon.png',
  'lmarena.ai': 'lmarena-icon.png',
};

function bundledProviderIcon(providerUrl) {
  let name;
  try { name = BUNDLED_PROVIDER_ICONS[new URL(providerUrl).hostname.replace(/^www\./, '')]; } catch (_) { /* generic icon */ }
  return OPMApi.runtime.getURL(`icons/${name || 'language.svg'}`);
}
// providerIcons.js — resolve assistant favicons with safe fallbacks

/**
 * COMMENT: Turn provider icon paths into loadable extension or remote URLs.
 * @param {string|undefined} rawIconUrl
 * @param {string|undefined} providerUrl
 * @returns {string}
 */
export function resolveProviderIconUrl(rawIconUrl, providerUrl) {
  if (OPMPlatform.isFirefox && /^(https?:|chrome-extension:)/i.test(rawIconUrl || '')) {
    return bundledProviderIcon(providerUrl);
  }
  if (rawIconUrl && /^(https?:|data:|chrome-extension:|moz-extension:)/i.test(rawIconUrl)) {
    return rawIconUrl;
  }

  if (rawIconUrl) {
    const normalized = String(rawIconUrl)
      .replace(/^(\.\.\/)+/, '')
      .replace(/^\.\//, '');
    return OPMApi.runtime.getURL(normalized);
  }

  return getFaviconFallbackForUrl(providerUrl);
}

/**
 * COMMENT: Fallback when bundled or remote favicons fail to load.
 * @param {string|undefined} providerUrl
 * @returns {string}
 */
export function getFaviconFallbackForUrl(providerUrl) {
  if (OPMPlatform.isFirefox) return bundledProviderIcon(providerUrl);
  try {
    const { hostname } = new URL(providerUrl);
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=32`;
  } catch (_) {
    return OPMApi.runtime.getURL('icons/language.svg');
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
