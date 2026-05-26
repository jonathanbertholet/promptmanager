/**
 * Google-style hero search bar (homepage + browse header).
 */
import { opdIcon } from './opd-icons.js';
import {
  runSearchPreview,
  SEARCH_DEBOUNCE_MS,
  renderSearchHint,
} from './opd-search-core.js';

/**
 * @param {HTMLElement} root
 * @param {object} opts
 * @param {HTMLElement} opts.resultsEl
 * @param {boolean} [opts.showLibraryButton]
 * @param {string} [opts.initialQuery]
 * @param {(q: string) => void} [opts.onSubmit]
 * @param {string} [opts.placeholder]
 */
export function mountHeroSearch(root, opts) {
  const {
    resultsEl,
    showLibraryButton = false,
    initialQuery = '',
    onSubmit,
    placeholder = 'Search prompts…',
  } = opts;

  root.className = 'opd-hero-search';
  root.innerHTML = `
    <form class="opd-hero-search-form" role="search" autocomplete="off">
      <div class="opd-hero-search-field">
        <input
          type="search"
          class="opd-hero-search-input"
          placeholder="${placeholder}"
          aria-label="Search prompts"
          autocomplete="off"
        />
        <button type="submit" class="opd-hero-search-submit" aria-label="Search">
          ${opdIcon('search', 'opd-hero-search-icon')}
        </button>
        ${
          showLibraryButton
            ? `<a href="/browse" class="opd-hero-search-library" title="Browse library" aria-label="Browse library">
                 ${opdIcon('apps', 'opd-hero-search-icon')}
               </a>`
            : ''
        }
      </div>
    </form>
  `;

  const form = root.querySelector('.opd-hero-search-form');
  const input = root.querySelector('.opd-hero-search-input');
  let debounceTimer = null;
  let lastQuery = initialQuery.trim();

  if (initialQuery) {
    input.value = initialQuery;
  }

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      lastQuery = input.value.trim();
      void runSearchPreview(resultsEl, lastQuery);
    }, SEARCH_DEBOUNCE_MS);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const links = [...resultsEl.querySelectorAll('.opd-search-hit')];
      if (!links.length) return;
      e.preventDefault();
      const active = document.activeElement;
      let idx = links.indexOf(active);
      if (e.key === 'ArrowDown') idx = idx < links.length - 1 ? idx + 1 : 0;
      else idx = idx > 0 ? idx - 1 : links.length - 1;
      links[idx].focus();
      return;
    }
    if (e.key === 'Enter') {
      const active = document.activeElement;
      if (active?.classList?.contains('opd-search-hit')) return;
      e.preventDefault();
      form.requestSubmit();
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value.trim();
    lastQuery = q;
    if (onSubmit) {
      onSubmit(q);
      return;
    }
    if (q) {
      window.location.href = `/browse?q=${encodeURIComponent(q)}`;
    }
  });

  if (lastQuery) {
    void runSearchPreview(resultsEl, lastQuery);
  } else {
    renderSearchHint(resultsEl, 'Type to search the prompt catalog.');
  }

  return {
    input,
    focus: () => input.focus(),
    setQuery: (q) => {
      input.value = q;
      lastQuery = q.trim();
      void runSearchPreview(resultsEl, lastQuery);
    },
  };
}
