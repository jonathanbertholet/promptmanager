/**
 * Browse all prompts (no tag) — paginated, sortable. Used from home “See all”.
 */
import { apiGet, buildListQueryParams, renderSortPills, SORT_OPTIONS } from './opd-common.js';
import { renderPromptGrid } from './opd-cards.js';
import { clearInlineSkeleton, renderListPageSkeleton } from './opd-skeleton.js';
import { mountHeroSearch } from './opd-hero-search.js';
import { mountSiteNav } from './opd-nav.js';
import {
  offsetToPage,
  pageToOffset,
  pagerOptions,
  readPaginationFromUrl,
  renderPagination,
  renderToolbarPager,
  writePaginationToUrl,
} from './opd-pagination.js';
import { applySiteMeta } from './opd-seo.js';

const PAGE_SIZE = 50;

const state = { sort: 'recent', offset: 0, page: 1, total: 0, q: '' };

const els = {
  title: document.getElementById('opd-browse-title'),
  count: document.getElementById('opd-browse-count'),
  grid: document.getElementById('opd-browse-grid'),
  sort: document.getElementById('opd-browse-sort'),
  toolbarPager: document.getElementById('opd-browse-toolbar-pager'),
  pager: document.getElementById('opd-browse-pager'),
  searchRoot: document.getElementById('opd-browse-search-root'),
  searchResults: document.getElementById('opd-browse-search-results'),
};

/** @type {ReturnType<typeof mountHeroSearch>|null} */
let browseSearch = null;

const SORT_LABELS = Object.fromEntries(SORT_OPTIONS.map((o) => [o.value, o.label]));

function readUrlState() {
  const params = new URLSearchParams(window.location.search);
  state.sort = params.get('sort') || 'recent';
  state.q = (params.get('q') || '').trim();
  const { offset, page } = readPaginationFromUrl(params, PAGE_SIZE);
  state.offset = offset;
  state.page = page;
}

function syncSortPills() {
  renderSortPills(els.sort, state.sort, (sort) => {
    state.sort = sort;
    state.offset = 0;
    state.page = 1;
    syncSortPills();
    loadPrompts();
  });
}

function writeUrlState() {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.sort !== 'recent') params.set('sort', state.sort);
  writePaginationToUrl(params, state.offset, PAGE_SIZE);
  const qs = params.toString();
  window.history.replaceState(null, '', qs ? `/browse?${qs}` : '/browse');
}

function updatePager() {
  const opts = pagerOptions(state, PAGE_SIZE, loadPrompts);
  renderToolbarPager(els.toolbarPager, opts);
  renderPagination(els.pager, opts);
}

async function loadPrompts() {
  renderListPageSkeleton({
    title: els.title,
    count: els.count,
    grid: els.grid,
    gridCount: PAGE_SIZE > 20 ? 12 : PAGE_SIZE,
  });

  const q = buildListQueryParams({
    limit: PAGE_SIZE,
    offset: state.offset,
    sort: state.sort,
    q: state.q,
    knownTotal: state.total,
  });

  try {
    const data = await apiGet(`/prompts?${q}`);
    if (data.meta?.total != null) {
      state.total = data.meta.total;
    } else if (state.total === 0) {
      state.total = data.items?.length ?? 0;
    }
    state.page = offsetToPage(state.offset, PAGE_SIZE);

    if (els.title) {
      clearInlineSkeleton(els.title);
      els.title.textContent = state.q
        ? `Search: “${state.q}”`
        : SORT_LABELS[state.sort] || 'All prompts';
    }
    if (els.count) {
      clearInlineSkeleton(els.count);
      els.count.textContent = `${state.total} prompt${state.total === 1 ? '' : 's'}`;
    }
    const pageTitle = state.q
      ? `Search: ${state.q}`
      : SORT_LABELS[state.sort] || 'Browse';
    applySiteMeta({
      title: `${pageTitle} — Open Prompt Database`,
      description: `Browse ${state.total} community prompts for Open Prompt Manager.`,
      path: window.location.pathname + window.location.search,
    });

    els.grid.innerHTML = '';
    renderPromptGrid(els.grid, data.items || [], { emptyMessage: 'No prompts yet.' });
    updatePager();
    writeUrlState();
  } catch {
    els.grid.innerHTML = '<p class="opd-empty">Could not load prompts.</p>';
  }
}

function wireBrowseSearch() {
  if (!els.searchRoot || !els.searchResults) return;

  browseSearch = mountHeroSearch(els.searchRoot, {
    resultsEl: els.searchResults,
    showLibraryButton: false,
    initialQuery: state.q,
    placeholder: 'Search title or prompt text…',
    onSubmit: (q) => {
      state.q = q;
      state.offset = 0;
      state.page = 1;
      els.searchResults.hidden = true;
      loadPrompts();
    },
  });

  const input = browseSearch.input;
  input.addEventListener('input', () => {
    const q = input.value.trim();
    els.searchResults.hidden = !q;
  });
  input.addEventListener('focus', () => {
    if (input.value.trim()) els.searchResults.hidden = false;
  });
}

async function init() {
  readUrlState();
  renderListPageSkeleton({
    title: els.title,
    count: els.count,
    grid: els.grid,
    gridCount: 12,
  });
  await mountSiteNav('browse', {
    title: 'Browse prompts — Open Prompt Database',
    description: 'Browse and search community prompt templates.',
    path: '/browse',
  });
  wireBrowseSearch();
  syncSortPills();
  await loadPrompts();
}

init();
