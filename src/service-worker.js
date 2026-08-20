import { getProviders } from './llm_providers.js';
import {
  initOpdCatalogAccess,
  isAllowedOpdMessageOrigin,
  hasOpdCatalogPermission,
  syncOpdCatalogAccess,
} from './opd/opdCatalogAccess.js';
import { importCatalogPrompt } from './opd/opdImport.js';
import { notifyPromptImported } from './opd/opdClient.js';
import { isHandleAvailable, registerPublisherHandle, getPublisherStatus } from './opd/opdPublisher.js';
import { shareLocalPrompt, unpublishLocalPrompt } from './opd/opdPublish.js';
import {
  getOrCreatePublishToken,
  setPublishEnabled,
  getPublishSettings,
} from './opd/opdPublishToken.js';
import { getPrompts, onPromptsChanged, savePrompt } from './storage/promptStorage.js';
import { removePinnedForHostname } from './storage/pinnedInputStorage.js';
import { removeLearnedForHostname } from './storage/learnedInputStorage.js';
import { resolveProviderIconUrl } from './utils/providerIcons.js';
import { expandOriginPatterns, hasAnyOriginPermission } from './utils/originPatterns.js';
import {
  OPM_DEV_FORCE_ONBOARDING_STORAGE_KEY,
} from './devFlags.js';

// COMMENT: Single source of truth for dynamically injected content-script bundles
const CONTENT_SCRIPT_FILES = [
  'utils/promptInsertUtils.js',
  'handlers/inputBoxHandler.js',
  'content.styles.js',
  'content.shared.js',
  'content.js',
];

// COMMENT: Pre-injection lock — closes the race before content.js sets __OPM_INITIALIZED__
const CONTENT_SCRIPT_INJECTION_FLAG = '__openPromptManagerInjected';
const CONTENT_SCRIPT_INIT_FLAG = '__OPM_INITIALIZED__';

/**
 * COMMENT: Inject content scripts once per tab. Uses an in-page lock so concurrent
 * tab updates cannot load the bundle twice before bootstrap finishes.
 * @param {number} tabId
 * @param {string} [tabUrl]
 * @returns {Promise<boolean>}
 */
async function injectContentScriptsIfNeeded(tabId, tabUrl = '') {
  let injectionState;
  try {
    [{ result: injectionState }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: (initFlag, lockFlag) => {
        if (window[initFlag] === true || window[lockFlag]) return 'skip';
        window[lockFlag] = true;
        return 'inject';
      },
      args: [CONTENT_SCRIPT_INIT_FLAG, CONTENT_SCRIPT_INJECTION_FLAG],
    });
  } catch (error) {
    const message = error?.message || '';
    if (message.includes('Cannot access a chrome:// URL') || message.includes('No matching window')) {
      return false;
    }
    console.error(`Failed to check injection state for tab ${tabId}${tabUrl ? ` (${tabUrl})` : ''}:`, error);
    return false;
  }

  if (injectionState === 'skip') {
    return true;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: CONTENT_SCRIPT_FILES,
    });
    return true;
  } catch (injectionError) {
    // COMMENT: Clear the lock when file injection fails so a later tab update can retry.
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (lockFlag) => { delete window[lockFlag]; },
      args: [CONTENT_SCRIPT_INJECTION_FLAG],
    }).catch(() => {});

    const message = injectionError?.message || '';
    if (message.includes('Cannot access a chrome:// URL') || message.includes('No matching window')) {
      return false;
    }
    if (!message.includes('already injected')) {
      console.error(`Failed to inject script into tab ${tabId}${tabUrl ? ` (${tabUrl})` : ''}:`, injectionError);
    }
    return false;
  }
}

/**
 * COMMENT: Convert a Chrome origin pattern into a URL prefix regex.
 * @param {string} originPattern
 * @returns {RegExp}
 */
function originPatternToRegex(originPattern) {
  const regexPattern = originPattern
    .replace(/\\/g, '\\\\')
    .replace(/[.]/g, '\\.')
    .replace(/[*]/g, '.*');
  return new RegExp(`^${regexPattern}`);
}

/**
 * COMMENT: Extract hostname from a Chrome origin permission pattern.
 * @param {string} pattern
 * @returns {string|null}
 */
