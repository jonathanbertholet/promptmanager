/**
 * Author page (/u/:author) — search, tag filters, sort, paginated card grid.
 */
import { apiGet, buildListQueryParams, getAuthorFromLocation, renderSortPills, SORT_OPTIONS } from './opd-common.js';
import { renderPromptGrid } from './opd-cards.js';
import {
  clearInlineSkeleton,
  renderAuthorPageSkeleton,
  renderFilterPillsSkeleton,
  renderPromptGridSkeleton,
} from './opd-skeleton.js';
import { opdIcon } from './opd-icons.js';
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

const PAGE_SIZE = 24;

const state = {
  author: '',
  q: '',
  tag: '',
  sort: 'recent',
  offset: 0,
  page: 1,
  total: 0,
  totalImports: 0,
  importsFiltered: false,
  loading: false,
};

const els = {
  breadcrumbAuthor: document.getElementById('opd-breadcrumb-author'),
  title: document.getElementById('opd-author-title'),
  subtitle: document.getElementById('opd-author-subtitle'),
  importsChip: document.getElementById('opd-author-imports-chip'),
  search: document.getElementById('opd-author-search'),
  tagHost: document.getElementById('opd-author-tags'),
  sort: document.getElementById('opd-author-sort'),
  toolbarPager: document.getElementById('opd-author-toolbar-pager'),
  grid: document.getElementById('opd-author-grid'),
  status: document.getElementById('opd-status'),
  pager: document.getElementById('opd-author-pager'),
};

const SORT_LABELS = Object.fromEntries(SORT_OPTIONS.map((o) => [o.value, o.label]));

function readUrlState() {
  const params = new URLSearchParams(window.location.search);
  state.q = (params.get('q') || '').trim();
  state.tag = params.get('tag') || '';
  state.sort = params.get('sort') || 'recent';
  state.author = params.get('author') || getAuthorFromLocation() || '';
  const { offset, page } = readPaginationFromUrl(params, PAGE_SIZE);
  state.offset = offset;
  state.page = page;
  if (els.search) els.search.value = state.q;
}

function writeUrlState() {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.tag) params.set('tag', state.tag);
  if (state.sort !== 'recent') params.set('sort', state.sort);
  writePaginationToUrl(params, state.offset, PAGE_SIZE);
  const qs = params.toString();
  const path = `/u/${encodeURIComponent(state.author)}`;
  window.history.replaceState(null, '', qs ? `${path}?${qs}` : path);
}

function syncSortPills() {
  renderSortPills(els.sort, state.sort, (sort) => {
    state.sort = sort;
    state.offset = 0;
    state.page = 1;
    syncSortPills();
    fetchPrompts();
  });
}

/**
 * Apply download totals from list meta (same filters as the grid; no extra /authors/ call).
 * @param {{ meta?: { authorStats?: { totalImports?: number } } }} data
 */
function applyAuthorStatsFromList(data) {
  if (data.meta?.authorStats?.totalImports != null) {
    state.totalImports = data.meta.authorStats.totalImports;
    state.importsFiltered = Boolean(state.tag || state.q);
  }
}

/**
 * Hero chip: sum of import_count for prompts matching current author filters.
 */
function updateImportsChip() {
  const chip = els.importsChip;
  if (!chip) return;

  const n = state.totalImports;
  const scope = state.importsFiltered ? 'matching filters' : 'all prompts';
  chip.hidden = false;
  chip.innerHTML = `${opdIcon('download', 'opd-stat-chip-icon')}<span>${n.toLocaleString()} download${n === 1 ? '' : 's'}</span>`;
  chip.setAttribute(
    'aria-label',
    `${n.toLocaleString()} download${n === 1 ? '' : 's'} (${scope}) for @${state.author}`
  );
  chip.title = state.importsFiltered
    ? 'Total downloads for prompts matching your search or tag filter'
    : 'Total downloads across all prompts by this author';
}

function updateHero() {
  const handle = `@${state.author}`;
  if (els.breadcrumbAuthor) {
    clearInlineSkeleton(els.breadcrumbAuthor);
    els.breadcrumbAuthor.textContent = handle;
  }
  if (els.title) {
    clearInlineSkeleton(els.title);
    const sortLabel = SORT_LABELS[state.sort];
    els.title.textContent =
      state.sort === 'recent' ? `Prompts by ${handle}` : `${sortLabel} · ${handle}`;
  }
  if (els.subtitle) clearInlineSkeleton(els.subtitle);
  applySiteMeta({
    title: `${handle} — Open Prompt Database`,
    description: `Prompts published by ${handle} in the community catalog.`,
    path: window.location.pathname + window.location.search,
  });

  let sub = `${state.total} prompt${state.total === 1 ? '' : 's'} · community catalog · unverified`;
  if (state.tag) sub += ` · filtered by ${state.tag}`;
  if (state.q) sub += ` · matching “${state.q}”`;
  if (els.subtitle) els.subtitle.textContent = sub;
  updateImportsChip();
}

