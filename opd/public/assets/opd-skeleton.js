/**
 * Shared skeleton placeholders — no text “Loading…” indicators.
 */

/**
 * @param {string} extra
 */
function skeletonLine(extra = '') {
  return `<div class="opd-skeleton-line ${extra}" aria-hidden="true"></div>`;
}

/**
 * Inline skeleton inside a text host (title, subtitle, breadcrumb).
 * @param {HTMLElement|null} el
 * @param {'title'|'title-lg'|'subtitle'|'count'|'breadcrumb'} variant
 */
export function renderInlineSkeleton(el, variant = 'title') {
  if (!el) return;
  el.innerHTML = '';
  el.classList.add('opd-skeleton-inline');
  const line = document.createElement('span');
  line.className = `opd-skeleton-line opd-skeleton-line--${variant}`;
  line.setAttribute('aria-hidden', 'true');
  el.appendChild(line);
  el.setAttribute('aria-busy', 'true');
}

/**
 * @param {HTMLElement|null} el
 */
export function clearInlineSkeleton(el) {
  if (!el) return;
  el.classList.remove('opd-skeleton-inline');
  el.removeAttribute('aria-busy');
}

/**
 * Prompt card grid — same footprint as real cards.
 * @param {HTMLElement} container
 * @param {number} [count]
 */
export function renderPromptGridSkeleton(container, count = 10) {
  if (!container) return;
  container.innerHTML = '';
  container.setAttribute('aria-busy', 'true');

  const grid = document.createElement('div');
  grid.className = 'opd-prompt-grid opd-prompt-grid--skeleton';
  grid.setAttribute('role', 'list');
  grid.setAttribute('aria-label', 'Prompt list');

  for (let i = 0; i < count; i++) {
    const card = document.createElement('article');
    card.className = 'opd-prompt-card opd-skeleton-card';
    card.setAttribute('role', 'listitem');
    card.setAttribute('aria-hidden', 'true');
    card.innerHTML = `
      ${skeletonLine('opd-skeleton-line--title')}
      ${skeletonLine('opd-skeleton-line--meta')}
      ${skeletonLine('opd-skeleton-line--tags')}
      ${skeletonLine('opd-skeleton-line--body')}
      ${skeletonLine('opd-skeleton-line--body opd-skeleton-line--short')}
    `;
    grid.appendChild(card);
  }

  container.appendChild(grid);
}

/**
 * Browse / tag list header + grid.
 * @param {{ title?: HTMLElement|null, count?: HTMLElement|null, grid: HTMLElement|null, gridCount?: number }} opts
 */
export function renderListPageSkeleton(opts) {
  renderInlineSkeleton(opts.title, 'title');
  renderInlineSkeleton(opts.count, 'count');
  renderPromptGridSkeleton(opts.grid, opts.gridCount ?? 10);
}

/**
 * Filter pill row skeleton.
 * @param {HTMLElement|null} container
 * @param {number} [count]
 */
export function renderFilterPillsSkeleton(container, count = 8) {
  if (!container) return;
  container.hidden = false;
  container.innerHTML = '';
  container.className = 'opd-popular-filter-bar opd-skeleton-pills';
  container.setAttribute('aria-busy', 'true');

  for (let i = 0; i < count; i++) {
    const pill = document.createElement('span');
    pill.className = 'opd-skeleton-pill';
    pill.setAttribute('aria-hidden', 'true');
    container.appendChild(pill);
  }
}

/**
 * Nav mega-menu tag grid skeleton.
 * @param {HTMLElement|null} host
 * @param {number} [count]
 */
export function renderMegaTagsSkeleton(host, count = 8) {
  if (!host) return;
  host.innerHTML = '';
  host.className = 'opd-mega-tag-grid opd-mega-tag-grid--skeleton';
  host.setAttribute('aria-busy', 'true');

  for (let i = 0; i < count; i++) {
    const cell = document.createElement('span');
    cell.className = 'opd-skeleton-mega-tag';
    cell.setAttribute('aria-hidden', 'true');
    host.appendChild(cell);
  }
}

/**
 * /tags directory page skeleton.
 * @param {HTMLElement|null} host
 * @param {number} [sections]
 * @param {number} [tagsPerSection]
 */