function patternToHostname(pattern) {
  if (!pattern || pattern === '<all_urls>') return null;
  const match = pattern.match(/^\*:\/\/([^/]+)\/\*$/);
  return match ? match[1] : null;
}

/**
 * COMMENT: Mark revoked origins in aiProvidersMap and drop matching pinned inputs.
 * @param {string[]} originPatterns
 */
async function syncStorageAfterPermissionRevoke(originPatterns) {
  if (!Array.isArray(originPatterns) || originPatterns.length === 0) return;

  const stored = await chrome.storage.local.get(['aiProvidersMap']);
  let providersMap = stored?.aiProvidersMap && typeof stored.aiProvidersMap === 'object'
    ? { ...stored.aiProvidersMap }
    : {};

  for (const pattern of originPatterns) {
    Object.entries(providersMap).forEach(([name, info]) => {
      if (info?.urlPattern === pattern || expandOriginPatterns(info?.urlPattern).includes(pattern)) {
        providersMap[name] = { ...info, hasPermission: 'No' };
      }
    });

    const hostname = patternToHostname(pattern);
    if (hostname) {
      await removePinnedForHostname(hostname).catch(() => {});
      await removeLearnedForHostname(hostname).catch(() => {});
    }
  }

  await chrome.storage.local.set({ aiProvidersMap: providersMap });
}

/**
 * COMMENT: Inject content scripts into a tab when permitted and not already initialized.
 * @param {number} tabId
 * @param {string} url
 * @param {string} originPattern
 */
async function injectIfPermittedAndNeeded(tabId, url, originPattern) {
  const hasPermission = await chrome.permissions.contains({ origins: [originPattern] });
  if (!hasPermission || !originPatternToRegex(originPattern).test(url)) return false;

  return injectContentScriptsIfNeeded(tabId, url);
}

/**
 * COMMENT: Check whether the extension can script the given page URL.
 * @param {string} url
 * @returns {Promise<boolean>}
 */
async function tabHasScriptingPermission(url) {
  if (!url || !/^https?:/i.test(url)) return false;

  if (await chrome.permissions.contains({ origins: ['<all_urls>'] })) {
    return true;
  }

  try {
    const { patternsArray } = await getProviders();
    for (const originPattern of patternsArray) {
      if (!originPatternToRegex(originPattern).test(url)) continue;
      if (await chrome.permissions.contains({ origins: [originPattern] })) {
        return true;
      }
    }

    const { hostname } = new URL(url);
    return chrome.permissions.contains({ origins: [`*://${hostname}/*`] });
  } catch (_) {
    return false;
  }
}

/**
 * COMMENT: Ensure content scripts are present on a tab before pin/status actions run.
 * @param {number} tabId
 * @param {string} url
 * @returns {Promise<boolean>}
 */
async function ensureContentScriptsForTab(tabId, url) {
  if (!(await tabHasScriptingPermission(url))) return false;
  return injectContentScriptsIfNeeded(tabId, url);
}

/**
 * COMMENT: Dispatch pin-input actions to the tab's content script (same world as InputBoxHandler).
 * @param {number} tabId
 * @param {'start'|'clear'|'reset'|'status'} action
 * @param {{ pendingPrompt?: object }} [extras]
 * @returns {Promise<object>}
 */
async function runPinInputAction(tabId, action, extras = {}) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: 'OPM_PIN_INPUT_CONTENT',
      action,
      pendingPrompt: extras.pendingPrompt,
    });
    return response || { ok: false, error: 'no_response' };
  } catch (_) {
    return { ok: false, error: 'handler_missing' };
  }
}

/**
 * COMMENT: Insert a library prompt into the tab's chat input (same handler as in-page clicks).
 * @param {number} tabId
 * @param {{ uuid?: string, title?: string, content: string }} prompt
 * @returns {Promise<object>}
 */
async function runInsertPromptAction(tabId, prompt) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: 'OPM_INSERT_PROMPT_CONTENT',
      prompt,
    });
    return response || { ok: false, error: 'no_response' };
  } catch (_) {
    return { ok: false, error: 'handler_missing' };
  }
}

// COMMENT: Track which browser windows have the extension side panel open.
const sidePanelOpenWindows = new Set();

/**
 * COMMENT: Tell permitted tabs in a window to hide or restore in-page launcher UI.
 * @param {boolean} open
 * @param {number} windowId
 */
