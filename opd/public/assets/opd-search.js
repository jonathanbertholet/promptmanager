/**
 * Site-wide prompt search modal (⌘K / Ctrl+K).
 */
import {
  runSearchPreview,
  SEARCH_DEBOUNCE_MS,
  renderSearchHint,
} from './opd-search-core.js';
import { opdIcon } from './opd-icons.js';

let modalEl = null;
let inputEl = null;
let resultsEl = null;
let debounceTimer = null;
let lastQuery = '';

/**
 * Build search modal DOM once.
 */
function ensureSearchModal() {
  if (modalEl) return;

  modalEl = document.createElement('div');
  modalEl.id = 'opd-search-modal';
  modalEl.className = 'opd-search-modal';
  modalEl.setAttribute('role', 'dialog');
  modalEl.setAttribute('aria-modal', 'true');
  modalEl.setAttribute('aria-label', 'Search prompts');
  modalEl.hidden = true;
  modalEl.innerHTML = `
    <div class="opd-search-backdrop" data-opd-search-close></div>
    <div class="opd-search-dialog">
      <div class="opd-search-header">
        <span class="opd-search-header-label">Search prompts</span>
        <kbd class="opd-search-kbd">ESC</kbd>
        <button type="button" class="opd-search-close" aria-label="Close search" data-opd-search-close>
          ${opdIcon('close')}
        </button>
      </div>
      <div class="opd-search-input-wrap">
        ${opdIcon('search', 'opd-search-input-icon')}
        <input type="search" class="opd-search-input" placeholder="Search by title or prompt text…" autocomplete="off" aria-label="Search prompts" />
      </div>
      <div class="opd-search-results" aria-live="polite"></div>
    </div>
  `;
  document.body.appendChild(modalEl);

  inputEl = modalEl.querySelector('.opd-search-input');
  resultsEl = modalEl.querySelector('.opd-search-results');

  modalEl.querySelectorAll('[data-opd-search-close]').forEach((el) => {
    el.addEventListener('click', closeSearch);
  });

  inputEl.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      lastQuery = inputEl.value.trim();
      void runSearchPreview(resultsEl, lastQuery);
    }, SEARCH_DEBOUNCE_MS);
  });

  inputEl.addEventListener('keydown', (e) => {
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
    if (e.key === 'Enter' && lastQuery) {
      const active = document.activeElement;
      if (active?.classList?.contains('opd-search-hit')) return;
      window.location.href = `/browse?q=${encodeURIComponent(lastQuery)}`;
    }
  });
}

/**
 * @param {Element|null} el
 */
function isEditableTarget(el) {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

export function openSearch() {
  ensureSearchModal();
  modalEl.hidden = false;
  document.body.classList.add('opd-search-open');
  inputEl.value = '';
  lastQuery = '';
  renderSearchHint(resultsEl, 'Type to search the prompt catalog.');
  setTimeout(() => inputEl.focus(), 50);
}

export function closeSearch() {
  if (!modalEl) return;
  modalEl.hidden = true;
  document.body.classList.remove('opd-search-open');
}

/**
 * Wire search button + global keyboard shortcut.
 */
export function initSearch() {
  ensureSearchModal();

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      if (modalEl.hidden) openSearch();
      else closeSearch();
      return;
    }
    if (e.key === '/' && !isEditableTarget(e.target) && modalEl?.hidden) {
      const onHome = document.body.classList.contains('opd-page-home');
      if (onHome) {
        document.querySelector('.opd-hero-search-input')?.focus();
        return;
      }
      e.preventDefault();
      openSearch();
      return;
    }
    if (e.key === 'Escape' && modalEl && !modalEl.hidden) {
      closeSearch();
    }
  });

  window.__opdOpenSearch = openSearch;
}
