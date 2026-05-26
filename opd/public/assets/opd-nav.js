/**
 * Site header — mega-menus, search, Chrome Extension CTA.
 */
import { apiGet, escapeHtml } from './opd-common.js';
import { opdIcon } from './opd-icons.js';
import { applySiteMeta } from './opd-seo.js';
import { renderMegaTagsSkeleton } from './opd-skeleton.js';
import { syncThemeToggleButtons } from './opd-theme.js';

const MEGA_POPULAR_LIMIT = 8;

const CHROME_STORE_URL =
  'https://chromewebstore.google.com/detail/open-prompt-manager/gmhaghdbihgenofhnmdbglbkbplolain';

/** About mega-menu entries (each row has an icon). */
const ABOUT_LINKS = [
  {
    href: '/about',
    label: 'About this catalog',
    description: 'What Open Prompt Database is and how to use it safely.',
    iconKey: 'info',
  },
  {
    href: '/about/changelog',
    label: 'Changelog',
    description: 'Site updates and Open Prompt Manager releases.',
    iconKey: 'notes',
  },
  {
    href: 'https://github.com/jonathanbertholet/promptmanager',
    label: 'GitHub repository',
    description: 'Source code, issues, and contributions.',
    external: true,
    icon: '/assets/icons/md-github.svg',
  },
  {
    href: 'https://buymeacoffee.com/jonathanbertholet',
    label: 'Buy me a coffee',
    description: 'Support the Open Prompt Manager project.',
    external: true,
    icon: '/assets/icons/coffee.svg',
  },
];

/** Lazy-loaded search module. */
let searchModule = null;

/**
 * Load search on first use (keeps initial bundle smaller).
 */
async function ensureSearch() {
  if (!searchModule) {
    searchModule = await import('./opd-search.js');
    searchModule.initSearch();
  }
  return searchModule;
}

function wireSearchToggle() {
  const toggle = document.getElementById('opd-search-toggle');
  toggle?.addEventListener('click', async () => {
    const search = await ensureSearch();
    if (document.body.classList.contains('opd-search-open')) {
      search.closeSearch();
    } else {
      search.openSearch();
    }
  });
}

/** True when the hamburger drawer is used (mega panels accordion in-menu). */
function isMobileNavLayout() {
  return window.matchMedia('(max-width: 900px)').matches;
}

function wireNavGroup(group) {
  const trigger = group.querySelector('.opd-nav-group-summary');
  const panel = group.querySelector('.opd-mega-panel');
  if (!trigger || !panel) return;

  let closeTimer = null;

  const open = () => {
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
    document.querySelectorAll('.opd-nav-group.is-open').forEach((g) => {
      if (g !== group) {
        g.classList.remove('is-open');
        g.querySelector('.opd-nav-group-summary')?.setAttribute('aria-expanded', 'false');
      }
    });
    group.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');
  };

  const scheduleClose = () => {
    closeTimer = setTimeout(() => {
      group.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
      closeTimer = null;
    }, 140);
  };

  // Desktop only — hover opens floating mega panel; mobile uses click accordion in the drawer.
  group.addEventListener('mouseenter', () => {
    if (!isMobileNavLayout()) open();
  });
  group.addEventListener('mouseleave', () => {
    if (!isMobileNavLayout()) scheduleClose();
  });
  panel.addEventListener('mouseenter', () => {
    if (!isMobileNavLayout() && closeTimer) clearTimeout(closeTimer);
  });
  panel.addEventListener('mouseleave', () => {
    if (!isMobileNavLayout()) scheduleClose();
  });

  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (group.classList.contains('is-open')) {
      group.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
    } else {
      open();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && group.classList.contains('is-open')) {
      group.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
    }
  });
}