async function broadcastSidePanelState(open, windowId) {
  if (!windowId) return;
  let tabs = [];
  try {
    tabs = await chrome.tabs.query({ windowId });
  } catch (_) {
    return;
  }

  await Promise.all(tabs.map(async (tab) => {
    if (!tab?.id || !tab.url || !/^https?:/i.test(tab.url)) return;
    if (!(await tabHasScriptingPermission(tab.url))) return;
    try {
      await ensureContentScriptsForTab(tab.id, tab.url);
      await chrome.tabs.sendMessage(tab.id, { type: 'OPM_SIDE_PANEL_STATE', open: Boolean(open) });
    } catch (_) {
      // Tab may not have a content-script listener yet — safe to ignore.
    }
  }));
}

/**
 * COMMENT: Long-lived port from sidepanel/index.html signals open/close for its window.
 */
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'opm-sidepanel') return;

  let windowId = null;
  port.onMessage.addListener((message) => {
    if (message?.type !== 'OPM_SIDEPANEL_HELLO' || !message.windowId) return;
    windowId = message.windowId;
    sidePanelOpenWindows.add(windowId);
    broadcastSidePanelState(true, windowId);
  });

  port.onDisconnect.addListener(() => {
    if (windowId == null) return;
    sidePanelOpenWindows.delete(windowId);
    broadcastSidePanelState(false, windowId);
  });
});

// COMMENT: Prefer native side-panel events when available (Chrome 138+).
if (chrome.sidePanel?.onOpened) {
  chrome.sidePanel.onOpened.addListener((info) => {
    if (!info?.windowId) return;
    sidePanelOpenWindows.add(info.windowId);
    broadcastSidePanelState(true, info.windowId);
  });
}
if (chrome.sidePanel?.onClosed) {
  chrome.sidePanel.onClosed.addListener((info) => {
    if (!info?.windowId) return;
    sidePanelOpenWindows.delete(info.windowId);
    broadcastSidePanelState(false, info.windowId);
  });
}

/**
 * COMMENT: OPD catalog import — shared by content-script bridge and external webpage messages.
 * @param {object} message
 * @param {function} sendResponse
 */
function handleOpdImportPrompt(message, sendResponse) {
  (async () => {
    try {
      const result = await importCatalogPrompt(message.prompt);
      // COMMENT: Count first-time imports only — re-import of an existing row is not a new import
      if (result?.ok && result.status === 'imported' && message.prompt?.id) {
        notifyPromptImported(message.prompt.id);
      }
      sendResponse(result);
    } catch (error) {
      sendResponse({ ok: false, error: error?.message || 'import_failed' });
    }
  })();
}

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (!isAllowedOpdMessageOrigin(sender?.url)) {
    sendResponse({ ok: false, error: 'forbidden_origin' });
    return true;
  }

  if (message?.type === 'OPD_PING') {
    sendResponse({ ok: true, version: chrome.runtime.getManifest().version });
    return true;
  }

  if (message?.type === 'OPD_IMPORT_PROMPT') {
    handleOpdImportPrompt(message, sendResponse);
    return true;
  }

  sendResponse({ ok: false, error: 'unknown_message' });
  return true;
});

