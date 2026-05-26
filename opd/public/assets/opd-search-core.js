/**
 * Shared prompt search fetch + result rendering (modal and hero search).
 */
import { apiGet, buildListQueryParams, escapeHtml } from './opd-common.js';
import { renderSearchHitsSkeleton } from './opd-skeleton.js';

export const SEARCH_DEBOUNCE_MS = 280;
export const SEARCH_PREVIEW_LIMIT = 8;

/**
 * @param {string} q
 * @param {number} [limit]
 */
export async function fetchSearchPreview(q, limit = SEARCH_PREVIEW_LIMIT) {
  const params = buildListQueryParams({
    q,
    limit,
    offset: 0,
    sort: 'recent',
  });
  params.set('includeTotal', '0');
  const data = await apiGet(`/prompts?${params}`);
  return {
    items: data.items || [],
    hasMore: Boolean(data.meta?.hasMore),
  };
}

/**
 * @param {HTMLElement} container
 * @param {string} message
 */
export function renderSearchHint(container, message) {
  container.innerHTML = `<p class="opd-search-hint">${message}</p>`;
}

/**
 * @param {HTMLElement} container
 * @param {object[]} items
 * @param {string} q
 * @param {boolean} hasMore
 * @param {{ browseAllHref?: string }} [opts]
 */
export function renderSearchHits(container, items, q, hasMore, opts = {}) {
  if (!items.length) {
    renderSearchHint(container, `No prompts found for “${escapeHtml(q)}”.`);
    return;
  }

  const list = document.createElement('ul');
  list.className = 'opd-search-list';

  for (const p of items) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.className = 'opd-search-hit';
    a.href = `/p/${encodeURIComponent(p.id)}`;
    a.innerHTML = `
      <span class="opd-search-hit-title">${escapeHtml(p.title)}</span>
      <span class="opd-search-hit-meta">@${escapeHtml(p.author)}${p.tags?.length ? ` · ${escapeHtml(p.tags.slice(0, 3).join(', '))}` : ''}</span>
    `;
    li.appendChild(a);
    list.appendChild(li);
  }

  container.innerHTML = '';
  container.appendChild(list);

  if (hasMore) {
    const more = document.createElement('a');
    more.className = 'opd-search-more';
    more.href =
      opts.browseAllHref || `/browse?q=${encodeURIComponent(q)}`;
    more.textContent = 'Browse all results →';
    container.appendChild(more);
  }
}

/**
 * @param {HTMLElement} container
 * @param {string} q
 * @param {number} [limit]
 */
export async function runSearchPreview(container, q, limit = SEARCH_PREVIEW_LIMIT) {
  if (!q) {
    renderSearchHint(container, 'Type to search the prompt catalog.');
    return { q: '', items: [], hasMore: false };
  }

  renderSearchHitsSkeleton(container, limit);

  try {
    const { items, hasMore } = await fetchSearchPreview(q, limit);
    renderSearchHits(container, items, q, hasMore);
    return { q, items, hasMore };
  } catch {
    renderSearchHint(container, 'Search failed. Try again.');
    return { q, items: [], hasMore: false };
  }
}
