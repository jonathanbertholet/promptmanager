// COMMENT: Install onboarding — launcher choice, unified LLM shortcuts, sidebar launch
import { OPM_DEV_FORCE_ONBOARDING_STORAGE_KEY } from '../devFlags.js';
import { attachProviderIconFallback } from '../utils/providerIcons.js';
import { expandOriginPatterns } from '../utils/originPatterns.js';
import { OPD_CATALOG_URL, OPD_MSG } from '../opd/opdConstants.js';
import {
  requestOpdCatalogPermission,
  syncOpdCatalogAccess,
} from '../opd/opdCatalogAccess.js';
import { getPublishSettings } from '../opd/opdPublishToken.js';

/** COMMENT: ?reset=1 clears onboarding state so the in-page tooltip shows again (dev only). */
async function maybeResetOnboardingFromQuery() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has('reset')) return;
  await chrome.storage.local.set({
    onboardingCompleted: false,
    [OPM_DEV_FORCE_ONBOARDING_STORAGE_KEY]: true,
  });
}

document.addEventListener('DOMContentLoaded', function () {
  maybeResetOnboardingFromQuery().catch(console.error);
  const DISPLAY_MODE_KEY = 'displayMode';
  const DEFAULT_DISPLAY_MODE = 'hotCorner';
  const ALLOWED_DISPLAY_MODES = new Set(['standard', 'hotCorner', 'invisible']);

  // COMMENT: Cached so sidePanel.open can run on the click gesture (windows.getCurrent is async)
  let onboardingWindowId = null;
  chrome.windows.getCurrent((win) => {
    onboardingWindowId = win?.id ?? null;
  });

  /**
   * COMMENT: Wire the install-page launcher choice (hover button vs hot corner vs sidebar).
   */
  function initDisplayModePicker() {
    const section = document.getElementById('display-mode-section');
    if (!section) return;

    const radios = section.querySelectorAll('input[name="displayMode"]');
    const options = section.querySelectorAll('.custom-display-mode-option');

    const updateSelectedUI = (mode) => {
      options.forEach((option) => {
        const radio = option.querySelector('input[type="radio"]');
        option.classList.toggle('is-selected', radio?.value === mode);
      });
    };

    chrome.storage.local.get([DISPLAY_MODE_KEY], (result) => {
      const storedMode = result[DISPLAY_MODE_KEY];
      const mode = ALLOWED_DISPLAY_MODES.has(storedMode) ? storedMode : DEFAULT_DISPLAY_MODE;
      if (!ALLOWED_DISPLAY_MODES.has(storedMode)) {
        chrome.storage.local.set({ [DISPLAY_MODE_KEY]: DEFAULT_DISPLAY_MODE });
      }
      radios.forEach((radio) => {
        radio.checked = radio.value === mode;
      });
      updateSelectedUI(mode);
    });

    radios.forEach((radio) => {
      radio.addEventListener('change', () => {
        if (!radio.checked || !ALLOWED_DISPLAY_MODES.has(radio.value)) return;
        chrome.storage.local.set({ [DISPLAY_MODE_KEY]: radio.value });
        updateSelectedUI(radio.value);
      });
    });
  }

  /**
   * COMMENT: Features-section catalog link + sharing toggle (same storage as OPD settings).
   */
  function initCommunityFeatures() {
    const catalogLink = document.getElementById('community-prompts-btn');
    const shareToggle = document.getElementById('opd-share-toggle');

    if (catalogLink) {
      catalogLink.href = `${OPD_CATALOG_URL}/`;
      catalogLink.addEventListener('click', (event) => {
        event.preventDefault();
        // COMMENT: Request on this click, then open the catalog so the permission dialog stays on this tab
        requestOpdCatalogPermission()
          .then((granted) => {
            if (granted) return syncOpdCatalogAccess();
          })
          .catch(console.error)
          .finally(() => {
            chrome.tabs.create({ url: `${OPD_CATALOG_URL}/`, active: true });
          });
      });
    }

    if (!shareToggle) return;

    const applyShareState = (enabled) => {
      shareToggle.checked = Boolean(enabled);
    };

    getPublishSettings()
      .then((settings) => applyShareState(settings.enabled))
      .catch(console.error);

    shareToggle.addEventListener('change', async () => {
      const enabled = shareToggle.checked;
      if (enabled) {
        const granted = await requestOpdCatalogPermission();
        if (!granted) {
          applyShareState(false);
          return;
        }
        await syncOpdCatalogAccess();
      }

      const res = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: OPD_MSG.PUBLISH_ENABLE, enabled }, (response) => {
          resolve(response ?? { ok: false });
        });
      });
      if (!res?.ok) applyShareState(!enabled);
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync' || !changes.opdPublishEnabled) return;
      applyShareState(changes.opdPublishEnabled.newValue !== false);
    });
  }

  initDisplayModePicker();
  initCommunityFeatures();

  const providerShortcutsContainer = document.getElementById('provider-shortcuts');
  const removeAllBtn = document.getElementById('remove-all-permissions');
  const anotherWebsiteBtn = document.getElementById('another-website-btn');
  const anotherWebsiteHint = document.getElementById('another-website-hint');

  if (!providerShortcutsContainer) {
    console.error('Required container element (#provider-shortcuts) not found.');
    return;
  }

  // COMMENT: Custom sites are pinned from the sidebar on the target page — show guidance only here
  if (anotherWebsiteBtn && anotherWebsiteHint) {
    anotherWebsiteBtn.addEventListener('click', () => {
      const willShow = anotherWebsiteHint.hidden;
      anotherWebsiteHint.hidden = !willShow;
      anotherWebsiteBtn.setAttribute('aria-expanded', willShow ? 'true' : 'false');
      if (willShow) {
        anotherWebsiteHint.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  }

  /** COMMENT: Request host access in the click handler, then open tab + sidebar via the service worker. */
  function launchProviderFromOnboarding(providerKey, providerInfo) {
    return new Promise((resolve) => {
      const origins = expandOriginPatterns(providerInfo.urlPattern);
      if (!origins.length) {
        resolve({ ok: false, error: 'missing_provider' });
        return;
      }

      // COMMENT: sidePanel.open requires this click — do not await contains() first
      if (onboardingWindowId != null && chrome.sidePanel?.open) {
        chrome.sidePanel.open({ windowId: onboardingWindowId }).catch(() => {});
      }

      const finishLaunch = (permissionGranted) => {
        chrome.runtime.sendMessage(
          {
            type: 'OPM_LAUNCH_PROVIDER_ONBOARDING',
            providerKey,
            url: providerInfo.url,
            originPattern: providerInfo.urlPattern,
            permissionAlreadyGranted: permissionGranted,
          },
          (response) => {
            if (chrome.runtime.lastError) {
              resolve({ ok: false, error: chrome.runtime.lastError.message });
              return;
            }
            if (response?.error === 'permission_denied') {
              alert(`Permission denied for ${providerKey}. Allow site access in the Chrome prompt to continue.`);
            }
            resolve(response || { ok: false, error: 'no_response' });
          },
        );
      };

      const syncGrantedState = (granted) => {
        if (!granted) return;
        chrome.storage.local.get(['aiProvidersMap'], (res) => {
          const map = res?.aiProvidersMap || {};
          if (map[providerKey]) {
            map[providerKey].hasPermission = 'Yes';
            chrome.storage.local.set({ aiProvidersMap: map });
          }
        });
      };

      chrome.permissions.request({ origins }, (granted) => {
        if (chrome.runtime.lastError) {
          alert(`Could not request permission for ${providerKey}: ${chrome.runtime.lastError.message}`);
          resolve({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        if (!granted) {
          alert(`Permission denied for ${providerKey}. Allow site access in the Chrome prompt to continue.`);
          resolve({ ok: false, error: 'permission_denied' });
          return;
        }

        syncGrantedState(true);
        finishLaunch(true);
      });
    });
  }

  /** COMMENT: Render all default LLM providers as equal shortcuts (no allowed/available split). */
  function populateProviders(providersMap) {
    providerShortcutsContainer.querySelectorAll('[data-provider]').forEach((el) => el.remove());

    for (const [key, providerInfo] of Object.entries(providersMap)) {
      const iconUrl = providerInfo.iconUrl;
      const isGranted = providerInfo.hasPermission === 'Yes';

      providerShortcutsContainer.insertAdjacentHTML(
        'beforeend',
        `<button type="button" id="perm-${key}" class="custom-button custom-provider-shortcut${isGranted ? ' is-granted' : ''}"
                data-provider="${key}">
          <img src="${iconUrl}" alt="${key} icon" width="32" height="32" class="custom-rounded-circle">
          <span class="custom-mb-0">${key}</span>
        </button>`,
      );

      const element = Array.from(providerShortcutsContainer.querySelectorAll('[data-provider]'))
        .find((node) => node.dataset.provider === key);
      if (!element) continue;

      const iconEl = element.querySelector('img');
      if (iconEl) attachProviderIconFallback(iconEl, providerInfo.url);

      element.addEventListener('click', () => {
        launchProviderFromOnboarding(key, providerInfo).catch(console.error);
      });
    }

    // COMMENT: Keep "+ Another website" after the built-in provider pills
    if (anotherWebsiteBtn) {
      providerShortcutsContainer.appendChild(anotherWebsiteBtn);
    }
    if (anotherWebsiteHint) {
      providerShortcutsContainer.appendChild(anotherWebsiteHint);
    }
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.aiProvidersMap?.newValue) {
      populateProviders(changes.aiProvidersMap.newValue);
    }
  });

  chrome.storage.local.get(['aiProvidersMap'], function (result) {
    if (result.aiProvidersMap) {
      populateProviders(result.aiProvidersMap);
      return;
    }
    providerShortcutsContainer.innerHTML = '<p>No provider data found in storage.</p>';
  });

  // COMMENT: Remove all permissions handler — revokes all optional origins and resets providers map
  if (removeAllBtn) {
    removeAllBtn.addEventListener('click', () => {
      chrome.storage.local.get(['aiProvidersMap'], (res) => {
        const currentMap = res && res.aiProvidersMap ? res.aiProvidersMap : {};
        const allPatterns = Array.from(new Set(
          Object.values(currentMap)
            .flatMap((v) => expandOriginPatterns(v && v.urlPattern))
        ));

        const persistRevokedState = () => {
          const updated = {};
          for (const [key, val] of Object.entries(currentMap)) {
            updated[key] = {
              ...val,
              hasPermission: 'No',
            };
          }
          chrome.storage.local.set({
            aiProvidersMap: updated,
            pinned_inputs_v1: {},
            learned_inputs_v1: {},
          });
        };

        if (allPatterns.length === 0) {
          persistRevokedState();
          return;
        }

        chrome.permissions.remove({ origins: allPatterns }, () => {
          if (chrome.runtime.lastError) {
            console.error('Failed to remove permissions:', chrome.runtime.lastError);
            alert('Could not remove all permissions. Try again from Settings.');
            return;
          }
          persistRevokedState();
        });
      });
    });
  }

  const darkQuery = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
  const applyHeaderIcon = (dark) => {
    const headerIcon = document.getElementById('header-icon');
    if (!headerIcon) return;
    headerIcon.src = dark ? '../icons/icon-base.png' : '../icons/icon128.png';
  };
  if (darkQuery) {
    applyHeaderIcon(darkQuery.matches);
    darkQuery.addEventListener('change', (event) => applyHeaderIcon(event.matches));
  }
});
