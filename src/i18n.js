// Semantic keys only. No English-text matching, DOM observers or global API patches.
// Shared by extension pages, isolated content scripts and the MV3 service worker.
(() => {
  'use strict';
  if (globalThis.OPMI18n) return;

  const STORAGE_KEY = 'uiLanguage';
  const DEFAULT_LANGUAGE = 'en';
  const LOCALES = ['en', 'es', 'fr', 'pt', 'zh-CN'];
  const SUPPORTED = new Set(['auto', ...LOCALES]);
  const ATTRIBUTES = { textContent: 'i18n', placeholder: 'i18nPlaceholder', title: 'i18nTitle', 'aria-label': 'i18nAriaLabel', alt: 'i18nAlt' };
  const SELECTOR = '[data-i18n],[data-i18n-placeholder],[data-i18n-title],[data-i18n-aria-label],[data-i18n-alt],[data-i18n-rich]';
  const loaded = new Map(), listeners = new Set(), roots = new Set(), missing = new Set();
  const hasDOM = typeof document !== 'undefined';
  const extensionDocument = hasDOM && (() => {
    const url = new URL(chrome.runtime.getURL(''));
    return location.protocol === url.protocol && location.host === url.host;
  })();
  const owns = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  let preference = 'auto', language = DEFAULT_LANGUAGE;
  let messages = Object.create(null), english = Object.create(null);
  let revision = 0, activation = Promise.resolve(), writes = Promise.resolve();

  function resolveLanguage(value) {
    if (LOCALES.includes(value)) return value;
    let browser = '';
    try { browser = globalThis.chrome?.i18n?.getUILanguage?.() || ''; } catch (_) { /* use navigator */ }
    browser ||= globalThis.navigator?.language || DEFAULT_LANGUAGE;
    const lower = String(browser).toLowerCase().replace(/_/g, '-');
    if (lower.startsWith('zh')) return 'zh-CN';
    if (lower.startsWith('es')) return 'es';
    if (lower.startsWith('fr')) return 'fr';
    if (lower.startsWith('pt')) return 'pt';
    return DEFAULT_LANGUAGE;
  }

  function loadMessages(locale) {
    if (!loaded.has(locale)) {
      const controller = new AbortController();
      let timer;
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error(`Locale ${locale} timed out`)); }, 3000);
      });
      const request = fetch(chrome.runtime.getURL(`locales/${locale}.json`), { signal: controller.signal })
        .then(response => {
          if (!response.ok) throw new Error(`Locale ${locale} HTTP ${response.status}`);
          return response.json();
        }).then(value => {
          if (!value || Array.isArray(value) || typeof value !== 'object'
            || !Object.keys(value).length || Object.values(value).some(text => typeof text !== 'string')) {
            throw new Error(`Invalid locale ${locale}`);
          }
          return value;
        });
      loaded.set(locale, Promise.race([request, timeout]).catch(error => {
        loaded.delete(locale); // A later language selection may retry a failed resource.
        throw error;
      }).finally(() => clearTimeout(timer)));
    }
    return loaded.get(locale);
  }

  function lookup(key) {
    if (owns(messages, key)) return messages[key];
    if (owns(english, key)) return english[key];
    return undefined;
  }

  function format(value, params = {}) {
    return value.replace(/\{([A-Za-z0-9_.-]+)\}/g, (match, name) => owns(params, name) ? String(params[name]) : match);
  }

  function t(key, params, fallback) {
    const value = lookup(key);
    if (value !== undefined) return format(value, params);
    if (!missing.has(key)) { missing.add(key); console.warn(`[OPM i18n] Missing key: ${key}`); }
    return format(fallback ?? key, params);
  }

  function elementParams(element) {
    const params = Object.create(null);
    for (const attr of element.attributes) {
      if (attr.name.startsWith('data-i18n-param-')) params[attr.name.slice(16)] = attr.value;
    }
    return params;
  }

  function applyRich(element) {
    const key = element.dataset.i18nRich;
    const slots = new Map();
    for (const node of element.querySelectorAll('[data-i18n-slot]')) {
      if (node.closest('[data-i18n-rich]') === element) slots.set(node.dataset.i18nSlot, node);
    }
    const valid = template => {
      if (typeof template !== 'string') return false;
      const names = [...template.matchAll(/\{([A-Za-z0-9_.-]+)\}/g)].map(match => match[1]);
      return names.length === slots.size && new Set(names).size === names.length && names.every(name => slots.has(name));
    };
    let template = lookup(key);
    if (!valid(template)) template = owns(english, key) ? english[key] : undefined;
    if (!valid(template)) return; // Never destroy existing links on a missing/invalid translation.
    const fragment = document.createDocumentFragment();
    let index = 0;
    for (const match of template.matchAll(/\{([A-Za-z0-9_.-]+)\}/g)) {
      fragment.append(document.createTextNode(template.slice(index, match.index)), slots.get(match[1]));
      index = match.index + match[0].length;
    }
    fragment.append(document.createTextNode(template.slice(index)));
    element.replaceChildren(fragment); // Reuse the original slot nodes, hrefs and listeners.
  }

  function applyElement(element) {
    if (!element || element.nodeType !== 1) return;
    const params = elementParams(element);
    for (const [attribute, binding] of Object.entries(ATTRIBUTES)) {
      const key = element.dataset[binding];
      if (!key || lookup(key) === undefined) continue; // Static English remains the fallback.
      const value = t(key, params);
      if (attribute === 'textContent') {
        if (element.textContent !== value) element.textContent = value;
      } else if (element.getAttribute(attribute) !== value) element.setAttribute(attribute, value);
    }
    if (element.dataset.i18nRich) applyRich(element);
  }

  // Explicit binding for UI created by JavaScript; values from users never call this API.
  function bind(element, key, params = {}, attribute = 'textContent') {
    if (!element) return element;
    const binding = ATTRIBUTES[attribute];
    if (!binding) throw new Error(`Unsupported i18n attribute: ${attribute}`);
    element.dataset[binding] = key;
    for (const [name, value] of Object.entries(params)) element.setAttribute(`data-i18n-param-${name}`, String(value));
    applyElement(element);
    return element;
  }

  function apply(root) {
    if (!hasDOM) return;
    if (!root) { if (!extensionDocument) return; root = document.documentElement; }
    applyElement(root);
    root.querySelectorAll?.(SELECTOR).forEach(applyElement);
    if (root === document) document.documentElement.lang = language;
    else if (root.nodeType === 1 && (roots.has(root) || (extensionDocument && root === document.documentElement))) root.lang = language;
  }

  function registerRoot(root) {
    if (!hasDOM || !root) return () => {};
    roots.add(root);
    apply(root);
    return () => roots.delete(root);
  }

  function notify() {
    for (const root of [...roots]) {
      if (root.isConnected) apply(root);
      else roots.delete(root);
    }
    for (const listener of [...listeners]) {
      try { Promise.resolve(listener(language)).catch(error => console.error('[OPM i18n]', error)); }
      catch (error) { console.error('[OPM i18n]', error); }
    }
  }

  function activate(value, emit = true) {
    const next = SUPPORTED.has(value) ? value : 'auto';
    const requestedLanguage = resolveLanguage(next);
    const ticket = ++revision;
    activation = (async () => {
      const [base, translated] = await Promise.allSettled([
        loadMessages(DEFAULT_LANGUAGE), loadMessages(requestedLanguage),
      ]);
      if (ticket !== revision) return;
      const fallback = base.status === 'fulfilled' ? base.value : english;
      const nextMessages = translated.status === 'fulfilled' ? translated.value : fallback;
      const actualLanguage = translated.status === 'fulfilled' ? requestedLanguage : DEFAULT_LANGUAGE;
      if (translated.status === 'rejected') console.warn('[OPM i18n] Using English fallback:', translated.reason);
      const changed = preference !== next || language !== actualLanguage || messages !== nextMessages;
      preference = next; language = actualLanguage; english = fallback; messages = nextMessages;
      if (emit && changed) notify();
    })();
    return activation;
  }

  function setLanguage(value) {
    const next = SUPPORTED.has(value) ? value : 'auto';
    // Serialize writes from this page. Storage events remain the source of cross-page changes.
    writes = writes.catch(() => {}).then(async () => {
      const before = revision;
      await chrome.storage.local.set({ [STORAGE_KEY]: next });
      if (revision === before) await activate(next);
      else await activation; // Do not overwrite a newer event when an older write finishes.
    });
    return writes;
  }

  const initialRevision = revision;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && owns(changes, STORAGE_KEY)) activate(changes[STORAGE_KEY].newValue);
  });
  const ready = (async () => {
    let stored = 'auto';
    try { stored = (await chrome.storage.local.get([STORAGE_KEY]))?.[STORAGE_KEY]; }
    catch (error) { console.warn('[OPM i18n] Using browser language:', error); }
    if (revision === initialRevision) await activate(stored, false);
    // A storage event may have overtaken the initial read or locale fetch.
    let pending;
    do { pending = activation; await pending; } while (pending !== activation);
  })();

  globalThis.OPMI18n = {
    ready, t, bind, apply, registerRoot, setLanguage, resolveLanguage,
    getLanguage: () => language,
    getPreference: () => preference,
    localizedResource: path => language === 'zh-CN' && path === 'changelog.html' ? 'locales/changelog.zh-CN.html' : path,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  };

  if (extensionDocument) {
    const start = async () => {
      try { await ready; registerRoot(document.documentElement); }
      finally { document.documentElement.removeAttribute('data-i18n-pending'); }
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
  }
})();
