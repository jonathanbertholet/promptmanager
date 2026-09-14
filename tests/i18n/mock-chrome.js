globalThis.installMockChrome = function ({ baseUrl = 'chrome-extension://local-test/', language = 'zh-CN', seed = false } = {}) {
  const event = () => ({ listeners: [], addListener(f) { this.listeners.push(f); }, removeListener(f) { this.listeners = this.listeners.filter(x => x !== f); } });
  const onChanged = event();
  const local = { uiLanguage: language, enableTags: true };
  if (seed) {
    const prompts = [{ uuid: 'test-"uuid]', title: 'Settings', content: 'Copy\n#name#', tags: ['handle', '<b>tag</b>'], folderId: null, createdAt: '2026-01-01T00:00:00Z' }];
    Object.assign(local, {
      prompts_storage: { version: 2, prompts, folders: [] }, prompts,
      aiProvidersMap: { ChatGPT: { hasPermission: 'Yes', url: 'https://chatgpt.com/', urlPattern: '*://chatgpt.com/*', iconUrl: 'icons/icon16.png' } },
    });
  }
  function storage(data, area) {
    return {
      get(keys, cb) {
        let result;
        if (keys == null) result = { ...data };
        else {
          const list = typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys);
          result = Object.fromEntries(list.filter(k => k in data || !Array.isArray(keys) && typeof keys === 'object').map(k => [k, k in data ? data[k] : keys[k]]));
        }
        result = structuredClone(result);
        if (cb) queueMicrotask(() => cb(result));
        return Promise.resolve(result);
      },
      set(values, cb) {
        const changes = {};
        for (const [k, v] of Object.entries(values)) {
          if (JSON.stringify(data[k]) !== JSON.stringify(v)) changes[k] = { oldValue: data[k], newValue: v };
          data[k] = structuredClone(v);
        }
        queueMicrotask(() => { if (Object.keys(changes).length) for (const f of onChanged.listeners) f(changes, area); cb?.(); });
        return Promise.resolve();
      },
      remove(keys, cb) {
        for (const k of Array.isArray(keys) ? keys : [keys]) delete data[k];
        cb?.(); return Promise.resolve();
      },
    };
  }
  const dual = value => (...args) => { const cb = args.at(-1); if (typeof cb === 'function') queueMicrotask(() => cb(value)); return Promise.resolve(value); };
  globalThis.chrome = {
    i18n: { getUILanguage: () => 'en-US' },
    runtime: {
      id: 'local-test', getURL: path => baseUrl + path, getManifest: () => ({ version: '3.0.6' }),
      connect: () => ({ postMessage() {}, onMessage: event(), onDisconnect: event() }),
      sendMessage: dual({ ok: true }), onMessage: event(),
    },
    storage: { local: storage(local, 'local'), sync: storage({}, 'sync'), onChanged },
    permissions: { contains: dual(false), getAll: dual({ origins: [] }), request: dual(false), remove: dual(true) },
    tabs: { query: dual([]), getCurrent: dual(null), onActivated: event(), onUpdated: event(), create: dual({ id: 1 }), remove: dual() },
    windows: { getCurrent: dual({ id: 1 }) }, sidePanel: { open: dual() },
  };
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { async writeText(text) { globalThis.__copiedText = text; } } });
  globalThis.__nativeFunctions = { alert, confirm, fetch };
  globalThis.__storageFixture = local;
};

globalThis.recordFirstPaints = () => {
  globalThis.__firstPaints = [];
  let count = 0;
  function sample() {
    if (document.body) __firstPaints.push({
      visible: getComputedStyle(document.body).visibility !== 'hidden',
      bindings: [...document.querySelectorAll('[data-i18n]')]
        .filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden')
        .map(el => ({ key: el.dataset.i18n, text: el.textContent, params: Object.fromEntries([...el.attributes]
          .filter(a => a.name.startsWith('data-i18n-param-')).map(a => [a.name.slice(16), a.value])) })),
    });
    if (++count < 45) requestAnimationFrame(sample);
  }
  requestAnimationFrame(sample);
};
