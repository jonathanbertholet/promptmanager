/**
 * Shared helpers + API client for Open Prompt Database site.
 */

/** COMMENT: Canonical public site — used for absolute share/meta when needed. */
export const OPD_SITE_ORIGIN = 'https://openpromptdatabase.com';

export const API_BASE = '/v1';

/** Sort options for browse / tag list pages. */
export const SORT_OPTIONS = [
  { value: 'recent', label: 'Most recent' },
  { value: 'downloads', label: 'Most imports' },
  { value: 'title', label: 'A → Z' },
];

/**
 * Render sort choices as pill buttons (replaces dropdown).
 * @param {HTMLElement} container
 * @param {string} activeSort
 * @param {(sort: string) => void} onSelect
 */
export function renderSortPills(container, activeSort, onSelect) {
  if (!container) return;
  container.innerHTML = '';
  container.className = 'opd-sort-pills';

  for (const { value, label } of SORT_OPTIONS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'opd-filter-pill';
    btn.textContent = label;
    btn.setAttribute('aria-pressed', activeSort === value ? 'true' : 'false');
    btn.addEventListener('click', () => {
      if (activeSort !== value) onSelect(value);
    });
    container.appendChild(btn);
  }
}

/**
 * @param {string} str
 */
export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {string} iso
 */
export function formatRelativeDate(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days < 1) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * @param {string} path
 */
/**
 * Query string for list endpoints — card view; skip COUNT on page 2+ when total is known.
 * @param {{ limit: number, offset: number, sort: string, tag?: string, author?: string, q?: string, knownTotal?: number }} opts
 */
export function buildListQueryParams(opts) {
  const params = new URLSearchParams({
    limit: String(opts.limit),
    offset: String(opts.offset),
    sort: opts.sort,
    view: 'card',
  });
  if (opts.tag) params.set('tag', opts.tag);
  if (opts.author) params.set('author', String(opts.author).trim().toLowerCase());
  if (opts.q) params.set('q', opts.q);
  const page = Math.floor(opts.offset / opts.limit) + 1;
  if (page > 1 && (opts.knownTotal ?? 0) > 0) {
    params.set('includeTotal', '0');
  }
  return params;
}

export async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    const err = new Error(`API ${res.status}`);
    err.status = res.status;
    try {
      err.body = await res.json();
    } catch {
      /* ignore */
    }
    throw err;
  }
  return res.json();
}

/**
 * Parse /p/:id or ?id= from current page.
 */
export function getPromptIdFromLocation() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('id')) return params.get('id');
  const match = window.location.pathname.match(/^\/p\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : '';
}

/**
 * Parse /u/:author from current page.
 */
export function getAuthorFromLocation() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('author')) return params.get('author').trim().toLowerCase();
  const match = window.location.pathname.match(/^\/u\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]).trim().toLowerCase() : '';
}

/**
 * @param {{ tag: string, count: number }[]} items
 * @param {string} activeTag
 * @param {(tag: string) => void} onSelect
 */
export function renderTagFilterBar(container, items, activeTag, onSelect) {
  container.innerHTML = '';
  const bar = document.createElement('div');
  bar.className = 'spm-tags-filter-bar prompt-tags-filter';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Filter by tag');

  const allBtn = document.createElement('button');
  allBtn.type = 'button';
  allBtn.className = 'spm-tag-pill-filter';
  allBtn.textContent = 'All';
  allBtn.setAttribute('aria-pressed', activeTag ? 'false' : 'true');
  allBtn.addEventListener('click', () => onSelect(''));
  bar.appendChild(allBtn);

  for (const { tag, count } of items) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'spm-tag-pill-filter';
    btn.textContent = `${tag} (${count})`;
    btn.setAttribute('aria-pressed', activeTag === tag ? 'true' : 'false');
    btn.addEventListener('click', () => onSelect(tag));
    bar.appendChild(btn);
  }

  container.appendChild(bar);
}

/**
 * Highlight OPM-style #placeholders# in escaped prompt HTML.
 * @param {string} text
 */
export function formatPromptContentHtml(text) {
  const escaped = escapeHtml(text || '');
  return escaped.replace(
    /#([a-zA-Z0-9_-]+)#/g,
    '<span class="opd-placeholder">#$1#</span>'
  );
}

/**
 * @param {string} iso
 */
export function formatAbsoluteDate(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * @param {HTMLElement} container
 * @param {string[]} tags
 * @param {{ link?: boolean }} [opts]
 */
export function renderTagChips(container, tags, opts = {}) {
  container.innerHTML = '';
  if (!tags?.length) {
    container.hidden = true;
    return;
  }
  container.hidden = false;
  const row = document.createElement('div');
  row.className = 'opd-tag-row';
  for (const tag of tags) {
    if (opts.link) {
      const a = document.createElement('a');
      a.className = 'opd-tag-chip opd-tag-chip--link';
      a.href = `/t/${encodeURIComponent(tag)}`;
      a.textContent = tag;
      row.appendChild(a);
    } else {
      const chip = document.createElement('span');
      chip.className = 'opd-tag-chip';
      chip.textContent = tag;
      row.appendChild(chip);
    }
  }
  container.appendChild(row);
}