/** Mobile drawer — open/close main nav menu (idempotent; safe across hydrate passes). */
function wireMobileNav() {
  const toggle = document.getElementById('opd-nav-toggle');
  const menu = document.getElementById('opd-nav-menu');
  if (!toggle || !menu) return;
  // Per-toggle guard so hydrateSiteNav can run again without duplicate listeners.
  if (toggle.dataset.opdMobileWired === '1') return;
  toggle.dataset.opdMobileWired = '1';

  const setOpen = (open) => {
    document.body.classList.toggle('opd-nav-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    toggle.innerHTML = opdIcon(open ? 'close' : 'menu');
    if (!open) {
      document.querySelectorAll('.opd-nav-group.is-open').forEach((g) => {
        g.classList.remove('is-open');
        g.querySelector('.opd-nav-group-summary')?.setAttribute('aria-expanded', 'false');
      });
    }
  };

  // stopPropagation avoids the capture-phase outside-click handler closing on the same tap.
  toggle.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(!document.body.classList.contains('opd-nav-open'));
  });

  menu.querySelectorAll('.opd-nav-item, .opd-mega-panel a').forEach((link) => {
    link.addEventListener('click', () => setOpen(false));
  });

  if (!document.documentElement.dataset.opdNavEscapeWired) {
    document.documentElement.dataset.opdNavEscapeWired = '1';
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.body.classList.contains('opd-nav-open')) {
        setOpen(false);
      }
    });
  }

  if (!document.documentElement.dataset.opdNavOutsideWired) {
    document.documentElement.dataset.opdNavOutsideWired = '1';
    document.addEventListener(
      'click',
      (e) => {
        if (!document.body.classList.contains('opd-nav-open')) return;
        if (e.target.closest('.opd-nav-bar') || e.target.closest('.opd-nav-menu')) return;
        setOpen(false);
      },
      true
    );
  }
}

/**
 * @param {HTMLElement} container
 * @param {{ href: string, label: string, description: string, external?: boolean, icon?: string, iconMaterial?: string }[]} links
 */
function renderMegaLinks(container, links) {
  container.innerHTML = '';
  for (const link of links) {
    const a = document.createElement('a');
    a.className = 'opd-mega-link';
    a.href = link.href;
    if (link.external) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }
    // Material symbol or image icon for every about link
    let iconHtml = '';
    if (link.iconKey) {
      iconHtml = opdIcon(link.iconKey, 'opd-mega-link-icon opd-icon--symbol');
    } else if (link.icon) {
      iconHtml = `<span class="opd-mega-link-icon-wrap" aria-hidden="true"><img class="opd-mega-link-icon opd-mega-link-icon--img" src="${link.icon}" width="20" height="20" alt="" /></span>`;
    }
    a.innerHTML = `
      ${iconHtml}
      <span class="opd-mega-link-text">
        <span class="opd-mega-link-label">${escapeHtml(link.label)}</span>
        <span class="opd-mega-link-desc">${escapeHtml(link.description)}</span>
      </span>
    `;
    container.appendChild(a);
  }
}

/**
 * Populate Tags mega-menu grid (no full nav remount).
 * @param {{ tag: string, count: number }[]} [items]
 */
export function fillMegaTags(items = []) {
  const tagsHost = document.getElementById('opd-mega-tags');
  if (!tagsHost) return;

  tagsHost.innerHTML = '';
  tagsHost.className = 'opd-mega-tag-grid';
  tagsHost.removeAttribute('aria-busy');

  if (!items.length) {
    tagsHost.textContent = 'No tags yet.';
    return;
  }

  for (const { tag, count } of items) {
    const a = document.createElement('a');
    a.className = 'opd-mega-link';
    a.href = `/t/${encodeURIComponent(tag)}`;
    a.innerHTML = `
        <span class="opd-mega-link-text">
          <span class="opd-mega-link-label">${escapeHtml(tag)}</span>
          <span class="opd-mega-link-desc">${count} prompt${count === 1 ? '' : 's'}</span>
        </span>
      `;
    tagsHost.appendChild(a);
  }
}

/**
 * Sync active nav item styles (no DOM rebuild).
 * @param {string} active
 */
function setNavActive(active) {
  document.querySelectorAll('.opd-nav-item').forEach((el) => {
    const href = el.getAttribute('href') || '';
    const isHome = active === 'home' && href === '/';
    const isBrowse = active === 'browse' && href === '/browse';
    el.classList.toggle('is-active', isHome || isBrowse);
  });

  document.querySelectorAll('.opd-nav-group').forEach((group) => {
    const key = group.dataset.navGroup || '';
    const summary = group.querySelector('.opd-nav-group-summary');
    if (!summary) return;
    summary.classList.toggle('is-active', active === key);
  });
}

