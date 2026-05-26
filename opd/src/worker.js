/**
 * Open Prompt Database — Cloudflare Worker
 * Serves /v1 API (D1) and static site assets.
 */
import { adminBanPublisher, adminDeletePrompt } from './lib/admin.js';
import { getAuthorStats, getHome, getPrompt, listPrompts, listTags } from './lib/api.js';
import { withEdgeCache } from './lib/cache.js';
import { corsHeaders, jsonResponse } from './lib/cors.js';
import { postPromptImport } from './lib/imports.js';
import { deletePrompt, postPrompt } from './lib/publish.js';
import {
  getHandleAvailable,
  getPublisherMe,
  postPublisher,
} from './lib/publishers.js';
import { postPromptReport } from './lib/reports.js';
import {
  fetchPromptRow,
  injectPromptHtmlMeta,
  serveDefaultOgImage,
  serveOgImage,
} from './lib/og.js';
import { rowToPrompt } from './lib/validate.js';
import { serveRobots, serveSitemap } from './lib/seo.js';

/**
 * Map pretty URL paths to static HTML files (keep browser URL unchanged).
 * @param {string} pathname
 * @returns {string|null}
 */
function resolveHtmlAsset(pathname) {
  if (pathname.startsWith('/p/')) return '/prompt.html';
  if (pathname.startsWith('/t/')) return '/tag.html';
  if (pathname === '/browse' || pathname.startsWith('/browse/')) return '/browse.html';
  if (pathname.startsWith('/u/')) return '/author.html';
  if (pathname === '/tags' || pathname.startsWith('/tags/')) return '/tags.html';
  if (pathname === '/about/changelog' || pathname.startsWith('/about/changelog/')) {
    return '/changelog.html';
  }
  if (pathname === '/about' || pathname.startsWith('/about/')) return '/about.html';
  return null;
}

/**
 * @param {string} pathname
 */
function promptIdFromPath(pathname) {
  const match = pathname.match(/^\/p\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : '';
}

/**
 * Serve HTML without forwarding asset redirects (e.g. .html → extensionless).
 * @param {Fetcher} assets
 * @param {string} assetPath
 * @param {string} origin
 */
async function serveHtmlPage(assets, assetPath, origin) {
  let res = await assets.fetch(`${origin}${assetPath}`);
  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get('Location');
    if (location) {
      res = await assets.fetch(new URL(location, origin).toString());
    }
  }
  const headers = new Headers(res.headers);
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('Cache-Control', 'public, max-age=120, stale-while-revalidate=600');
  return new Response(res.body, { status: 200, headers });
}

/**
 * Prompt detail with injected OG meta for crawlers (Telegram, Slack, etc.).
 * @param {Fetcher} assets
 * @param {string} origin
 * @param {D1Database} db
 * @param {string} promptId
 */
async function servePromptPage(assets, origin, db, promptId) {
  const row = await fetchPromptRow(db, promptId);
  let res = await assets.fetch(`${origin}/prompt.html`);
  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get('Location');
    if (location) {
      res = await assets.fetch(new URL(location, origin).toString());
    }
  }

  let html = await res.text();
  if (row) {
    html = injectPromptHtmlMeta(html, rowToPrompt(row), origin);
  }

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
    },
  });
}

/**
 * @param {Request} request
 * @param {Env} env
 * @param {ExecutionContext} ctx
 */