// COMMENT: Optional catalog host permission → inject bridge on OPD pages (dev / fallback).
initOpdCatalogAccess();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'OPD_IMPORT_PROMPT') {
    handleOpdImportPrompt(message, sendResponse);
    return true;
  }

  if (message?.type === 'OPD_PUBLISH_STATUS') {
    (async () => {
      try {
        const status = await getPublisherStatus({
          forceSync: Boolean(message.forceSync),
        });
        sendResponse({ ok: true, ...status });
      } catch (error) {
        sendResponse({ ok: false, error: error?.message || 'status_failed' });
      }
    })();
    return true;
  }

  if (message?.type === 'OPD_PUBLISH_ENABLE') {
    (async () => {
      try {
        const enabled = Boolean(message.enabled);
        if (enabled) {
          // COMMENT: Host permission must be requested from the page click/change handler
          await getOrCreatePublishToken();
          await syncOpdCatalogAccess();
        }
        await setPublishEnabled(enabled);
        sendResponse({ ok: true });
      } catch (error) {
        sendResponse({ ok: false, error: error?.message || 'enable_failed' });
      }
    })();
    return true;
  }

  if (message?.type === 'OPD_HANDLE_AVAILABLE') {
    (async () => {
      try {
        if (!(await hasOpdCatalogPermission())) {
          sendResponse({ ok: false, available: false, error: 'permission_denied' });
          return;
        }
        const result = await isHandleAvailable(message.handle || '');
        if (!result.ok) {
          sendResponse({ ok: false, available: false, error: result.error || 'check_failed' });
          return;
        }
        sendResponse({ ok: true, ...result });
      } catch (error) {
        sendResponse({ ok: false, error: error?.message || 'check_failed' });
      }
    })();
    return true;
  }

  if (message?.type === 'OPD_PUBLISH_REGISTER') {
    (async () => {
      try {
        if (!(await hasOpdCatalogPermission())) {
          sendResponse({ ok: false, error: 'permission_denied' });
          return;
        }
        // COMMENT: Issue token for registration only — do not override the publish toggle
        await getOrCreatePublishToken();
        const result = await registerPublisherHandle(
          message.username || '',
          message.turnstileToken || ''
        );
        sendResponse(result);
      } catch (error) {
        sendResponse({ ok: false, error: error?.message || 'register_failed' });
      }
    })();
    return true;
  }

  if (message?.type === 'OPD_PUBLISH_PROMPT') {
    (async () => {
      try {
        const settings = await getPublishSettings();
        if (!settings.enabled) {
          sendResponse({ ok: false, error: 'publish_disabled' });
          return;
        }
        // COMMENT: Catalog host access is requested from the share click in the side panel
        if (!(await hasOpdCatalogPermission())) {
          sendResponse({ ok: false, error: 'permission_denied' });
          return;
        }
        const result = await shareLocalPrompt(
          message.localUuid || '',
          message.turnstileToken || ''
        );
        sendResponse(result);
      } catch (error) {
        sendResponse({ ok: false, error: error?.message || 'publish_failed' });
      }
    })();
    return true;
  }

  if (message?.type === 'OPD_PUBLISH_DELETE') {
    (async () => {
      try {
        const result = await unpublishLocalPrompt(message.localUuid || '');
        sendResponse(result);
      } catch (error) {
        sendResponse({ ok: false, error: error?.message || 'delete_failed' });
      }
    })();
    return true;
  }

  if (message?.type === 'OPM_CLOSE_EXPANDED_TAB') {
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse({ ok: false, error: 'no_tab' });
      return true;
    }
    chrome.tabs.remove(tabId)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || 'close_failed' }));
    return true;
  }

  if (message?.type === 'OPM_LAUNCH_PROVIDER_ONBOARDING') {
    (async () => {
      try {
        const { url, originPattern, permissionAlreadyGranted } = message;
        if (!url) {
          sendResponse({ ok: false, error: 'missing_provider' });
          return;
        }

        // COMMENT: Host permission must be granted from the onboarding page click handler (user gesture).
        if (!permissionAlreadyGranted) {
          if (!originPattern) {
            sendResponse({ ok: false, error: 'missing_provider' });
            return;
          }
          const granted = await hasAnyOriginPermission(originPattern);
          if (!granted) {
            sendResponse({ ok: false, error: 'permission_denied' });
            return;
          }
        }

        const providersMap = await checkProviderPermissions();
        if (providersMap && typeof providersMap === 'object') {
          await chrome.storage.local.set({ aiProvidersMap: providersMap });
        }

        const tab = await chrome.tabs.create({ url, active: true });
        if (!tab?.id) {
          sendResponse({ ok: false, error: 'tab_create_failed' });
          return;
        }

        await chrome.storage.local.set({
          onboardingCompleted: true,
        });
        await chrome.storage.local.remove(OPM_DEV_FORCE_ONBOARDING_STORAGE_KEY);

        const openSidePanel = () => {
          if (!chrome.sidePanel?.open || !tab.id) return;
          chrome.sidePanel.open({ tabId: tab.id }).catch((error) => {
            console.warn('Failed to open side panel after onboarding launch:', error);
          });
        };

        openSidePanel();
        if (tab.status !== 'complete') {
          const listener = (updatedTabId, info) => {
            if (updatedTabId !== tab.id || info.status !== 'complete') return;
            chrome.tabs.onUpdated.removeListener(listener);
            openSidePanel();
          };
          chrome.tabs.onUpdated.addListener(listener);
        }

        sendResponse({ ok: true, tabId: tab.id });
      } catch (error) {
        sendResponse({ ok: false, error: error?.message || 'launch_failed' });
      }
    })();
    return true;
  }

  if (message?.type === 'OPM_INSERT_PROMPT') {
    (async () => {
      try {
        const tab = message.tabId
          ? await chrome.tabs.get(message.tabId)
          : (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0];

        if (!tab?.id || !tab.url || !/^https?:/i.test(tab.url)) {
          sendResponse({ ok: false, error: 'no_active_tab' });
          return;
        }

        if (!(await tabHasScriptingPermission(tab.url))) {
          sendResponse({ ok: false, error: 'no_permission', url: tab.url });
          return;
        }

        if (!(await ensureContentScriptsForTab(tab.id, tab.url))) {
          sendResponse({ ok: false, error: 'inject_failed' });
          return;
        }

        let payload = message.prompt?.content
          ? {
              uuid: message.prompt.uuid,
              title: message.prompt.title,
              content: message.prompt.content,
            }
          : null;
        if (!payload) {
          const prompts = await getPrompts();
          const stored = prompts.find((item) => item.uuid === message.localUuid);
          if (!stored?.content) {
            sendResponse({ ok: false, error: 'prompt_not_found' });
            return;
          }
          payload = {
            uuid: stored.uuid,
            title: stored.title,
            content: stored.content,
          };
        }

        let result = { ok: false, error: 'handler_missing' };
        for (let attempt = 0; attempt < 4; attempt += 1) {
          if (attempt > 0) {
            await ensureContentScriptsForTab(tab.id, tab.url);
            await new Promise((resolve) => setTimeout(resolve, 60 * attempt));
          }
          result = await runInsertPromptAction(tab.id, payload);
          if (result?.ok) break;
          if (result?.error !== 'handler_missing') break;
        }
        sendResponse(result);
      } catch (error) {
        sendResponse({ ok: false, error: error?.message || 'insert_failed' });
      }
    })();
    return true;
  }

  if (message?.type !== 'OPM_PIN_INPUT') return undefined;

  (async () => {
    try {
      const tab = message.tabId
        ? await chrome.tabs.get(message.tabId)
        : (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0];

      if (!tab?.id || !tab.url || !/^https?:/i.test(tab.url)) {
        sendResponse({ ok: false, error: 'no_active_tab' });
        return;
      }

      if (!(await tabHasScriptingPermission(tab.url))) {
        sendResponse({ ok: false, error: 'no_permission', url: tab.url });
        return;
      }

      if (!(await ensureContentScriptsForTab(tab.id, tab.url))) {
        sendResponse({ ok: false, error: 'inject_failed' });
        return;
      }

      const pinExtras = message.pendingPrompt ? { pendingPrompt: message.pendingPrompt } : {};
      let result = { ok: false, error: 'handler_missing' };
      for (let attempt = 0; attempt < 4; attempt += 1) {
        if (attempt > 0) {
          await ensureContentScriptsForTab(tab.id, tab.url);
          await new Promise((resolve) => setTimeout(resolve, 60 * attempt));
        }
        result = await runPinInputAction(tab.id, message.action || 'status', pinExtras);
        if (result?.ok || result?.error === 'picker_already_active') break;
        if (result?.error !== 'handler_missing') break;
      }
      sendResponse(result);
    } catch (error) {
      sendResponse({ ok: false, error: error?.message || 'pin_action_failed' });
    }
  })();

  return true;
});

