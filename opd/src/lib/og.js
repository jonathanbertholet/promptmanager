/**
 * Open Graph — share copy, SVG preview cards, HTML meta injection for crawlers.
 */
import { rowToPrompt } from './validate.js';

const SITE_NAME = 'Open Prompt Database';

/** Icon block in header (OG card) */
const OG_ICON_X = 100;
const OG_ICON_Y = 110;
const OG_ICON_SIZE = 88;
/** Gap between icon and site title */
const OG_TEXT_X = OG_ICON_X + OG_ICON_SIZE + 36;

/**
 * White sparkle mark (no PNG — extension icon is a blue plate).
 * @param {number} x
 * @param {number} y
 * @param {number} size
 */
function renderOpmMarkSvg(x, y, size) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const r = size * 0.36;
  return `<path fill="#ffffff" filter="url(#shadow)" d="M${cx} ${cy - r} L${cx + r * 0.2} ${cy - r * 0.2} L${cx + r} ${cy} L${cx + r * 0.2} ${cy + r * 0.2} L${cx} ${cy + r} L${cx - r * 0.2} ${cy + r * 0.2} L${cx - r} ${cy} L${cx - r * 0.2} ${cy - r * 0.2} Z"/>`;
}

/**
 * @param {string} str
 */
export function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {string} str
 */
function escapeAttr(str) {
  return escapeXml(str).replace(/'/g, '&#39;');
}

/**
 * Friendly share / og:description (title only, no prompt body).
 * @param {{ title: string }} prompt
 */
export function promptShareMessage(prompt) {
  const title = String(prompt.title || 'Untitled prompt').trim();
  return `Hey, check out this prompt: ${title}`;
}

/**
 * @param {string} origin
 * @param {string} id
 */
export function ogImagePath(origin, id) {
  return `${origin}/og/p/${encodeURIComponent(id)}.svg`;
}

/**
 * Wrap title into SVG tspans (max chars per line).
 * @param {string} title
 * @param {number} maxLines
 */
function wrapTitleLines(title, maxLines = 3) {
  const words = title.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  const maxChars = 32;

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
    if (lines.length >= maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === 0) lines.push(title.slice(0, maxChars) || 'Prompt');
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    const last = lines[maxLines - 1];
    lines[maxLines - 1] = last.length > 28 ? `${last.slice(0, 28)}…` : `${last}…`;
  }
  return lines;
}

/**
 * Load extension icon as embedded data URI (external SVG image href is blocked by most crawlers).
 * @param {Fetcher} assets
 * @param {string} origin
 */
