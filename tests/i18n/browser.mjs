import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const mock = read('tests/i18n/mock-chrome.js');
const checks = read('tests/i18n/browser-checks.js');
const hostHtml = '<!doctype html><html lang="en"><head><meta charset="UTF-8"></head><body><main><span id="host-text">Settings Copy</span><span id="host-key" data-i18n="prompt.create">Create Prompt</span><textarea id="chat"></textarea></main></body></html>';
const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  response.setHeader('Access-Control-Allow-Origin', '*');
  if (pathname === '/host.html') { response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(hostHtml); return; }
  const file = path.resolve(root, '.' + decodeURIComponent(pathname));
  if (!file.startsWith(root) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404); response.end(); return; }
  response.setHeader('Content-Type', (types[path.extname(file)] || 'application/octet-stream') + '; charset=utf-8');
  const send = () => response.end(fs.readFileSync(file));
  // Force multiple paint opportunities before translation; test the first visible frame.
  if (/\/locales\/.*\.json$/.test(file)) setTimeout(send, 140);
  else send();
});
await new Promise(resolve => server.listen(0, '0.0.0.0', resolve));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;
const other = `http://localhost:${port}`;
const screenshots = path.join(root, 'i18n-screenshots');
fs.mkdirSync(screenshots, { recursive: true });
const passed = [], failed = [];
let browser;

async function run(name, isHost = false) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.setDefaultTimeout(15000);
  await page.setViewport({ width: name === 'sidepanel/index.html' ? 420 : 1100, height: 850 });
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = request.url();
    if (url.startsWith(base + '/') || url.startsWith(other + '/') || url.startsWith('data:')) request.continue();
    else request.abort(); // No accounts, external sites, catalog requests or telemetry.
  });
  await page.evaluateOnNewDocument(mock + `\ninstallMockChrome({ baseUrl: ${JSON.stringify((isHost ? other : base) + '/src/')}, seed: true }); recordFirstPaints();`);
  try {
    await page.goto(isHost ? `${base}/host.html` : `${base}/src/${name}`, { waitUntil: 'load' });
    if (isHost) {
      for (const file of ['platform.js', 'content.boot.js', 'i18n.js', 'utils/promptInsertUtils.js', 'handlers/inputBoxHandler.js', 'content.styles.js', 'content.shared.js', 'content.js']) {
        await page.addScriptTag({ url: `${other}/src/${file}` });
      }
      await page.waitForSelector('#opm-root');
    }
    await page.addScriptTag({ content: checks });
    const results = await page.evaluate(({ name, isHost }) => isHost ? runHostChecks() : runPageChecks(name), { name, isHost });
    assert.deepEqual(errors, [], `${name}: uncaught page errors`);
    passed.push(...results);
    for (const result of results) console.log('PASS ' + result);
  } catch (error) {
    failed.push({ name, error: error.stack || String(error), pageErrors: errors });
    console.error('FAIL ' + name, error, errors);
  } finally {
    await page.screenshot({ path: path.join(screenshots, name.replace(/[^a-z0-9.-]/gi, '_') + '.png'), fullPage: true }).catch(() => {});
    await page.close();
  }
}

try {
  browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox'],
  });
  for (const name of ['sidepanel/index.html?expanded=1', 'sidepanel/index.html', 'settings.html', 'permissions/permissions.html', 'opd-settings.html']) await run(name);
  await run('host', true);
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
  fs.writeFileSync(path.join(root, 'i18n-browser-results.json'), JSON.stringify({ passed, failed }, null, 2) + '\n');
}
console.log(`${passed.length} browser checks passed, ${failed.length} failed surfaces`);
if (failed.length) process.exitCode = 1;
