/* Shared by classic content scripts, extension pages, and background modules. */
(() => {
  if (globalThis.OPMPlatform?.api?.runtime) return;

  const callbackApi = globalThis.chrome;
  // getBrowserInfo is unavailable in content scripts; the resource scheme works
  // in every extension context, including Firefox's isolated content-script world.
  const nativeApi = globalThis.browser || callbackApi;
  if (!nativeApi?.runtime?.getURL) return;
  const isFirefox = nativeApi.runtime.getURL('').startsWith('moz-extension:');
  const promiseApi = isFirefox ? globalThis.browser : callbackApi;
  if (!promiseApi?.runtime) return;

  // Firefox's chrome namespace supplies callbacks; its browser namespace supplies
  // promises. Dispatch synchronously so permission/sidebar calls retain the click.
  function wrapApi(callbackObject, promiseObject) {
    const cache = new Map();
    return new Proxy({}, {
      get(_target, key) {
        if (key === 'lastError') return callbackObject?.lastError;
        const value = promiseObject?.[key] ?? callbackObject?.[key];
        if (value == null || typeof value !== 'object' && typeof value !== 'function') return value;
        if (!cache.has(key)) {
          cache.set(key, typeof value === 'function'
            ? (...args) => {
              const owner = typeof args[args.length - 1] === 'function'
                ? callbackObject ?? promiseObject
                : promiseObject ?? callbackObject;
              return owner[key](...args);
            }
            : wrapApi(callbackObject?.[key], promiseObject?.[key]));
        }
        return cache.get(key);
      },
    });
  }

  // Chrome retains its native API object and behavior.
  const api = isFirefox ? wrapApi(callbackApi, promiseApi) : callbackApi;
  const manifest = api.runtime.getManifest?.() || {};
  const chromeStoreUrl = 'https://chromewebstore.google.com/detail/open-prompt-manager/gmhaghdbihgenofhnmdbglbkbplolain';
  const firefoxInstallUrl = manifest.homepage_url || 'https://github.com/jonathanbertholet/promptmanager/releases';
  const publishData = ['authenticationInfo', 'websiteContent'];
  let presencePort = null;
  let presenceStopped = false;

  const platform = {
    api,
    isFirefox,
    storeUrl: isFirefox ? firefoxInstallUrl : chromeStoreUrl,
    getDefaultShortcut() {
      if (isFirefox) return { key: ' ', modifier: 'ctrlKey', requiresShift: true };
      const isMac = globalThis.navigator?.platform?.toUpperCase().includes('MAC');
      return { key: isMac ? 'p' : 'm', modifier: isMac ? 'metaKey' : 'ctrlKey', requiresShift: Boolean(isMac) };
    },
    openSidebar(options = {}) {
      if (isFirefox) return promiseApi.sidebarAction.open();
      if (api.sidePanel?.open) return api.sidePanel.open(options);
      return Promise.resolve();
    },
    configureToolbar() {
      if (isFirefox) {
        // toggle() must be called directly from the toolbar's user-action handler.
        api.action.onClicked.addListener(() => {
          promiseApi.sidebarAction.toggle().catch(error => console.warn('[OPM] Sidebar:', error));
        });
      } else {
        api.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true })
          .catch(error => console.warn('[OPM] Side panel:', error));
      }
    },
    publishPermissionRequest(origins) {
      return isFirefox ? { origins, data_collection: publishData } : { origins };
    },
    async hasPublishDataPermission() {
      return !isFirefox || api.permissions.contains({ data_collection: publishData });
    },
    maintainSidebarPresence() {
      if (presencePort || presenceStopped || typeof window === 'undefined') return;
      if (new URLSearchParams(window.location.search).get('expanded') === '1') return;
      if (isFirefox && !promiseApi.extension.getViews({ type: 'sidebar' }).includes(window)) return;
      api.windows.getCurrent().then(win => {
        if (presenceStopped || presencePort) return;
        const port = api.runtime.connect({ name: 'opm-sidepanel' });
        presencePort = port;
        port.postMessage({ type: 'OPM_SIDEPANEL_HELLO', windowId: win.id });
        port.onDisconnect.addListener(() => {
          void api.runtime.lastError;
          presencePort = null;
          if (!presenceStopped) setTimeout(() => platform.maintainSidebarPresence(), 250);
        });
      }).catch(error => console.warn('[OPM] Sidebar presence:', error));
    },
  };

  globalThis.OPMApi = api;
  globalThis.OPMPlatform = platform;
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', () => {
      presenceStopped = true;
      presencePort?.disconnect?.();
    }, { once: true });
    document.addEventListener('DOMContentLoaded', () => {
      document.querySelectorAll('[data-extension-store]').forEach(link => { link.href = platform.storeUrl; });
      if (isFirefox && location.protocol === 'moz-extension:') platform.maintainSidebarPresence();
    }, { once: true });
  }
})();
