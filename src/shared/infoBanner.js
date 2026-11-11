import '../platform.js';
/**
 * Shared info banner copy for the side panel and in-page prompt list.
 * Keep in sync with PromptUIManager.BANNER_CONFIG in content.js.
 */
import { OPD_CHANGELOG_URL } from '../opd/opdConstants.js';

/** @type {{ active: boolean, id: string, storageKey: string }} */
export const OPM_INFO_BANNER = {
  active: true,
  // COMMENT: Bump id when banner copy changes so dismissed users see the update
  id: 'info-banner-v4-community',
  storageKey: 'dismissedBanners',
};

/** @returns {string} HTML snippet for the banner body (Learn more → OPD changelog). */
export function buildInfoBannerHtml() {
  return `<span><strong data-i18n="banner.communityNew">New —</strong> <span data-i18n="banner.communityAction">Share &amp; Import Community Prompts</span> <a href="${OPD_CHANGELOG_URL}" target="_blank" rel="noopener noreferrer" class="opm-info-banner-link" data-i18n="banner.learnMore">Learn more</a></span>`;
}

export { OPD_CHANGELOG_URL };

/**
 * COMMENT: Dismissible update banner above the side panel prompt list.
 * @param {HTMLElement|null} hostEl
 */
export async function mountSidepanelInfoBanner(hostEl) {
  if (!hostEl || !OPM_INFO_BANNER.active) return;

  try {
    const stored = await OPMApi.storage.local.get([OPM_INFO_BANNER.storageKey]);
    const dismissed = stored?.[OPM_INFO_BANNER.storageKey] || [];
    if (dismissed.includes(OPM_INFO_BANNER.id)) return;
  } catch (_) {
    return;
  }

  const banner = document.createElement('div');
  banner.className = 'sidebar-info-banner';
  banner.innerHTML = `
    <div class="sidebar-info-banner-body">${buildInfoBannerHtml()}</div>
    <button type="button" class="sidebar-info-banner-close" data-i18n-aria-label="banner.dismiss" aria-label="Dismiss update banner">&times;</button>
  `;

  const closeBtn = banner.querySelector('.sidebar-info-banner-close');
  closeBtn?.addEventListener('click', async () => {
    banner.remove();
    try {
      const stored = await OPMApi.storage.local.get([OPM_INFO_BANNER.storageKey]);
      const dismissed = stored?.[OPM_INFO_BANNER.storageKey] || [];
      if (!dismissed.includes(OPM_INFO_BANNER.id)) {
        dismissed.push(OPM_INFO_BANNER.id);
        await OPMApi.storage.local.set({ [OPM_INFO_BANNER.storageKey]: dismissed });
      }
    } catch (_) { /* ignore */ }
  });

  hostEl.appendChild(banner);
  globalThis.OPMI18n?.apply?.(banner);
  hostEl.hidden = false;
}
