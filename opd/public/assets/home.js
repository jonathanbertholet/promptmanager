/**
 * Homepage — single /v1/home load; tag filter refetches popular slice only.
 * Nav mounts before data fetch so the header does not pop in after content.
 */
import { apiGet, buildListQueryParams } from './opd-common.js';
import { renderPromptGrid } from './opd-cards.js';
import { renderFilterPillsSkeleton, renderPromptGridSkeleton } from './opd-skeleton.js';
import { fillMegaTags, mountSiteNav } from './opd-nav.js';

/** 5 rows × 2 columns on homepage sections */
const HOME_LIMIT = 10;

/** Client cache TTL — aligns with edge cache on GET /v1/home (24h). */
const HOME_SESSION_KEY = 'opd-home-v1';
const HOME_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

const els = {
  popular: document.getElementById('opd-section-popular'),
  popularSeeAll: document.getElementById('opd-popular-see-all'),
  popularTags: document.getElementById('opd-popular-tags'),
  recent: document.getElementById('opd-section-recent'),
  recentSeeAll: document.getElementById('opd-recent-see-all'),
};

/** @type {string} */
let activePopularTag = '';

/** In-memory /v1/home payload for tag-filter toggles within this visit. */
/** @type {{ popular: object[], recent: object[], popularTags: { tag: string, count: number }[], meta: { popularTotal: number, recentTotal: number } } | null} */
let homeCache = null;

/**
 * Read homepage API payload cached in sessionStorage (same tab, 24h).
 * @returns {typeof homeCache}
 */
function readSessionHomeCache() {
  try {
    const raw = sessionStorage.getItem(HOME_SESSION_KEY);
    if (!raw) return null;
    const { savedAt, data } = JSON.parse(raw);
    if (!data || Date.now() - savedAt > HOME_SESSION_TTL_MS) {
      sessionStorage.removeItem(HOME_SESSION_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/**
 * @param {NonNullable<typeof homeCache>} data
 */
function writeSessionHomeCache(data) {
  try {
    sessionStorage.setItem(
      HOME_SESSION_KEY,
      JSON.stringify({ savedAt: Date.now(), data })
    );
  } catch {
    /* quota / private mode */
  }
}

/**
 * URL for “see all” on the popular section (selected tag or full catalog by imports).
 */
function popularSeeAllHref() {
  if (activePopularTag) {
    return `/t/${encodeURIComponent(activePopularTag)}?sort=downloads`;
  }
  return '/browse?sort=downloads';
}

/**
 * @param {HTMLElement} container
 * @param {HTMLElement|null} seeAllEl
 * @param {() => string} seeAllHref
 * @param {object[]} items
 * @param {number} total
 */
function paintSection(container, seeAllEl, seeAllHref, items, total) {
  container.innerHTML = '';
  renderPromptGrid(container, items.slice(0, HOME_LIMIT), {
    emptyMessage: 'No prompts in this section yet.',
  });

  if (seeAllEl && total > HOME_LIMIT) {
    seeAllEl.href = seeAllHref();
    seeAllEl.hidden = false;
  } else if (seeAllEl) {
    seeAllEl.hidden = true;
  }
}

/**
 * @param {NonNullable<typeof homeCache>} data
 */
function paintHomeSections(data) {
  const popularTags = data.popularTags || [];
  if (popularTags.length) {
    renderPopularFilters(popularTags);
  } else if (els.popularTags) {
    els.popularTags.hidden = true;
  }

  paintSection(
    els.popular,
    els.popularSeeAll,
    popularSeeAllHref,
    data.popular || [],
    data.meta?.popularTotal ?? 0
  );
  paintSection(
    els.recent,
    els.recentSeeAll,
    () => '/browse?sort=recent',
    data.recent || [],
    data.meta?.recentTotal ?? 0
  );
}

/**
 * @param {{ tag: string, count: number }[]} tags
 */
function renderPopularFilters(tags) {
  const bar = els.popularTags;
  if (!bar) return;
  bar.innerHTML = '';
  bar.className = 'opd-popular-filter-bar';
  bar.removeAttribute('aria-busy');

  const allBtn = document.createElement('button');
  allBtn.type = 'button';
  allBtn.className = 'opd-filter-pill';
  allBtn.textContent = 'All';
  allBtn.setAttribute('aria-pressed', activePopularTag ? 'false' : 'true');
  allBtn.addEventListener('click', () => {
    activePopularTag = '';
    renderPopularFilters(tags);
    void loadPopularSection();
  });
  bar.appendChild(allBtn);

  for (const { tag, count } of tags) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'opd-filter-pill';
    btn.textContent = `${tag} (${count})`;
    btn.setAttribute('aria-pressed', activePopularTag === tag ? 'true' : 'false');
    btn.addEventListener('click', () => {
      activePopularTag = tag;
      renderPopularFilters(tags);
      void loadPopularSection();
    });
    bar.appendChild(btn);
  }
}

async function loadPopularSection() {
  renderPromptGridSkeleton(els.popular, HOME_LIMIT);
  if (els.popularSeeAll) els.popularSeeAll.hidden = true;

  try {
    if (!activePopularTag) {
      if (!homeCache) {
        homeCache = await apiGet('/home');
        writeSessionHomeCache(homeCache);
      }
      paintSection(
        els.popular,
        els.popularSeeAll,
        popularSeeAllHref,
        homeCache.popular || [],
        homeCache.meta?.popularTotal ?? 0
      );
      return;
    }

    const params = buildListQueryParams({
      limit: HOME_LIMIT,
      offset: 0,
      sort: 'downloads',
      tag: activePopularTag,
    });
    const data = await apiGet(`/prompts?${params}`);
    paintSection(
      els.popular,
      els.popularSeeAll,
      popularSeeAllHref,
      data.items || [],
      data.meta?.total ?? data.items?.length ?? 0
    );
  } catch {
    els.popular.innerHTML = '<p class="opd-empty">Could not load prompts.</p>';
  }
}

async function init() {
  const sessionCached = readSessionHomeCache();
  if (sessionCached) {
    homeCache = sessionCached;
  } else {
    renderFilterPillsSkeleton(els.popularTags, 8);
    renderPromptGridSkeleton(els.popular, HOME_LIMIT);
    renderPromptGridSkeleton(els.recent, HOME_LIMIT);
  }
  if (els.popularSeeAll) els.popularSeeAll.hidden = true;
  if (els.recentSeeAll) els.recentSeeAll.hidden = true;

  const pageMeta = {
    title: 'Open Prompt Database',
    description:
      'Community prompt templates for Open Prompt Manager — browse popular and recent prompts.',
    path: '/',
    popularTags: sessionCached?.popularTags,
  };

  /* Nav first — avoids empty header while /home loads */
  await mountSiteNav('home', pageMeta);

  if (sessionCached) {
    paintHomeSections(sessionCached);
  }

  try {
    const data = await apiGet('/home');
    homeCache = data;
    writeSessionHomeCache(data);
    fillMegaTags(data.popularTags);
    paintHomeSections(data);
  } catch {
    if (!sessionCached) {
      els.popular.innerHTML = '<p class="opd-empty">Could not load prompts.</p>';
      els.recent.innerHTML = '<p class="opd-empty">Could not load prompts.</p>';
    }
  }
}

init();