async function handleApi(request, env, ctx) {
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  const segments = url.pathname.split('/').filter(Boolean);
  const method = request.method;

  /** Mutating routes — never edge-cached. */
  if (method === 'POST' || method === 'DELETE') {
    if (segments[0] !== 'v1') {
      return jsonResponse({ error: 'not_found' }, request, 404);
    }

    if (method === 'POST' && segments[1] === 'publishers' && segments.length === 2) {
      return postPublisher(request, env.DB, env);
    }

    if (method === 'POST' && segments[1] === 'prompts' && segments.length === 2) {
      return postPrompt(request, env.DB, env);
    }

    if (method === 'DELETE' && segments[1] === 'prompts' && segments.length === 3) {
      return deletePrompt(request, env.DB, decodeURIComponent(segments[2]));
    }

    if (
      method === 'POST' &&
      segments[1] === 'prompts' &&
      segments.length === 4 &&
      segments[3] === 'report'
    ) {
      return postPromptReport(request, env.DB, env, decodeURIComponent(segments[2]));
    }

    if (
      method === 'POST' &&
      segments[1] === 'prompts' &&
      segments.length === 4 &&
      segments[3] === 'import'
    ) {
      return postPromptImport(request, env.DB, env, decodeURIComponent(segments[2]));
    }

    if (
      method === 'DELETE' &&
      segments[1] === 'admin' &&
      segments[2] === 'prompts' &&
      segments.length === 4
    ) {
      return adminDeletePrompt(request, env.DB, env, decodeURIComponent(segments[3]));
    }

    if (
      method === 'POST' &&
      segments[1] === 'admin' &&
      segments[2] === 'publishers' &&
      segments.length === 5 &&
      segments[4] === 'ban'
    ) {
      return adminBanPublisher(request, env.DB, env, decodeURIComponent(segments[3]));
    }

    return jsonResponse({ error: 'not_found' }, request, 404);
  }

  if (method !== 'GET') {
    return jsonResponse({ error: 'method_not_allowed' }, request, 405);
  }

  return withEdgeCache(request, ctx, async () => {
    if (segments.length === 2 && segments[0] === 'v1' && segments[1] === 'home') {
      return getHome(request, env.DB);
    }

    if (segments.length === 2 && segments[0] === 'v1' && segments[1] === 'prompts') {
      return listPrompts(request, env.DB);
    }

    if (segments.length === 2 && segments[0] === 'v1' && segments[1] === 'tags') {
      return listTags(request, env.DB);
    }

    if (segments.length === 3 && segments[0] === 'v1' && segments[1] === 'authors') {
      return getAuthorStats(request, env.DB, decodeURIComponent(segments[2]));
    }

    if (
      segments.length === 4 &&
      segments[0] === 'v1' &&
      segments[1] === 'handles' &&
      segments[3] === 'available'
    ) {
      return getHandleAvailable(request, env.DB, decodeURIComponent(segments[2]), env);
    }

    if (
      segments.length === 3 &&
      segments[0] === 'v1' &&
      segments[1] === 'publishers' &&
      segments[2] === 'me'
    ) {
      return getPublisherMe(request, env.DB);
    }

    if (segments.length === 3 && segments[0] === 'v1' && segments[1] === 'prompts') {
      const id = decodeURIComponent(segments[2]);
      if (!id) {
        return jsonResponse({ error: 'invalid_id' }, request, 400);
      }
      return getPrompt(request, env.DB, id);
    }

    return jsonResponse({ error: 'not_found' }, request, 404);
  });
}

export default {
  /**
   * @param {Request} request
   * @param {Env} env
   * @param {ExecutionContext} ctx
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Canonical host: apex (www → openpromptdatabase.com)
    if (url.hostname === 'www.openpromptdatabase.com') {
      const canonical = new URL(request.url);
      canonical.hostname = 'openpromptdatabase.com';
      return Response.redirect(canonical.toString(), 301);
    }

    if (url.pathname.startsWith('/v1/')) {
      return handleApi(request, env, ctx);
    }

    if (url.pathname === '/favicon.ico') {
      return env.ASSETS.fetch(new URL('/favicon.png', url.origin));
    }

    if (url.pathname === '/robots.txt') {
      return serveRobots(url.origin);
    }

    if (url.pathname === '/sitemap.xml') {
      return serveSitemap(request, env.DB);
    }

    if (url.pathname === '/og/default.svg') {
      return serveDefaultOgImage(request, env.ASSETS);
    }

    const ogMatch = url.pathname.match(/^\/og\/p\/([^/]+)\.svg$/);
    if (ogMatch) {
      return serveOgImage(request, env.DB, decodeURIComponent(ogMatch[1]), env.ASSETS);
    }

    const htmlAsset = resolveHtmlAsset(url.pathname);
    if (htmlAsset === '/prompt.html') {
      const promptId = promptIdFromPath(url.pathname);
      if (promptId) {
        return servePromptPage(env.ASSETS, url.origin, env.DB, promptId);
      }
    }

    if (htmlAsset) {
      return serveHtmlPage(env.ASSETS, htmlAsset, url.origin);
    }

    return env.ASSETS.fetch(request);
  },
};
