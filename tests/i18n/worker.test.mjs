import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
const catalogs = Object.fromEntries(['en', 'es', 'fr', 'pt', 'zh-CN'].map(lang => [lang, JSON.parse(fs.readFileSync(new URL(`../../src/locales/${lang}.json`, import.meta.url), 'utf8'))]));
const core = fs.readFileSync(new URL('../../src/i18n.js', import.meta.url), 'utf8');
// Execute the real worker, supplying browser/storage imports through the harness.
const worker = fs.readFileSync(new URL('../../src/service-worker.js', import.meta.url), 'utf8')
  .replace(/\r\n/g, '\n')
  .replace(/^import[\s\S]*?;\n/gm, '');
const event = () => ({ listeners: [], addListener(f) { this.listeners.push(f); }, removeListener(f) { this.listeners = this.listeners.filter(x => x !== f); } });
function setup({ prompts = [{ uuid: 'a', title: 'Settings', content: 'Copy' }, { uuid: 'b', title: '', content: 'B' }], getPrompts } = {}) {
  const items = new Map(), errors = [], saves = [], scripts = [], answers = [], changes = [];
  let removes = 0;
  const chrome = {
    i18n: { getUILanguage: () => 'en-US' },
    runtime: { getURL: path => `chrome-extension://test/${path}`, onInstalled: event(), onStartup: event(), onConnect: event(), onMessage: event(), onMessageExternal: event(), lastError: null },
    storage: { local: { get: async () => ({ uiLanguage: 'zh-CN' }), set: async () => {}, remove: async () => {} }, onChanged: event() },
    contextMenus: {
      onClicked: event(),
      removeAll(cb) { removes++; queueMicrotask(() => { items.clear(); cb(); }); },
      create(item, cb) {
        queueMicrotask(() => {
          if (items.has(item.id)) chrome.runtime.lastError = { message: `Duplicate ${item.id}` };
          else items.set(item.id, item);
          cb(); chrome.runtime.lastError = null;
        });
        return item.id;
      },
    },
    action: { async setTitle({ title }) { chrome.action.title = title; } },
    sidePanel: { onOpened: event(), onClosed: event() },
    permissions: { getAll: async () => ({ origins: [] }), onRemoved: event(), onAdded: event() },
    scripting: {
      getRegisteredContentScripts: async () => [],
      async executeScript(options) { scripts.push(options); return [{ result: answers.shift() }]; },
    },
    tabs: { onUpdated: event() },
  };
  const context = vm.createContext({
    console: { log() {}, warn() {}, error(...args) { errors.push(args.join(' ')); } },
    chrome, setTimeout, clearTimeout, URL, AbortController,
    fetch: async url => ({ ok: true, json: async () => catalogs[url.match(/([^/]+)\.json$/)[1]] }),
    OPD_CATALOG_URL: 'https://openpromptdatabase.com',
    OPM_DEV_FORCE_ONBOARDING_STORAGE_KEY: 'opmDevForceOnboarding',
    initOpdCatalogAccess() {}, getPrompts: getPrompts || (async () => prompts),
    onPromptsChanged: f => changes.push(f), savePrompt: async data => saves.push(data),
  });
  vm.runInContext(core, context);
  vm.runInContext(worker + '\n globalThis.drainMenu = createPromptContextMenu;', context);
  return { context, chrome, items, errors, saves, scripts, answers, changes, get removes() { return removes; } };
}

test('one menu owner, deterministic order, translated defaults, literal user titles', async () => {
  const r = setup(); await r.context.drainMenu();
  assert.deepEqual([...r.items.keys()], ['open-prompt-manager', 'save-as-prompt', 'save-separator', 'prompt-a', 'prompt-b']);
  assert.equal(r.items.get('save-as-prompt').title, '保存为提示词');
  assert.equal(r.items.get('prompt-a').title, 'Settings');
  assert.equal(r.items.get('prompt-b').title, '未命名提示词');
  assert.equal(r.chrome.contextMenus.onClicked.listeners.length, 1);
  assert.equal(r.chrome.action.title, '打开侧边栏');
  assert.deepEqual(r.errors, []);
});

test('language changes during a delayed read settle to the newest language without duplicate IDs', async () => {
  let finish, reads = 0;
  const r = setup({ getPrompts: () => ++reads === 1 ? new Promise(resolve => { finish = resolve; }) : Promise.resolve([]) });
  const build = r.context.drainMenu();
  await r.context.OPMI18n.ready; await new Promise(resolve => setImmediate(resolve));
  await r.context.OPMI18n.setLanguage('en'); finish([]); await build; await r.context.drainMenu();
  assert.equal(r.items.get('save-as-prompt').title, 'Save new prompt');
  assert.equal(r.chrome.action.title, 'Open Sidebar');
  assert.deepEqual(r.errors, []);
});

test('bursts coalesce through the existing single menu lifecycle', async () => {
  const r = setup(); await r.context.drainMenu(); const before = r.removes;
  for (let i = 0; i < 10; i++) for (const f of r.changes) f();
  await new Promise(resolve => setTimeout(resolve, 240));
  assert.equal(r.removes, before + 1); assert.deepEqual(r.errors, []);
});

test('save-selection translates its question and preserves all selected whitespace', async () => {
  const r = setup(); await r.context.drainMenu(); r.answers.push('  New title  ');
  await r.chrome.contextMenus.onClicked.listeners[0]({ menuItemId: 'save-as-prompt', selectionText: '  Copy\n\n' }, { id: 1 });
  assert.equal(r.scripts[0].args[0], '请输入提示词标题');
  assert.equal(r.saves[0].title, 'New title'); assert.equal(r.saves[0].content, '  Copy\n\n');
});

test('cancel does not show an error or save; empty title gets a translated validation message', async () => {
  const r = setup(); await r.context.drainMenu(); const click = r.chrome.contextMenus.onClicked.listeners[0];
  r.answers.push(null); await click({ menuItemId: 'save-as-prompt', selectionText: 'A' }, { id: 1 });
  assert.equal(r.scripts.length, 1); assert.equal(r.saves.length, 0);
  r.answers.push('  '); await click({ menuItemId: 'save-as-prompt', selectionText: 'A' }, { id: 1 });
  assert.equal(r.scripts.at(-1).args[0], '请填写提示词标题。'); assert.equal(r.saves.length, 0);
});


test('ordinary worker wake and initial stored preference do not rebuild persisted menus', async () => {
  const r = setup(); await r.context.OPMI18n.ready;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(r.removes, 0);
  assert.equal(r.chrome.action.title, '打开侧边栏');
});