chrome.runtime.onInstalled.addListener(function (details) {
  // COMMENT: Firefox uses sidebar_action instead of chrome.sidePanel
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }
  console.log('onInstalled', details);
  // COMMENT: Rebuild providers map on install and update (but only open UI on first install)
  const shouldRebuild = ['install', 'update'].includes(details.reason);
  if (details.reason === 'install') {
    // COMMENT: Default new installs to hot-corner mode with tags enabled
    chrome.storage.local.set({ displayMode: 'hotCorner', enableTags: true }, () => {
      chrome.tabs.create({ url: 'permissions/permissions.html' });
    });
  }
  if (shouldRebuild) {
    (async () => {
      try {
        const providersMap = await checkProviderPermissions();
        console.log('Providers Map:', providersMap);
        // COMMENT: Never overwrite storage with null when permission checks fail transiently
        if (providersMap && typeof providersMap === 'object') {
          await chrome.storage.local.set({ aiProvidersMap: providersMap });
        }
      } catch (error) {
        console.error('Error:', error);
      }
    })();
  }
});


chrome.permissions.onRemoved.addListener((permissions) => {
  if (!permissions?.origins?.length) return;
  syncStorageAfterPermissionRevoke(permissions.origins).catch((error) => {
    console.error('Failed to sync storage after permission revoke:', error);
  });
});