export async function fetchIconDataUri(assets, origin) {
  const res = await assets.fetch(`${origin}/assets/icons/icon128.png`);
  if (!res.ok) return null;
  const bytes = new Uint8Array(await res.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:image/png;base64,${btoa(binary)}`;
}

/**
 * Branded 1200×630 SVG for link previews (Telegram, Slack, etc.).
 * @param {{ title: string, author?: string }} prompt
 * @param {{ iconDataUri?: string | null }} [opts]
 */
export function buildOgImageSvg(prompt, opts = {}) {
  const titleLines = wrapTitleLines(String(prompt.title || 'Prompt'));
  const author = prompt.author ? `@${prompt.author}` : '';

  const titleSvg = titleLines
    .map((line, i) => {
      const y = 300 + i * 58;
      return `<tspan x="100" y="${y}">${escapeXml(line)}</tspan>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="${escapeAttr(prompt.title)}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4b93e0"/>
      <stop offset="45%" stop-color="#3674b5"/>
      <stop offset="100%" stop-color="#2c5282"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#1a365d" flood-opacity="0.35"/>
    </filter>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="48" y="48" width="1104" height="534" rx="28" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.18)" stroke-width="2"/>
  ${renderOpmMarkSvg(OG_ICON_X, OG_ICON_Y, OG_ICON_SIZE)}
  <text x="${OG_TEXT_X}" y="162" font-family="Helvetica, Arial, sans-serif" font-size="38" font-weight="600" fill="rgba(255,255,255,0.92)">${escapeXml(SITE_NAME)}</text>
  <text x="${OG_TEXT_X}" y="204" font-family="Helvetica, Arial, sans-serif" font-size="24" fill="rgba(255,255,255,0.72)">Community prompt for Open Prompt Manager</text>
  <text font-family="Helvetica, Arial, sans-serif" font-size="52" font-weight="700" fill="#ffffff">${titleSvg}</text>
  ${
    author
      ? `<text x="100" y="520" font-family="Helvetica, Arial, sans-serif" font-size="26" fill="rgba(255,255,255,0.78)">${escapeXml(author)}</text>`
      : ''
  }
</svg>`;
}

/**
 * Inject server-side meta so Telegram/Slack see correct preview without JS.
 * @param {string} html
 * @param {object} prompt
 * @param {string} origin
 */
export function injectPromptHtmlMeta(html, prompt, origin) {
  const pageUrl = `${origin}/p/${encodeURIComponent(prompt.id)}`;
  const shareMsg = promptShareMessage(prompt);
  const image = ogImagePath(origin, prompt.id);
  const docTitle = `${prompt.title} — ${SITE_NAME}`;

  const metaBlock = `
  <title>${escapeXml(docTitle)}</title>
  <meta name="description" content="${escapeAttr(shareMsg)}" />
  <link rel="canonical" href="${escapeAttr(pageUrl)}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="${escapeAttr(SITE_NAME)}" />
  <meta property="og:title" content="${escapeAttr(prompt.title)}" />
  <meta property="og:description" content="${escapeAttr(shareMsg)}" />
  <meta property="og:url" content="${escapeAttr(pageUrl)}" />
  <meta property="og:image" content="${escapeAttr(image)}" />
  <meta property="og:image:type" content="image/svg+xml" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeAttr(prompt.title)}" />
  <meta name="twitter:description" content="${escapeAttr(shareMsg)}" />
  <meta name="twitter:image" content="${escapeAttr(image)}" />
`;

  let out = html.replace(/<title>[^<]*<\/title>/i, '').replace(
    /<meta name="description"[^>]*>/i,
    ''
  );

  if (out.includes('<!-- opd-meta -->')) {
    out = out.replace('<!-- opd-meta -->', metaBlock);
  } else {
    out = out.replace('<head>', `<head>${metaBlock}`);
  }

  return out;
}

/**
 * @param {D1Database} db
 * @param {string} id
 */
export async function fetchPromptRow(db, id) {
  return db
    .prepare(
      `SELECT id, title, content, tags, author, published_at, updated_at, import_count
       FROM prompts WHERE id = ? AND deleted_at IS NULL`
    )
    .bind(id)
    .first();
}

/**
 * GET /og/p/:id.svg
 * @param {Request} request
 * @param {D1Database} db
 * @param {string} id
 */
/**
 * @param {Request} request
 * @param {D1Database} db
 * @param {string} id
 * @param {Fetcher} assets
 */
export async function serveOgImage(request, db, id, assets) {
  const row = await fetchPromptRow(db, id);
  if (!row) {
    return new Response('Not found', { status: 404 });
  }

  const origin = new URL(request.url).origin;
  const prompt = rowToPrompt(row);
  const iconDataUri = await fetchIconDataUri(assets, origin);
  const svg = buildOgImageSvg(prompt, { iconDataUri });

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}

/**
 * Default OG image for non-prompt pages.
 * @param {Request} request
 */
/**
 * @param {Request} request
 * @param {Fetcher} assets
 */
export async function serveDefaultOgImage(request, assets) {
  const origin = new URL(request.url).origin;
  const iconDataUri = await fetchIconDataUri(assets, origin);
  const svg = buildOgImageSvg(
    { title: 'Browse community prompts', author: '' },
    { iconDataUri }
  );
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