/**
 * Wire nav once when shell is prerendered in HTML (avoids CLS from injecting header).
 * @param {string} active
 */
function hydrateSiteNav(active) {
  setNavActive(active);

  if (document.documentElement.dataset.opdNavWired !== '1') {
    document.documentElement.dataset.opdNavWired = '1';
    document.querySelectorAll('.opd-nav-group').forEach(wireNavGroup);
    document.querySelectorAll('.opd-mega-panel').forEach((p) => p.removeAttribute('hidden'));
    renderMegaLinks(document.getElementById('opd-mega-about-links'), ABOUT_LINKS);
    wireSearchToggle();
    syncThemeToggleButtons();
  }

  /* Always attach mobile toggle (safe if hydrate runs more than once). */
  wireMobileNav();
}

/**
 * @param {string} active - 'home' | 'tags' | 'about' | ''
 * @param {{ title?: string, description?: string, path?: string, popularTags?: { tag: string, count: number }[] }} [pageMeta]
 */
export async function mountSiteNav(active = '', pageMeta = null) {
  if (pageMeta) applySiteMeta(pageMeta);
  const host = document.getElementById('opd-nav-root');
  if (!host) return;

  if (host.hasAttribute('data-opd-nav-prerendered') || host.querySelector('.opd-nav-bar')) {
    hydrateSiteNav(active);
    const tagsHost = document.getElementById('opd-mega-tags');
    if (pageMeta?.popularTags?.length) {
      fillMegaTags(pageMeta.popularTags.slice(0, MEGA_POPULAR_LIMIT));
      return;
    }
    renderMegaTagsSkeleton(tagsHost, MEGA_POPULAR_LIMIT);
    try {
      const { items } = await apiGet(`/tags?popular=${MEGA_POPULAR_LIMIT}`);
      fillMegaTags(items);
    } catch {
      if (tagsHost) tagsHost.textContent = 'Could not load tags.';
    }
    return;
  }

  host.innerHTML = `
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
          <a href="/" class="opd-nav-item${active === 'home' ? ' is-active' : ''}">Home</a>
          <a href="/browse" class="opd-nav-item${active === 'browse' ? ' is-active' : ''}">Browse</a>

          <div class="opd-nav-group" data-nav-group="tags">
            <button type="button" class="opd-nav-group-summary${active === 'tags' ? ' is-active' : ''}" aria-expanded="false" aria-haspopup="true">
              <span>Tags</span>
              <span class="opd-nav-chevron">${opdIcon('expand_more')}</span>
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
                      ${opdIcon('apps')}
                      See all tags
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="opd-nav-group" data-nav-group="about">
            <button type="button" class="opd-nav-group-summary${active === 'about' ? ' is-active' : ''}" aria-expanded="false" aria-haspopup="true">
              <span>About</span>
              <span class="opd-nav-chevron">${opdIcon('expand_more')}</span>
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
              <span class="opd-nav-drawer-btn-icon" aria-hidden="true">${opdIcon('dark_mode')}</span>
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
              ${opdIcon('search')}
            </button>
            <button type="button" class="opd-nav-icon-btn" data-opd-theme-toggle aria-label="Switch theme">
              ${opdIcon('dark_mode')}
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
            ${opdIcon('menu')}
          </button>
        </div>
      </div>
    </nav>
    <div class="opd-nav-spacer" aria-hidden="true"></div>
  `;

  hydrateSiteNav(active);

  const tagsHost = document.getElementById('opd-mega-tags');
  if (pageMeta?.popularTags?.length) {
    fillMegaTags(pageMeta.popularTags.slice(0, MEGA_POPULAR_LIMIT));
    return;
  }

  renderMegaTagsSkeleton(tagsHost, MEGA_POPULAR_LIMIT);
  try {
    const { items } = await apiGet(`/tags?popular=${MEGA_POPULAR_LIMIT}`);
    fillMegaTags(items);
  } catch {
    if (tagsHost) tagsHost.textContent = 'Could not load tags.';
  }
}
