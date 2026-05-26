/**
 * Open Prompt Database settings page (handle, publish toggle, catalog import).
 */
import { OPD_CATALOG_URL, OPD_MSG } from './opdConstants.js';
import {
  hasOpdCatalogPermission,
  requestOpdCatalogPermission,
  syncOpdCatalogAccess,
} from './opdCatalogAccess.js';
import {
  suggestRandomHandle,
  getOrCreatePendingUsername,
} from './opdPublisher.js';
import {
  getPublishSettings,
  setOpdPendingUsername,
} from './opdPublishToken.js';

/**
 * @param {string} type
 * @param {object} [payload]
 */
function sendOpdMessage(type, payload = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, ...payload }, (response) => {
      resolve(response ?? { ok: false, error: 'no_response' });
    });
  });
}

/**
 * @param {HTMLElement} input
 */
function normalizeHandleInput(input) {
  return String(input?.value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 32);
}

/**
 * @param {string} username
 * @returns {string}
 */
export function opdAuthorProfileUrl(username) {
  const handle = String(username || '').trim().toLowerCase();
  return `${OPD_CATALOG_URL}/u/${encodeURIComponent(handle)}`;
}

/**
 * @param {object} els
 */
async function refreshCatalogAccessUi(els) {
  const { catalogBtn, catalogEnabled, catalogStatus } = els;
  const granted = await hasOpdCatalogPermission();

  if (catalogBtn) {
    catalogBtn.hidden = granted;
  }
  if (catalogEnabled) {
    catalogEnabled.hidden = !granted;
  }
  if (catalogStatus && !catalogStatus.classList.contains('settings-status-error')) {
    catalogStatus.textContent = granted ? '' : 'Needed for one-click import on the site.';
  }
}

/**
 * @param {object} els
 * @param {string|null} username
 */
function applyHandleLockedUi(els, username) {
  const locked = Boolean(username);
  if (els.handleHint) {
    els.handleHint.hidden = locked;
  }
  if (els.handleLocked) {
    els.handleLocked.hidden = !locked;
  }
  if (locked && els.handleProfileLink) {
    const handle = String(username).toLowerCase();
    els.handleProfileLink.href = opdAuthorProfileUrl(handle);
    if (els.handleProfileText) {
      els.handleProfileText.textContent = `@${handle}`;
    }
  }
  if (els.handleEditRow) {
    els.handleEditRow.hidden = locked;
  }
  if (els.handleStatus && locked) {
    els.handleStatus.textContent = '';
    els.handleStatus.classList.remove('settings-status-error');
  }
}

/**
 * @param {object} els
 * @param {{ forceSync?: boolean }} [options]
 */
async function refreshPublishStatus(els, { forceSync = false } = {}) {
  const settings = await getPublishSettings();

  // COMMENT: Paint immediately from sync storage — no API round-trip on every page open
  applyHandleLockedUi(els, settings.username || null);
  if (els.publishToggle) {
    els.publishToggle.checked = settings.enabled;
    els.publishToggle.disabled = false;
  }

  const needsServerSync = forceSync || (settings.token && !settings.username);
  if (!needsServerSync) return;

  const res = await sendOpdMessage(OPD_MSG.PUBLISH_STATUS, { forceSync: true });
  if (!res?.ok) return;

  const username = res.username || null;
  applyHandleLockedUi(els, username);

  if (els.publishToggle) {
    els.publishToggle.checked = Boolean(res.enabled);
    els.publishToggle.disabled = false;
  }
}

/**
 * @param {object} root
 */
