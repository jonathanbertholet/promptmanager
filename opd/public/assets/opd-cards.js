/**
 * Prompt card grid rendering (2-column layout).
 */
import { formatRelativeDate } from './opd-common.js';
import { opdIcon } from './opd-icons.js';
import { importPromptToOpm, opmImportHelpMessage } from './opd-import.js';
import { renderPromptGridSkeleton } from './opd-skeleton.js';

export { renderPromptGridSkeleton };

/**
 * @param {HTMLElement} container
 * @param {object[]} prompts
 * @param {{ emptyMessage?: string, hideAuthor?: boolean, append?: boolean }} [opts]
 */
export function renderPromptGrid(container, prompts, opts = {}) {
  if (!Array.isArray(prompts) || prompts.length === 0) {
    if (!opts.append) {
      container.innerHTML = '';
      const empty = document.createElement('p');
      empty.className = 'opd-empty';
      empty.textContent = opts.emptyMessage || 'No prompts found.';
      container.appendChild(empty);
    }
    return;
  }

  let grid = container.querySelector('.opd-prompt-grid');
  container.removeAttribute('aria-busy');

  if (!grid || !opts.append) {
    if (!opts.append) container.innerHTML = '';
    grid = document.createElement('div');
    grid.className = 'opd-prompt-grid';
    grid.setAttribute('role', 'list');
    container.appendChild(grid);
  }

  for (const p of prompts) {
    const card = document.createElement('article');
    card.className = 'opd-prompt-card';
    card.setAttribute('role', 'listitem');
    card.tabIndex = 0;

    const title = document.createElement('h4');
    title.className = 'opd-prompt-title';
    title.textContent = p.title;

    // Overlay button — does not affect card layout (positioned in CSS)
    const importBtn = document.createElement('button');
    importBtn.type = 'button';
    importBtn.className = 'opd-card-import';
    importBtn.setAttribute('aria-label', `Import “${p.title}” into Open Prompt Manager`);
    importBtn.title = 'Add to Open Prompt Manager';
    importBtn.innerHTML = opdIcon('add');

    importBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      void handleCardImport(importBtn, p);
    });

    const meta = document.createElement('p');
    meta.className = 'opd-prompt-meta';
    const imports = p.stats?.imports ?? 0;
    const importLabel = `${imports} import${imports === 1 ? '' : 's'}`;
    meta.textContent = opts.hideAuthor
      ? `${formatRelativeDate(p.publishedAt)} · ${importLabel}`
      : `@${p.author} · ${formatRelativeDate(p.publishedAt)} · ${importLabel}`;

    const snippet = document.createElement('p');
    snippet.className = 'opd-prompt-snippet';
    const preview = p.snippet || p.content || '';
    snippet.textContent = String(preview).replace(/\s+/g, ' ').trim();

    card.appendChild(title);
    card.appendChild(importBtn);
    card.appendChild(meta);

    if (p.tags?.length) {
      const tagRow = document.createElement('div');
      tagRow.className = 'opd-tag-row';
      for (const tag of p.tags.slice(0, 4)) {
        const chip = document.createElement('span');
        chip.className = 'opd-tag-chip';
        chip.textContent = tag;
        tagRow.appendChild(chip);
      }
      card.appendChild(tagRow);
    }
    card.appendChild(snippet);

    const open = () => {
      window.location.href = `/p/${encodeURIComponent(p.id)}`;
    };
    card.addEventListener('click', open);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });

    grid.appendChild(card);
  }
}

/** Reset card import control after transient success state. */
function resetCardImportBtn(btn, prompt) {
  btn.classList.remove('is-done', 'is-already');
  btn.innerHTML = opdIcon('add');
  btn.setAttribute('aria-label', `Import “${prompt.title}” into Open Prompt Manager`);
  btn.title = 'Add to Open Prompt Manager';
}

/**
 * Run OPM import and show brief feedback on the card button.
 * @param {HTMLButtonElement} btn
 * @param {object} prompt
 */
async function handleCardImport(btn, prompt) {
  btn.classList.add('is-busy');
  btn.disabled = true;

  const result = await importPromptToOpm(prompt);

  btn.classList.remove('is-busy');
  btn.disabled = false;

  if (result === 'ok' || result === 'updated') {
    btn.classList.remove('is-already');
    btn.classList.add('is-done');
    btn.innerHTML = result === 'updated' ? `${opdIcon('check')} Updated!` : `${opdIcon('check')} Added!`;
    btn.setAttribute(
      'aria-label',
      result === 'updated'
        ? `Updated “${prompt.title}” in Open Prompt Manager`
        : `Added “${prompt.title}” to Open Prompt Manager`
    );
    btn.title = result === 'updated' ? 'Updated in Open Prompt Manager' : 'Added to Open Prompt Manager';
    setTimeout(() => resetCardImportBtn(btn, prompt), 2000);
    return;
  }

  if (result === 'already') {
    btn.classList.remove('is-done');
    btn.classList.add('is-already', 'is-done');
    btn.innerHTML = `${opdIcon('check')} In library`;
    btn.setAttribute('aria-label', `“${prompt.title}” is already in Open Prompt Manager`);
    btn.title = 'Already in your Open Prompt Manager library';
    setTimeout(() => resetCardImportBtn(btn, prompt), 2500);
    return;
  }

  if (result === 'no_extension') {
    btn.title = opmImportHelpMessage() || 'Install Open Prompt Manager to import';
    return;
  }

  btn.title = 'Import failed — try again or open the prompt page';
}
