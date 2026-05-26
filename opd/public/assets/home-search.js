/**
 * Homepage — Google-style search hero + popular tag pills.
 */
import { apiGet } from './opd-common.js';
import { mountHeroSearch } from './opd-hero-search.js';
import { fillMegaTags, mountSiteNav } from './opd-nav.js';
import { renderFilterPillsSkeleton } from './opd-skeleton.js';

const els = {
  searchRoot: document.getElementById('opd-hero-search-root'),
  searchResults: document.getElementById('opd-hero-search-results'),
  popularTags: document.getElementById('opd-hero-popular-tags'),
};

/**
 * @param {{ tag: string, count: number }[]} tags
 */
function renderTagPills(tags) {
  const bar = els.popularTags;
  if (!bar) return;
  bar.innerHTML = '';
  bar.className = 'opd-popular-filter-bar opd-hero-tag-pills';
  bar.removeAttribute('aria-busy');

  for (const { tag, count } of tags) {
    const a = document.createElement('a');
    a.className = 'opd-filter-pill opd-filter-pill--link';
    a.href = `/t/${encodeURIComponent(tag)}`;
    a.textContent = count > 0 ? `${tag} (${count})` : tag;
    bar.appendChild(a);
  }
}

async function loadPopularTags() {
  if (!els.popularTags) return;
  renderFilterPillsSkeleton(els.popularTags, 10);
  try {
    const data = await apiGet('/tags?popular=16');
    const tags = data.items || [];
    if (!tags.length) {
      els.popularTags.hidden = true;
      return;
    }
    renderTagPills(tags);
  } catch {
    els.popularTags.hidden = true;
  }
}

async function init() {
  await mountSiteNav('home', {
    title: 'Open Prompt Database',
    description: 'Search community prompt templates for Open Prompt Manager.',
    path: '/',
  });

  if (els.searchRoot && els.searchResults) {
    mountHeroSearch(els.searchRoot, {
      resultsEl: els.searchResults,
      showLibraryButton: true,
      onSubmit: (q) => {
        if (q) {
          window.location.href = `/browse?q=${encodeURIComponent(q)}`;
        } else {
          window.location.href = '/browse';
        }
      },
    });
    els.searchRoot.querySelector('.opd-hero-search-input')?.focus();
  }

  await Promise.all([loadPopularTags(), fillMegaTags()]);
}

init();