export function initOpdSettingsPage(root = document) {
  const els = {
    handleInput: root.getElementById('opd-handle-input'),
    handleSuggest: root.getElementById('opd-handle-suggest'),
    handleConfirm: root.getElementById('opd-handle-confirm'),
    handleStatus: root.getElementById('opd-handle-status'),
    handleEditRow: root.getElementById('opd-handle-edit-row'),
    handleHint: root.getElementById('opd-handle-hint'),
    handleLocked: root.getElementById('opd-handle-locked'),
    handleProfileLink: root.getElementById('opd-handle-profile-link'),
    handleProfileText: root.getElementById('opd-handle-profile-text'),
    publishToggle: root.getElementById('opd-publish-toggle'),
    catalogBtn: root.getElementById('opd-catalog-access-btn'),
    catalogEnabled: root.getElementById('opd-catalog-enabled'),
    catalogStatus: root.getElementById('opd-catalog-access-status'),
    catalogLink: root.getElementById('opd-browse-catalog-link'),
  };

  if (els.catalogLink) {
    els.catalogLink.href = `${OPD_CATALOG_URL}/`;
  }

  if (els.handleSuggest && els.handleInput) {
    els.handleSuggest.addEventListener('click', async () => {
      if (els.handleEditRow?.hidden) return;
      const handle = suggestRandomHandle();
      els.handleInput.value = handle;
      await setOpdPendingUsername(handle);
      if (els.handleStatus) {
        els.handleStatus.textContent = '';
        els.handleStatus.classList.remove('settings-status-error');
      }
    });
  }

  if (els.handleInput) {
    els.handleInput.addEventListener('input', async () => {
      if (els.handleEditRow?.hidden) return;
      const handle = normalizeHandleInput(els.handleInput);
      if (handle.length >= 3) {
        await setOpdPendingUsername(handle);
      }
    });
  }

  if (els.handleConfirm && els.handleInput) {
    els.handleConfirm.addEventListener('click', async () => {
      if (els.handleEditRow?.hidden) return;

      const handle = normalizeHandleInput(els.handleInput);
      if (handle.length < 3) {
        if (els.handleStatus) {
          els.handleStatus.textContent = 'Min. 3 characters.';
          els.handleStatus.classList.add('settings-status-error');
        }
        return;
      }

      els.handleConfirm.disabled = true;
      if (els.handleStatus) {
        els.handleStatus.textContent = '';
        els.handleStatus.classList.remove('settings-status-error');
      }

      const avail = await sendOpdMessage(OPD_MSG.HANDLE_AVAILABLE, { handle });
      if (!avail?.ok || !avail.available) {
        if (els.handleStatus) {
          els.handleStatus.textContent = 'Unavailable — try another.';
          els.handleStatus.classList.add('settings-status-error');
        }
        els.handleConfirm.disabled = false;
        return;
      }

      const reg = await sendOpdMessage(OPD_MSG.PUBLISH_REGISTER, { username: handle });
      if (!reg?.ok) {
        if (els.handleStatus) {
          els.handleStatus.textContent = 'Could not confirm.';
          els.handleStatus.classList.add('settings-status-error');
        }
        els.handleConfirm.disabled = false;
        return;
      }

      await refreshPublishStatus(els, { forceSync: true });
    });
  }

  if (els.publishToggle) {
    els.publishToggle.addEventListener('change', async () => {
      const enabled = els.publishToggle.checked;
      const res = await sendOpdMessage(OPD_MSG.PUBLISH_ENABLE, { enabled });
      if (!res?.ok) {
        els.publishToggle.checked = !enabled;
      }
      await refreshPublishStatus(els);
    });
  }

  if (els.catalogBtn) {
    els.catalogBtn.addEventListener('click', async () => {
      const granted = await requestOpdCatalogPermission();
      if (granted) {
        await syncOpdCatalogAccess();
        await refreshCatalogAccessUi(els);
      } else if (els.catalogStatus) {
        els.catalogStatus.textContent = 'Permission denied.';
        els.catalogStatus.classList.add('settings-status-error');
      }
    });
  }

  refreshPublishStatus(els)
    .then(async () => {
      if (els.handleEditRow?.hidden || !els.handleInput) return;
      if (!els.handleInput.value) {
        els.handleInput.value = await getOrCreatePendingUsername();
      }
    })
    .catch(console.error);

  refreshCatalogAccessUi(els).catch(console.error);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    if (
      changes.opdUsername ||
      changes.opdPublishEnabled ||
      changes.opdPublishToken ||
      changes.opdPendingUsername
    ) {
      refreshPublishStatus(els).catch(console.error);
    }
  });
}
