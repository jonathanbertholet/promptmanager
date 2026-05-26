/**
 * Static nav markup for HTML prerender (icons inlined — keep in sync with opd-icons.js).
 * Used by scripts/build-css.mjs; do not import in the browser bundle.
 */

export const CHROME_STORE_URL =
  'https://chromewebstore.google.com/detail/open-prompt-manager/gmhaghdbihgenofhnmdbglbkbplolain';

const ICONS = {
  search:
    '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>',
  dark_mode:
    '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/></svg>',
  menu: '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>',
  expand_more:
    '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d="M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z"/></svg>',
  apps: '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d="M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm0 6h4v-4h-4v4zm0 6h4v-4h-4v4z"/></svg>',
};

function icon(name, className = 'opd-icon') {
  return `<span class="${className}" aria-hidden="true">${ICONS[name] || ''}</span>`;
}

/** Nav inner HTML (nav bar + spacer) — no active state; JS sets .is-active on hydrate. */
export function buildNavShellHtml() {
  return `
    <nav class="opd-nav-bar" aria-label="Main navigation">
      <div class="opd-nav-bar-inner">
        <a href="/" class="opd-nav-brand">
          <img src="/assets/icons/icon128.png" alt="" width="26" height="26" />
          <span class="opd-nav-brand-text">
            <span class="opd-nav-brand-title">Open Prompt Database</span>
            <span class="opd-nav-brand-sub">Community catalog for Open Prompt Manager</span>
          </span>
        </a>

        <div class="opd-nav-menu" id="opd-nav-menu">
          <a href="/" class="opd-nav-item">Search</a>
          <a href="/browse" class="opd-nav-item">Library</a>

          <div class="opd-nav-group" data-nav-group="tags">
            <button type="button" class="opd-nav-group-summary" aria-expanded="false" aria-haspopup="true">
              <span>Tags</span>
              <span class="opd-nav-chevron">${icon('expand_more')}</span>
            </button>
            <div class="opd-mega-panel" hidden>
              <div class="opd-mega-shell">
                <div class="opd-mega-intro">
                  <span class="opd-mega-eyebrow">Browse</span>
                  <p class="opd-mega-title">Tags</p>
                  <p class="opd-mega-description">Jump into popular categories or open the full directory grouped by letter.</p>
                </div>
                <div class="opd-mega-body">
                  <div class="opd-mega-tag-grid" id="opd-mega-tags" aria-live="polite"></div>
                  <div class="opd-mega-footer">
                    <a href="/tags" class="opd-mega-action">
                      ${icon('apps')}
                      See all tags
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="opd-nav-group" data-nav-group="about">
            <button type="button" class="opd-nav-group-summary" aria-expanded="false" aria-haspopup="true">
              <span>About</span>
              <span class="opd-nav-chevron">${icon('expand_more')}</span>
            </button>
            <div class="opd-mega-panel" hidden>
              <div class="opd-mega-shell opd-mega-shell--compact">
                <div class="opd-mega-intro">
                  <span class="opd-mega-eyebrow">About</span>
                  <p class="opd-mega-title">Open Prompt Database</p>
                  <p class="opd-mega-description">How this catalog works, trust &amp; safety, and project links.</p>
                </div>
                <div class="opd-mega-body">
                  <div class="opd-mega-links opd-mega-links--stacked" id="opd-mega-about-links"></div>
                </div>
              </div>
            </div>
          </div>

          <div class="opd-nav-menu-footer" aria-label="Preferences and extension">
            <button type="button" class="opd-nav-drawer-btn" data-opd-theme-toggle aria-label="Switch theme">
              <span class="opd-nav-drawer-btn-icon" aria-hidden="true">${icon('dark_mode')}</span>
              <span>Theme</span>
            </button>
            <a href="${CHROME_STORE_URL}" class="opd-chrome-cta opd-chrome-cta--drawer" target="_blank" rel="noopener noreferrer">
              <span class="opd-chrome-cta-icon-wrap" aria-hidden="true">
                <img src="/assets/icons/chrome.svg?v=2" class="opd-chrome-cta-icon" width="22" height="22" alt="" />
              </span>
              <span class="opd-chrome-cta-label">Get Chrome Extension</span>
            </a>
          </div>
        </div>

        <div class="opd-nav-end">
          <div class="opd-nav-actions opd-nav-actions--bar">
            <button type="button" class="opd-nav-icon-btn" id="opd-search-toggle" aria-label="Search prompts" title="Search">
              ${icon('search')}
            </button>
            <button type="button" class="opd-nav-icon-btn" data-opd-theme-toggle aria-label="Switch theme">
              ${icon('dark_mode')}
            </button>
            <a href="${CHROME_STORE_URL}" class="opd-chrome-cta" target="_blank" rel="noopener noreferrer" title="Chrome Extension">
              <span class="opd-chrome-cta-icon-wrap" aria-hidden="true">
                <img src="/assets/icons/chrome.svg?v=2" class="opd-chrome-cta-icon" width="22" height="22" alt="" />
              </span>
              <span class="opd-chrome-cta-label">Chrome Extension</span>
            </a>
          </div>
          <button
            type="button"
            class="opd-nav-toggle"
            id="opd-nav-toggle"
            aria-expanded="false"
            aria-controls="opd-nav-menu"
            aria-label="Open menu"
          >
            ${icon('menu')}
          </button>
        </div>
      </div>
    </nav>
    <div class="opd-nav-spacer" aria-hidden="true"></div>
  `.trim();
}
