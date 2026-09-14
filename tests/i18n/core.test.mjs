import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../../src/i18n.js', import.meta.url), 'utf8');
const catalogs = Object.fromEntries(['en', 'es', 'fr', 'pt', 'zh-CN'].map(locale => [locale, JSON.parse(fs.readFileSync(new URL(`../../src/locales/${locale}.json`, import.meta.url), 'utf8'))]));
const flush = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function runtime({ stored = 'auto', browser = 'en-US', get, fetch: fetcher, set } = {}) {
  const listeners = [], writes = [], requests = [];
  const chrome = {
    runtime: { getURL: path => `chrome-extension://test/${path}` },
    i18n: { getUILanguage: () => browser },
    storage: { local: {
      get: get || (async () => ({ uiLanguage: stored })),
      set: set || (async values => { writes.push(values); emit(values.uiLanguage); }),
    }, onChanged: { addListener: f => listeners.push(f) } },
  };
  const emit = value => listeners.forEach(f => f({ uiLanguage: { newValue: value } }, 'local'));
  const context = vm.createContext({ chrome, URL, AbortController, setTimeout, clearTimeout,
    console: { log() {}, warn() {}, error() {} },
    fetch: fetcher || (async url => { const locale = url.match(/\/([^/]+)\.json$/)[1]; requests.push(locale); return { ok: true, json: async () => catalogs[locale] }; }),
  });
  vm.runInContext(source, context);
  return { api: context.OPMI18n, emit, requests, writes, context };
}

test('automatic browser language and explicit overrides; locales are cached', async () => {
  const r = runtime({ browser: 'zh-TW' }); await r.api.ready;
  assert.equal(r.api.getLanguage(), 'zh-CN');
  assert.equal(r.api.t('prompt.create'), '新建提示词');
  await r.api.setLanguage('en'); assert.equal(r.api.t('prompt.create'), 'Create Prompt');
  await r.api.setLanguage('zh-CN'); assert.equal(r.requests.length, 2);
  assert.equal(r.writes.length, 2);
});

test('automatic Spanish, French and Portuguese follow the browser language', async () => {
  const spanish = runtime({ browser: 'es-MX' }); await spanish.api.ready;
  assert.equal(spanish.api.getLanguage(), 'es');
  assert.equal(spanish.api.t('prompt.create'), 'Crear prompt');
  const french = runtime({ browser: 'fr-CA' }); await french.api.ready;
  assert.equal(french.api.getLanguage(), 'fr');
  assert.equal(french.api.t('prompt.create'), 'Créer un prompt');
  const portuguese = runtime({ browser: 'pt-BR' }); await portuguese.api.ready;
  assert.equal(portuguese.api.getLanguage(), 'pt');
  assert.equal(portuguese.api.t('prompt.create'), 'Criar prompt');
});

test('only semantic keys are translated; interpolation is literal and prototype-safe', async () => {
  const r = runtime({ stored: 'zh-CN' }); await r.api.ready;
  assert.equal(r.api.t('Create Prompt'), 'Create Prompt');
  assert.equal(r.api.t('constructor'), 'constructor');
  assert.equal(r.api.t('__proto__'), '__proto__');
  assert.equal(r.api.t('provider.open', { name: '<b>$& {name}</b>' }), '打开 <b>$& {name}</b>');
  assert.equal(r.api.t('missing.key', { name: 'A' }, 'Hello {name}'), 'Hello A');
});

test('missing Chinese entries fall back per key to English', async () => {
  const r = runtime({ stored: 'zh-CN', fetch: async url => ({ ok: true, json: async () => url.includes('zh-CN') ? { 'prompt.create': '新建提示词' } : catalogs.en }) });
  await r.api.ready;
  assert.equal(r.api.t('prompt.create'), '新建提示词');
  assert.equal(r.api.t('settings.title'), 'Settings');
});

test('failed Chinese resource uses English and reports the actual display language', async () => {
  const r = runtime({ stored: 'zh-CN', fetch: async url => ({ ok: !url.includes('zh-CN'), status: 404, json: async () => catalogs.en }) });
  await r.api.ready;
  assert.equal(r.api.getLanguage(), 'en'); assert.equal(r.api.getPreference(), 'zh-CN');
  assert.equal(r.api.t('prompt.create'), 'Create Prompt');
});

test('unavailable resources do not reject initialization or rewrite unknown fallbacks', async () => {
  const r = runtime({ fetch: async () => { throw new Error('offline'); } });
  await r.api.ready; assert.equal(r.api.getLanguage(), 'en');
  assert.equal(r.api.t('prompt.create', {}, 'Create Prompt'), 'Create Prompt');
});

test('invalid catalog shape is rejected and does not poison fallback messages', async () => {
  const r = runtime({ stored: 'zh-CN', fetch: async url => ({ ok: true, json: async () => url.includes('zh-CN') ? ['broken'] : catalogs.en }) });
  await r.api.ready; assert.equal(r.api.getLanguage(), 'en');
});

test('a late initial storage read cannot overwrite a newer storage event', async () => {
  const old = deferred();
  const r = runtime({ get: () => old.promise });
  r.emit('zh-CN'); await flush(); old.resolve({ uiLanguage: 'en' }); await r.api.ready;
  assert.equal(r.api.getPreference(), 'zh-CN');
});

test('a late locale response cannot overwrite a newer language selection', async () => {
  const chinese = deferred();
  const r = runtime({ fetch: async url => url.includes('zh-CN') ? chinese.promise : { ok: true, json: async () => catalogs.en } });
  await r.api.ready; r.emit('zh-CN'); r.emit('en'); await flush();
  chinese.resolve({ ok: true, json: async () => catalogs['zh-CN'] }); await flush();
  assert.equal(r.api.getLanguage(), 'en');
});

test('an old write completion cannot undo a newer external language event', async () => {
  const pending = deferred();
  const r = runtime({ set: () => pending.promise }); await r.api.ready;
  const write = r.api.setLanguage('en'); await flush(); r.emit('zh-CN'); await flush();
  pending.resolve(); await write; assert.equal(r.api.getPreference(), 'zh-CN');
});

test('rapid local writes are serialized and end at the last requested preference', async () => {
  const r = runtime(); await r.api.ready;
  await Promise.all([r.api.setLanguage('zh-CN'), r.api.setLanguage('en'), r.api.setLanguage('zh-CN')]);
  assert.deepEqual(r.writes.map(v => v.uiLanguage), ['zh-CN', 'en', 'zh-CN']);
  assert.equal(r.api.getPreference(), 'zh-CN');
});

test('redundant language events do not notify; unsubscribed listeners stay detached', async () => {
  const r = runtime(); await r.api.ready; let notifications = 0;
  const stop = r.api.subscribe(() => { notifications++; });
  await r.api.setLanguage('en'); await r.api.setLanguage('en'); assert.equal(notifications, 1);
  stop(); await r.api.setLanguage('zh-CN'); assert.equal(notifications, 1);
});
