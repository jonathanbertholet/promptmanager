/**
 * SEO helpers — meta tags, canonical URLs, Open Graph, JSON-LD.
 */

const SITE_NAME = 'Open Prompt Database';
const DEFAULT_DESCRIPTION =
  'Community prompt templates for Open Prompt Manager. Browse, search, and import prompts into your library.';

/**
 * @param {object} prompt
 * @param {string} [origin]
 */
export function promptShareMessage(prompt, origin = window.location.origin) {
  const title = String(prompt.title || 'Untitled prompt').trim();
  return `Hey, check out this prompt: ${title}`;
}

/**
 * Server-rendered SVG card for social previews.
 * @param {object} prompt
 * @param {string} [origin]
 */
export function ogImageUrl(prompt, origin = window.location.origin) {
  if (prompt?.id) {
    return `${origin}/og/p/${encodeURIComponent(prompt.id)}.svg`;
  }
  return `${origin}/og/default.svg`;
}

/**
 * @param {string} str
 * @param {number} max
 */
export function truncateForMeta(str, max = 160) {
  const t = String(str || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

/**
 * Upsert a <meta> or <link> in document head.
 * @param {string} selector
 * @param {() => HTMLElement} create
 */
function upsertHead(selector, create) {
  let el = document.querySelector(selector);
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  return el;
}

/**
 * @param {string} attr 'name' | 'property'
 * @param {string} key
 * @param {string} content
 */
function setMeta(attr, key, content) {
  const sel = `meta[${attr}="${key}"]`;
  const el = upsertHead(sel, () => {
    const m = document.createElement('meta');
    m.setAttribute(attr, key);
    return m;
  });
  el.setAttribute('content', content);
}

/**
 * @param {string} href
 */
function setCanonical(href) {
  const el = upsertHead('link[rel="canonical"]', () => {
    const l = document.createElement('link');
    l.rel = 'canonical';
    return l;
  });
  el.href = href;
}

/**
 * Default site-wide meta (static pages).
 * @param {{ title?: string, description?: string, path?: string }} [opts]
 */
export function applySiteMeta(opts = {}) {
  const origin = window.location.origin;
  const path = opts.path ?? window.location.pathname;
  const url = `${origin}${path}`;
  const title = opts.title ?? SITE_NAME;
  const description = opts.description ?? DEFAULT_DESCRIPTION;
  const image = `${origin}/og/default.svg`;

  document.title = title;
  setMeta('name', 'description', description);
  setCanonical(url);
  setMeta('property', 'og:type', 'website');
  setMeta('property', 'og:site_name', SITE_NAME);
  setMeta('property', 'og:title', title);
  setMeta('property', 'og:description', description);
  setMeta('property', 'og:url', url);
  setMeta('property', 'og:image', image);
  setMeta('name', 'twitter:card', 'summary');
  setMeta('name', 'twitter:title', title);
  setMeta('name', 'twitter:description', description);
  setMeta('name', 'twitter:image', image);
}

/**
 * Prompt detail — aligns with server-injected meta when present.
 * @param {object} prompt
 * @param {string} pageUrl
 */
export function applyPromptMeta(prompt, pageUrl) {
  const origin = window.location.origin;
  const title = `${prompt.title} — ${SITE_NAME}`;
  const description = promptShareMessage(prompt, origin);
  const image = ogImageUrl(prompt, origin);

  document.title = title;
  setMeta('name', 'description', description);
  setCanonical(pageUrl);
  setMeta('property', 'og:type', 'article');
  setMeta('property', 'og:site_name', SITE_NAME);
  setMeta('property', 'og:title', prompt.title);
  setMeta('property', 'og:description', description);
  setMeta('property', 'og:url', pageUrl);
  setMeta('property', 'og:image', image);
  setMeta('name', 'twitter:card', 'summary_large_image');
  setMeta('name', 'twitter:title', prompt.title);
  setMeta('name', 'twitter:description', description);
  setMeta('name', 'twitter:image', image);

  const existing = document.getElementById('opd-jsonld');
  if (existing) existing.remove();

  const script = document.createElement('script');
  script.id = 'opd-jsonld';
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: prompt.title,
    description,
    url: pageUrl,
    image,
    author: { '@type': 'Person', name: prompt.author },
    datePublished: prompt.publishedAt,
    keywords: (prompt.tags || []).join(', '),
  });
  document.head.appendChild(script);
}
