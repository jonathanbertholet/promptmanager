/**
 * SEO routes — robots.txt and sitemap.xml from D1 catalog.
 */

const STATIC_PATHS = ['/', '/browse', '/tags', '/about', '/about/changelog'];

/**
 * @param {string} origin
 */
export function serveRobots(origin) {
  const body = `User-agent: *
Allow: /

Sitemap: ${origin}/sitemap.xml
`;
  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

/**
 * @param {string} iso
 */
function toSitemapDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/**
 * @param {Request} request
 * @param {D1Database} db
 */
export async function serveSitemap(request, db) {
  const origin = new URL(request.url).origin;

  const { results: promptRows } = await db
    .prepare(
      `SELECT id, published_at FROM prompts WHERE deleted_at IS NULL ORDER BY published_at DESC LIMIT 5000`
    )
    .all();

  const { results: catalogTagRows } = await db
    .prepare(`SELECT tag FROM catalog_tags ORDER BY tag ASC`)
    .all();

  const tagSet = new Set((catalogTagRows || []).map((r) => String(r.tag).trim()).filter(Boolean));

  const urls = [];

  for (const path of STATIC_PATHS) {
    urls.push({ loc: `${origin}${path}`, changefreq: 'daily', priority: path === '/' ? '1.0' : '0.8' });
  }

  for (const tag of [...tagSet].sort()) {
    urls.push({
      loc: `${origin}/t/${encodeURIComponent(tag)}`,
      changefreq: 'weekly',
      priority: '0.6',
    });
  }

  for (const row of promptRows || []) {
    const lastmod = toSitemapDate(row.published_at);
    urls.push({
      loc: `${origin}/p/${encodeURIComponent(row.id)}`,
      changefreq: 'monthly',
      priority: '0.7',
      lastmod,
    });
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map((u) => {
    const lastmod = u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : '';
    return `  <url>
    <loc>${escapeXml(u.loc)}</loc>${lastmod}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`;
  })
  .join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

/**
 * @param {string} str
 */
function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
