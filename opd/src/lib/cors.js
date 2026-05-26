/** CORS helpers for /v1 API (site + extension publish). */

const OPM_EXTENSION_ID = 'gmhaghdbihgenofhnmdbglbkbplolain';

const ALLOWED_ORIGINS = new Set([
  'https://openpromptdatabase.com',
  'http://localhost:8787',
  'http://127.0.0.1:8787',
  `chrome-extension://${OPM_EXTENSION_ID}`,
]);

/**
 * @param {Request} request
 * @returns {Record<string, string>}
 */
export function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-OPD-Token, CF-Turnstile-Response',
    'Access-Control-Max-Age': '86400',
  };

  if (!origin) {
    headers['Access-Control-Allow-Origin'] = '*';
  } else if (ALLOWED_ORIGINS.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers.Vary = 'Origin';
  }

  return headers;
}

/**
 * @param {unknown} data
 * @param {Request} request
 * @param {number} [status]
 */
export function jsonResponse(data, request, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(request),
    },
  });
}