function renderTagFilters(tags) {
  const bar = els.tagHost;
  if (!bar) return;
  bar.innerHTML = '';
  bar.className = 'opd-popular-filter-bar';
  bar.hidden = !tags.length;

  const allBtn = document.createElement('button');
  allBtn.type = 'button';
  allBtn.className = 'opd-filter-pill';
  allBtn.textContent = 'All';
  allBtn.setAttribute('aria-pressed', state.tag ? 'false' : 'true');
  allBtn.addEventListener('click', () => {
    state.tag = '';
    state.offset = 0;
    state.page = 1;
    writeUrlState();
    renderTagFilters(tags);
    fetchPrompts();
  });
  bar.appendChild(allBtn);

  for (const { tag, count } of tags) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'opd-filter-pill';
    btn.textContent = `${tag} (${count})`;
    btn.setAttribute('aria-pressed', state.tag === tag ? 'true' : 'false');
    btn.addEventListener('click', () => {
      state.tag = tag;
      state.offset = 0;
      state.page = 1;
      writeUrlState();
      renderTagFilters(tags);
      fetchPrompts();
    });
    bar.appendChild(btn);
  }
}

async function loadTags() {
  renderFilterPillsSkeleton(els.tagHost, 6);
  try {
    const { items } = await apiGet('/tags?popular=12');
    renderTagFilters(items);
  } catch {
    if (els.tagHost) els.tagHost.hidden = true;
  }
}

function updatePager() {
  const opts = pagerOptions(state, PAGE_SIZE, fetchPrompts);
  renderToolbarPager(els.toolbarPager, opts);
  renderPagination(els.pager, opts);
}

async function fetchPrompts() {
  if (state.loading || !state.author) return;
  state.loading = true;
  if (els.status) els.status.textContent = '';
  renderPromptGridSkeleton(els.grid, PAGE_SIZE > 20 ? 12 : PAGE_SIZE);

  const params = buildListQueryParams({
    limit: PAGE_SIZE,
    offset: state.offset,
    sort: state.sort,
    author: state.author,
    q: state.q,
    tag: state.tag,
    knownTotal: state.total,
  });

  try {
    const data = await apiGet(`/prompts?${params}`);
    const items = data.items || [];
    if (data.meta?.total != null) {
      state.total = data.meta.total;
    } else if (state.total === 0) {
      state.total = items.length;
    }
    applyAuthorStatsFromList(data);
    state.page = offsetToPage(state.offset, PAGE_SIZE);

    els.grid.innerHTML = '';
    renderPromptGrid(els.grid, items, {
      emptyMessage: state.q || state.tag
        ? 'No prompts match your filters.'
        : 'No prompts from this author yet.',
      hideAuthor: true,
    });

    updateHero();
    updatePager();
    if (els.status) els.status.textContent = '';
    writeUrlState();
  } catch (err) {
    els.grid.innerHTML = '<p class="opd-empty">Could not load prompts.</p>';
    if (els.status) {
      els.status.textContent =
        err.status === 404 ? 'Author not found.' : 'Could not load prompts. Try again.';
    }
  } finally {
    state.loading = false;
  }
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

async function init() {
  readUrlState();
  syncSortPills();
  const searchIcon = document.querySelector('.opd-author-search-icon.material-symbols-rounded');
  if (searchIcon) searchIcon.outerHTML = opdIcon('search', 'opd-author-search-icon');
  if (!state.author) {
    if (els.title) els.title.textContent = 'Author not found';
    if (els.status) els.status.textContent = 'Missing author in URL.';
    await mountSiteNav('');
    return;
  }

  renderAuthorPageSkeleton({
    breadcrumb: els.breadcrumbAuthor,
    title: els.title,
    subtitle: els.subtitle,
    tagHost: els.tagHost,
    grid: els.grid,
    gridCount: 12,
  });

  await mountSiteNav('');
  await Promise.all([loadTags(), fetchPrompts()]);

  if (els.search) {
    els.search.addEventListener(
      'input',
      debounce(() => {
        state.q = els.search.value.trim();
        state.offset = 0;
        state.page = 1;
        writeUrlState();
        fetchPrompts();
      }, 280)
    );
  }
}

init();