chrome.permissions.onAdded.addListener(async (permissions) => {
  console.log('Permissions added:', permissions.origins);
  if (permissions.origins && permissions.origins.length > 0) {
    // Iterate through the newly granted origins
    for (const origin of permissions.origins) {
      try {
        // Find tabs that match the newly granted origin
        const tabs = await chrome.tabs.query({ url: origin });
        console.log(`Found ${tabs.length} tabs matching ${origin}`);

        for (const tab of tabs) {
          console.log(`Injecting scripts into tab ${tab.id} (${tab.url})`);
          await injectContentScriptsIfNeeded(tab.id, tab.url);
        }
      } catch (err) {
        console.error(`Failed to query tabs or inject script for origin ${origin}:`, err);
      }
    }
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Inject scripts when a tab finishes loading and has a URL
  if (changeInfo.status === 'complete' && tab.url) {
    try {
      if (!/^https?:/i.test(tab.url)) return;

      const canScript = await tabHasScriptingPermission(tab.url);
      if (canScript) {
        await ensureContentScriptsForTab(tabId, tab.url);
      } else {
        const { patternsArray } = await getProviders();
        for (const originPattern of patternsArray) {
          const injected = await injectIfPermittedAndNeeded(tabId, tab.url, originPattern);
          if (injected) break;
        }
      }

      // COMMENT: New documents re-init with sidebarOpen=false — hide the launcher again if the side panel is still open
      if (tab.windowId && sidePanelOpenWindows.has(tab.windowId) && (await tabHasScriptingPermission(tab.url))) {
        try {
          await chrome.tabs.sendMessage(tabId, { type: 'OPM_SIDE_PANEL_STATE', open: true });
        } catch (_) {
          // Content script may not be listening yet on this navigation
        }
      }
    } catch (err) {
      // Avoid logging errors for URLs like 'chrome://extensions/'
      if (tab.url && !tab.url.startsWith('chrome://')) {
        console.error(`Error during tab update processing for ${tab.url}:`, err);
      }
    }
  }
});

async function checkProviderPermissions() {
  try {
    // Fetch the providers list (use absolute extension URL for reliability)
    const response = await fetch(chrome.runtime.getURL('llm_providers.json'));
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const providersData = await response.json();

    const providersMap = {};

    // COMMENT: Normalize icon URLs via shared helper so local and remote paths resolve consistently.
    for (const providerInfo of providersData.llm_providers) {
      // Get provider name, URL pattern, and provider URL
      const providerName = providerInfo.name;
      const urlPattern = providerInfo.pattern;
      const providerUrl = providerInfo.url;

      // COMMENT: Grant if any listed origin is allowed (e.g. www + apex Perplexity)
      const hasPermission = await hasAnyOriginPermission(urlPattern);

      // Store the result (permission status and URL) in providersMap
      providersMap[providerName] = {
        hasPermission: hasPermission ? 'Yes' : 'No',
        urlPattern: urlPattern,
        url: providerUrl,
        iconUrl: resolveProviderIconUrl(providerInfo.icon_url, providerInfo.url)
      };
    }

    return providersMap;
  } catch (error) {
    console.error('Error checking permissions:', error);
    // COMMENT: Return an empty object so callers never persist null into storage
    return {};
  }
}

// --- CONTEXT MENU FOR PROMPT MANAGER ---

// Helper: Get all prompts via the unified manager (single source of truth)
async function getAllPrompts() {
  return await getPrompts();
}

// Create the context menu
async function createPromptContextMenu() {
  // Remove any existing menu to avoid duplicates
  chrome.contextMenus.removeAll(() => {
    // Create the parent menu
    chrome.contextMenus.create({
      id: 'open-prompt-manager',
      title: 'Open Prompt Manager',
      contexts: ['all']
    });
    // First child: "Save as prompt" – only shown when there is a text selection
    // COMMENT: This enables the flow "select text → right-click → Open Prompt Manager → Save as prompt"
    chrome.contextMenus.create({
      id: 'save-as-prompt',
      parentId: 'open-prompt-manager',
      title: 'Save new prompt',
      contexts: ['selection']
    });
    // COMMENT: Visual separator between "Save as prompt" and the list of existing prompts.
    // Only show when there is a selection, mirroring the visibility of the save item.
    chrome.contextMenus.create({
      id: 'save-separator',
      parentId: 'open-prompt-manager',
      type: 'separator',
      contexts: ['selection']
    });
    // Add a menu item for each prompt
    getAllPrompts().then(prompts => {
      prompts.forEach((prompt) => {
        chrome.contextMenus.create({
          id: 'prompt-' + prompt.uuid,
          parentId: 'open-prompt-manager',
          title: prompt.title || 'Untitled prompt',
          contexts: ['all']
        });
      });
    });
  });
}

// On install or update, create the context menu
chrome.runtime.onInstalled.addListener(() => {
  createPromptContextMenu();
});

// On startup, also create the context menu (for reloads)
chrome.runtime.onStartup.addListener(() => {
  createPromptContextMenu();
  // COMMENT: Refresh providers map on startup so icon changes and new providers propagate without reinstall
  (async () => {
    try {
      const providersMap = await checkProviderPermissions();
      if (providersMap && typeof providersMap === 'object') {
        await chrome.storage.local.set({ aiProvidersMap: providersMap });
      }
    } catch (e) {
      console.error('Failed to refresh aiProvidersMap on startup:', e);
    }
  })();
});

// Listen for prompts changes via the unified API and update the context menu
onPromptsChanged(() => {
  // COMMENT: Regenerate the context menu whenever prompts change
  createPromptContextMenu();
});

// When a context menu item is clicked
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  // Handle "Save as prompt": opens a small popup dialog prefilled with the selected text
  if (info.menuItemId === 'save-as-prompt') {
    // COMMENT: Use Chrome's built-in dialogs in the page context:
    // - prompt() to capture the title
    // - alert() to show validation error if title is empty
    try {
      if (!tab?.id) {
        console.error('Save-as-prompt requires an active page tab.');
        return;
      }
      const selected = info.selectionText || '';
      // Ask for a title using the page's built-in blocking prompt
      const [{ result: titleValue }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          return window.prompt('Enter a title for your prompt', '');
        }
      });
      const title = (titleValue || '').trim();
      if (!title) {
        // Show the requested error message if no title provided
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => { window.alert('Please add a title to your prompt.'); }
        });
        return;
      }
      // Persist the prompt using the unified storage API
      await savePrompt({ title, content: selected });
    } catch (err) {
      console.error('Failed to save prompt from selection:', err);
    }
    return;
  }
  if (info.menuItemId.startsWith('prompt-')) {
    const uuid = info.menuItemId.replace('prompt-', '');
    const prompts = await getAllPrompts();
    const prompt = prompts.find(p => p.uuid === uuid);
    if (prompt) {
      // Write the prompt content to the clipboard
      try {
        await navigator.clipboard.writeText(prompt.content);
      } catch (err) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (text) => navigator.clipboard.writeText(text),
          args: [prompt.content]
        });
      }
    }
  }
});

/**
 * COMMENT: MV3 service workers restart often — never auto-open onboarding tabs on wake.
 * Clear a stale dev flag once onboarding is already complete.
 */
async function clearStaleDevOnboardingFlag() {
  try {
    const stored = await chrome.storage.local.get([
      'onboardingCompleted',
      OPM_DEV_FORCE_ONBOARDING_STORAGE_KEY,
    ]);
    if (stored.onboardingCompleted && stored[OPM_DEV_FORCE_ONBOARDING_STORAGE_KEY]) {
      await chrome.storage.local.remove(OPM_DEV_FORCE_ONBOARDING_STORAGE_KEY);
    }
  } catch (error) {
    console.warn('Failed to clear stale onboarding dev flag:', error);
  }
}

clearStaleDevOnboardingFlag();

// --- END CONTEXT MENU ---
