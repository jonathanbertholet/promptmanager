/**
 * Edge caching for read-only GET /v1 responses (Cloudflare Cache API).
 */

/** @type {Record<string, number>} TTL seconds for cache key prefixes */
const TTL_BY_PREFIX = [
  ['/v1/home', 86400],
  ['/v1/tags', 3600],
  ['/v1/authors/', 120],
  ['/v1/prompts/', 300],
  ['/v1/prompts', 60],
];

/**
 * @param {string} pathname
 */
function ttlForPath(pathname) {
  for (const [prefix, ttl] of TTL_BY_PREFIX) {
    if (pathname === prefix || (prefix.endsWith('/') && pathname.startsWith(prefix))) {
      return ttl;
    }
    if (pathname.startsWith(prefix)) return ttl;
  }
  return 60;
}

/**
 * @param {Request} request
 * @param {number} ttlSeconds
 * @param {Record<string, string>} headers
 * @param {unknown} data
 */
export function jsonCachedResponse(request, ttlSeconds, headers, data) {
  const merged = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': `public, max-age=${ttlSeconds}, s-maxage=${ttlSeconds * 5}`,
    ...headers,
  };
  return new Response(JSON.stringify(data), { status: 200, headers: merged });
}

/**
 * Return cached GET JSON or compute and store.
 * @param {Request} request
 * @param {ExecutionContext} ctx
 * @param {() => Promise<Response>} produce
 */
export async function withEdgeCache(request, ctx, produce) {
  if (request.method !== 'GET') {
    return produce();
  }

  const url = new URL(request.url);
  const ttl = ttlForPath(url.pathname);
  const cache = caches.default;
  const cacheKey = new Request(url.toString(), { method: 'GET' });

  const hit = await cache.match(cacheKey);
  if (hit) {
    const res = new Response(hit.body, hit);
    res.headers.set('X-OPD-Cache', 'HIT');
    return res;
  }

  const fresh = await produce();
  if (!fresh.ok) {
    return fresh;
  }

  const headers = new Headers(fresh.headers);
  headers.set('Cache-Control', `public, max-age=${ttl}, s-maxage=${ttl * 5}`);
  headers.set('X-OPD-Cache', 'MISS');
  const toStore = new Response(fresh.body, { status: fresh.status, headers });

  ctx.waitUntil(cache.put(cacheKey, toStore.clone()));
  return toStore;
}
