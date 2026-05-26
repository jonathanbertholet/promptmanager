/**
 * Tag page — prompts in a tag, paginated, sortable.
 */
import { apiGet, buildListQueryParams, escapeHtml, renderSortPills } from './opd-common.js';
import { renderPromptGrid } from './opd-cards.js';
import { clearInlineSkeleton, renderListPageSkeleton } from './opd-skeleton.js';
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

const state = {
  tag: '',
  sort: 'recent',
  offset: 0,
  page: 1,
  total: 0,
};

const els = {
  title: document.getElementById('opd-tag-title'),
  count: document.getElementById('opd-tag-count'),
  grid: document.getElementById('opd-tag-grid'),
  sort: document.getElementById('opd-tag-sort'),
  toolbarPager: document.getElementById('opd-tag-toolbar-pager'),
  pager: document.getElementById('opd-tag-pager'),
};

function getTagFromLocation() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('tag')) return params.get('tag').trim().toLowerCase();
  const match = window.location.pathname.match(/^\/t\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]).toLowerCase() : '';
}

function readUrlState() {
  const params = new URLSearchParams(window.location.search);
  state.tag = getTagFromLocation();
  state.sort = params.get('sort') || 'recent';
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
  if (state.sort !== 'recent') params.set('sort', state.sort);
  writePaginationToUrl(params, state.offset, PAGE_SIZE);
  const qs = params.toString();
  const path = `/t/${encodeURIComponent(state.tag)}`;
  window.history.replaceState(null, '', qs ? `${path}?${qs}` : path);
}

function updatePager() {
  const opts = pagerOptions(state, PAGE_SIZE, loadPrompts);
  renderToolbarPager(els.toolbarPager, opts);
  renderPagination(els.pager, opts);
}

async function loadPrompts() {
  if (!state.tag) {
    if (els.grid) els.grid.innerHTML = '<p class="opd-empty">Missing tag.</p>';
    return;
  }

  renderListPageSkeleton({
    title: els.title,
    count: els.count,
    grid: els.grid,
    gridCount: 12,
  });

  const q = buildListQueryParams({
    tag: state.tag,
    limit: PAGE_SIZE,
    offset: state.offset,
    sort: state.sort,
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
      els.title.innerHTML = `<span class="opd-tag-hash">#</span>${escapeHtml(state.tag)}`;
    }
    if (els.count) clearInlineSkeleton(els.count);
    if (els.count) els.count.textContent = `${state.total} prompt${state.total === 1 ? '' : 's'}`;
    applySiteMeta({
      title: `${state.tag} prompts — Open Prompt Database`,
      description: `${state.total} community prompts tagged ${state.tag}.`,
      path: window.location.pathname + window.location.search,
    });

    els.grid.innerHTML = '';
    renderPromptGrid(els.grid, data.items || [], {
      emptyMessage: `No prompts tagged “${state.tag}”.`,
    });
    updatePager();
    writeUrlState();
  } catch {
    els.grid.innerHTML = '<p class="opd-empty">Could not load prompts.</p>';
  }
}

async function init() {
  readUrlState();
  renderListPageSkeleton({
    title: els.title,
    count: els.count,
    grid: els.grid,
    gridCount: 12,
  });
  await mountSiteNav('tags');
  syncSortPills();
  await loadPrompts();
}

init();
