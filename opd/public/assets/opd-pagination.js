/**
 * Shared offset / page pagination for browse, tag, and author lists.
 */

/**
 * @param {number} page 1-based
 * @param {number} pageSize
 */
export function pageToOffset(page, pageSize) {
  return Math.max(0, (Math.max(1, page) - 1) * pageSize);
}

/**
 * @param {number} offset
 * @param {number} pageSize
 */
export function offsetToPage(offset, pageSize) {
  return Math.floor(offset / pageSize) + 1;
}

/**
 * Prefer ?page= over legacy ?offset= in URLs.
 * @param {URLSearchParams} params
 * @param {number} pageSize
 */
export function readPaginationFromUrl(params, pageSize) {
  if (params.has('offset')) {
    const offset = Math.max(0, Number.parseInt(params.get('offset') || '0', 10) || 0);
    return { offset, page: offsetToPage(offset, pageSize) };
  }
  const page = Math.max(1, Number.parseInt(params.get('page') || '1', 10) || 1);
  return { offset: pageToOffset(page, pageSize), page };
}

/**
 * @param {URLSearchParams} params
 * @param {number} offset
 * @param {number} pageSize
 */
export function writePaginationToUrl(params, offset, pageSize) {
  params.delete('offset');
  const page = offsetToPage(offset, pageSize);
  if (page > 1) params.set('page', String(page));
  else params.delete('page');
}

/**
 * @param {number} total
 * @param {number} pageSize
 */
export function totalPages(total, pageSize) {
  return Math.max(1, Math.ceil(total / pageSize));
}

/**
 * Page numbers to show with ellipsis gaps.
 * @param {number} current
 * @param {number} pages
 */
export function pageNumberWindow(current, pages) {
  if (pages <= 7) {
    return Array.from({ length: pages }, (_, i) => i + 1);
  }
  const nums = new Set([1, pages, current, current - 1, current + 1]);
  const sorted = [...nums].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push('…');
    out.push(sorted[i]);
  }
  return out;
}

/**
 * Compact Previous / Next (and page x of y) for the sort toolbar.
 * @param {HTMLElement|null} host
 * @param {{ page: number, total: number, pageSize: number, onPage: (page: number) => void, scroll?: boolean }} opts
 */
export function renderToolbarPager(host, opts) {
  if (!host) return;
  const pages = totalPages(opts.total, opts.pageSize);
  const page = Math.min(Math.max(1, opts.page), pages);

  host.innerHTML = '';
  host.className = 'opd-toolbar-pager';
  host.hidden = opts.total <= opts.pageSize;

  if (host.hidden) return;

  const prev = document.createElement('button');
  prev.type = 'button';
  prev.className = 'main opd-btn-secondary opd-toolbar-pager-btn';
  prev.textContent = 'Previous';
  prev.disabled = page <= 1;
  prev.setAttribute('aria-label', 'Previous page');
  prev.addEventListener('click', () => go(page - 1));

  const info = document.createElement('span');
  info.className = 'opd-toolbar-pager-info';
  info.textContent = `Page ${page} of ${pages}`;
  info.setAttribute('aria-live', 'polite');

  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'main opd-btn-secondary opd-toolbar-pager-btn';
  next.textContent = 'Next';
  next.disabled = page >= pages;
  next.setAttribute('aria-label', 'Next page');
  next.addEventListener('click', () => go(page + 1));

  host.append(prev, info, next);

  function go(target) {
    if (target < 1 || target > pages || target === page) return;
    opts.onPage(target);
    if (opts.scroll !== false) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
}

/**
 * @param {{ page: number, total: number, pageSize: number, onPage: (page: number) => void, scroll?: boolean }} opts
 */
export function pagerOptions(state, pageSize, loadFn) {
  return {
    page: state.page,
    total: state.total,
    pageSize,
    onPage: (page) => {
      state.page = page;
      state.offset = pageToOffset(page, pageSize);
      loadFn();
    },
  };
}

/**
 * Render prev / numbered pages / next into a pager host.
 * @param {HTMLElement|null} host
 * @param {{ page: number, total: number, pageSize: number, onPage: (page: number) => void, scroll?: boolean }} opts
 */
export function renderPagination(host, opts) {
  if (!host) return;
  const pages = totalPages(opts.total, opts.pageSize);
  const page = Math.min(Math.max(1, opts.page), pages);

  host.innerHTML = '';
  host.className = 'opd-pager';
  host.hidden = opts.total <= opts.pageSize;

  const prev = document.createElement('button');
  prev.type = 'button';
  prev.className = 'main opd-btn-secondary opd-pager-nav';
  prev.textContent = 'Previous';
  prev.disabled = page <= 1;
  prev.addEventListener('click', () => go(page - 1));
  host.appendChild(prev);

  const nums = document.createElement('div');
  nums.className = 'opd-pager-nums';
  nums.setAttribute('role', 'group');
  nums.setAttribute('aria-label', 'Page numbers');

  for (const item of pageNumberWindow(page, pages)) {
    if (item === '…') {
      const span = document.createElement('span');
      span.className = 'opd-pager-ellipsis';
      span.textContent = '…';
      span.setAttribute('aria-hidden', 'true');
      nums.appendChild(span);
      continue;
    }
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'opd-pager-num';
    btn.textContent = String(item);
    btn.setAttribute('aria-label', `Page ${item}`);
    btn.setAttribute('aria-current', item === page ? 'page' : 'false');
    if (item === page) btn.classList.add('is-active');
    btn.addEventListener('click', () => go(item));
    nums.appendChild(btn);
  }
  host.appendChild(nums);

  const info = document.createElement('span');
  info.className = 'pm-subtitle opd-page-info';
  info.textContent = `Page ${page} of ${pages} (${opts.total} prompts)`;
  host.appendChild(info);

  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'main opd-btn-secondary opd-pager-nav';
  next.textContent = 'Next';
  next.disabled = page >= pages;
  next.addEventListener('click', () => go(page + 1));
  host.appendChild(next);

  function go(target) {
    if (target < 1 || target > pages || target === page) return;
    opts.onPage(target);
    if (opts.scroll !== false) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
}
