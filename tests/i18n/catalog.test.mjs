import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const src = path.join(root, 'src');
const read = name => fs.readFileSync(path.join(src, name), 'utf8');
const locales = ['en', 'es', 'fr', 'pt', 'zh-CN'];
const catalogs = Object.fromEntries(locales.map(lang => [lang, JSON.parse(read(`locales/${lang}.json`))]));
const files = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
const parameters = text => [...text.matchAll(/\{([\w.-]+)\}/g)].map(match => match[1]).sort();

test('locale keys and named interpolation parameters agree', () => {
  const englishKeys = Object.keys(catalogs.en).sort();
  for (const lang of locales) {
    assert.deepEqual(Object.keys(catalogs[lang]).sort(), englishKeys, lang);
    for (const key of englishKeys) {
      assert.match(key, /^[a-z][\w]*(?:\.[\w]+)+$/);
      assert.ok(catalogs[lang][key].trim(), `${lang}: ${key}`);
      assert.deepEqual(parameters(catalogs.en[key]), parameters(catalogs[lang][key]), `${lang}: ${key}`);
    }
  }
});

test('literal semantic references in JavaScript and HTML all exist', () => {
  const prefixes = new Set(Object.keys(catalogs.en).map(k => k.split('.')[0]));
  for (const file of files(src).filter(f => /\.(js|html)$/.test(f) && !f.endsWith('/i18n.js'))) {
    const text = fs.readFileSync(file, 'utf8');
    for (const [, key] of text.matchAll(/['"]([a-z][\w]*(?:\.[\w]+)+)['"]/g)) {
      if (!prefixes.has(key.split('.')[0]) || /\.(html|js|json|css)$/.test(key)) continue;
      assert.ok(Object.hasOwn(catalogs.en, key), `${file}: ${key}`);
    }
    for (const [, key] of text.matchAll(/data-i18n(?:-(?:title|placeholder|aria-label|alt|rich))?=['"]([^'"]+)['"]/g)) {
      assert.ok(Object.hasOwn(catalogs.en, key), `${file}: ${key}`);
    }
    for (const tag of text.matchAll(/<[a-z][^>]*>/gi)) {
      const attrs = [...tag[0].matchAll(/\b(data-i18n(?:-[\w-]+)?)\s*=/g)].map(m => m[1]);
      assert.equal(new Set(attrs).size, attrs.length, `${file}: duplicate binding in ${tag[0]}`);
    }
  }
});

test('translation runtime does not inspect English text or observe host DOM', () => {
  const runtime = read('i18n.js');
  for (const forbidden of ['MutationObserver', 'createTreeWalker', 'originalText', 'data-opm-user-content']) assert.ok(!runtime.includes(forbidden), forbidden);
  assert.doesNotMatch(runtime, /(?:window|globalThis)\.(?:fetch|alert|confirm|prompt)\s*=/);
});

test('all native locale keys, entry pages, scripts and icons exist', () => {
  const m = JSON.parse(read('manifest.json'));
  assert.equal(m.manifest_version, 3);
  for (const lang of ['en', 'es', 'fr', 'pt', 'zh_CN']) {
    const native = JSON.parse(read(`_locales/${lang}/messages.json`));
    for (const [, key] of JSON.stringify(m).matchAll(/__MSG_(\w+)__/g)) assert.ok(native[key]?.message, key);
  }
  for (const name of [m.background.service_worker, m.side_panel.default_path, ...Object.values(m.icons)]) assert.ok(fs.existsSync(path.join(src, name)), name);
  const bundle = read('service-worker.js').match(/const CONTENT_SCRIPT_FILES = \[([\s\S]*?)\];/)[1];
  for (const [, name] of bundle.matchAll(/'([^']+)'/g)) assert.ok(fs.existsSync(path.join(src, name)), name);
  for (const page of ['sidepanel/index.html', 'settings.html', 'permissions/permissions.html', 'opd-settings.html']) {
    const html = read(page);
    assert.match(html, /data-i18n-pending/);
    assert.match(html, /opm-i18n-fallback/);
    for (const [, file] of html.matchAll(/<script[^>]+src="([^"]+)"/g)) assert.ok(fs.existsSync(path.resolve(src, path.dirname(page), file)), `${page}: ${file}`);
  }
});

test('Chinese changelog retains identifiers and valid variable examples', () => {
  const text = read('locales/changelog.zh-CN.html');
  assert.doesNotMatch(text, /U界面D|Material 界面|#变量名#|页面内 界面/);
  assert.match(text, /UUID/); assert.match(text, /Material UI/); assert.match(text, /#name#/);
});