export function renderTagsDirectorySkeleton(host, sections = 4, tagsPerSection = 6) {
  if (!host) return;
  host.innerHTML = '';
  host.setAttribute('aria-busy', 'true');

  for (let s = 0; s < sections; s++) {
    const section = document.createElement('section');
    section.className = 'opd-letter-group settings-section opd-skeleton-section';
    section.setAttribute('aria-hidden', 'true');

    const heading = document.createElement('h3');
    heading.className = 'settings-heading opd-letter-heading';
    const letterLine = document.createElement('span');
    letterLine.className = 'opd-skeleton-line opd-skeleton-line--letter';
    letterLine.setAttribute('aria-hidden', 'true');
    heading.appendChild(letterLine);
    section.appendChild(heading);

    const list = document.createElement('ul');
    list.className = 'opd-tag-directory-list';
    for (let t = 0; t < tagsPerSection; t++) {
      const li = document.createElement('li');
      li.innerHTML = skeletonLine('opd-skeleton-line--tag-link');
      list.appendChild(li);
    }
    section.appendChild(list);
    host.appendChild(section);
  }
}

/**
 * Author page hero + optional tag bar + grid.
 * @param {{ breadcrumb?: HTMLElement|null, title?: HTMLElement|null, subtitle?: HTMLElement|null, tagHost?: HTMLElement|null, grid: HTMLElement|null, gridCount?: number, tagPills?: number }} els
 */
export function renderAuthorPageSkeleton(els) {
  renderInlineSkeleton(els.breadcrumb, 'breadcrumb');
  renderInlineSkeleton(els.title, 'title-lg');
  renderInlineSkeleton(els.subtitle, 'subtitle');
  if (els.tagHost) renderFilterPillsSkeleton(els.tagHost, els.tagPills ?? 6);
  renderPromptGridSkeleton(els.grid, els.gridCount ?? 12);
}

/**
 * Prompt detail page skeleton.
 * @param {{ breadcrumb?: HTMLElement|null, title?: HTMLElement|null, stats?: HTMLElement|null, tags?: HTMLElement|null, content?: HTMLElement|null }} els
 */
export function renderPromptDetailSkeleton(els) {
  renderInlineSkeleton(els.breadcrumb, 'breadcrumb');
  renderInlineSkeleton(els.title, 'title-lg');

  if (els.stats) {
    els.stats.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const li = document.createElement('li');
      li.className = 'opd-skeleton-stat';
      li.setAttribute('aria-hidden', 'true');
      li.innerHTML = skeletonLine('opd-skeleton-line--meta');
      els.stats.appendChild(li);
    }
    els.stats.setAttribute('aria-busy', 'true');
  }

  if (els.tags) {
    els.tags.hidden = false;
    els.tags.innerHTML = '';
    const row = document.createElement('div');
    row.className = 'opd-tag-row opd-skeleton-pills';
    for (let i = 0; i < 4; i++) {
      const chip = document.createElement('span');
      chip.className = 'opd-skeleton-pill opd-skeleton-pill--chip';
      chip.setAttribute('aria-hidden', 'true');
      row.appendChild(chip);
    }
    els.tags.appendChild(row);
  }

  if (els.content) {
    els.content.innerHTML = '';
    els.content.classList.add('opd-skeleton-content-block');
    els.content.setAttribute('aria-busy', 'true');
    for (let i = 0; i < 8; i++) {
      const line = document.createElement('div');
      line.className = `opd-skeleton-line opd-skeleton-line--body${i === 7 ? ' opd-skeleton-line--short' : ''}`;
      line.setAttribute('aria-hidden', 'true');
      els.content.appendChild(line);
    }
  }
}

/**
 * Search modal result list skeleton.
 * @param {HTMLElement|null} container
 * @param {number} [count]
 */
export function renderSearchHitsSkeleton(container, count = 5) {
  if (!container) return;
  container.innerHTML = '';
  container.setAttribute('aria-busy', 'true');

  const list = document.createElement('ul');
  list.className = 'opd-search-list opd-search-list--skeleton';
  list.setAttribute('aria-hidden', 'true');

  for (let i = 0; i < count; i++) {
    const li = document.createElement('li');
    li.className = 'opd-search-hit-skeleton';
    li.innerHTML = `
      ${skeletonLine('opd-skeleton-line--title')}
      ${skeletonLine('opd-skeleton-line--meta')}
    `;
    list.appendChild(li);
  }

  container.appendChild(list);
}
