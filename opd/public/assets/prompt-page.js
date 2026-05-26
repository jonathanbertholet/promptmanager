/**
 * Prompt detail page — hero, highlighted content, copy, share, report, import CTA, SEO meta.
 */
import {
  apiGet,
  escapeHtml,
  formatAbsoluteDate,
  formatPromptContentHtml,
  getPromptIdFromLocation,
  renderTagChips,
} from './opd-common.js';
import { importPromptToOpm, opmImportHelpMessage } from './opd-import.js';
import { mountSiteNav } from './opd-nav.js';
import { reportPrompt } from './opd-report.js';
import { applyPromptMeta } from './opd-seo.js';
import { opdIcon } from './opd-icons.js';
import { clearInlineSkeleton, renderPromptDetailSkeleton } from './opd-skeleton.js';
import { sharePrompt } from './opd-share.js';

const els = {
  breadcrumbCurrent: document.getElementById('opd-breadcrumb-current'),
  title: document.getElementById('opd-detail-title'),
  stats: document.getElementById('opd-detail-stats'),
  tags: document.getElementById('opd-detail-tags'),
  content: document.getElementById('opd-detail-content'),
  contentHint: document.getElementById('opd-content-hint'),
  status: document.getElementById('opd-import-status'),
  importBtn: document.getElementById('opd-import-btn'),
  copyBtn: document.getElementById('opd-copy-btn'),
  shareBtn: document.getElementById('opd-share-btn'),
  reportBtn: document.getElementById('opd-report-btn'),
  authorLink: document.getElementById('opd-author-link'),
};

/**
 * Build stat pills for author, date, and import count.
 * @param {object} prompt
 */
function renderStats(prompt) {
  if (!els.stats) return;
  const imports = prompt.stats?.imports ?? 0;
  const importLabel =
    imports === 0 ? 'No imports yet' : `${imports} import${imports === 1 ? '' : 's'}`;

  els.stats.innerHTML = `
    <li>
      ${opdIcon('person')}
      <a href="/u/${encodeURIComponent(prompt.author)}">@${escapeHtml(prompt.author)}</a>
    </li>
    <li>
      ${opdIcon('calendar_today')}
      <time datetime="${escapeHtml(prompt.publishedAt || '')}">${formatAbsoluteDate(prompt.publishedAt)}</time>
    </li>
    <li>
      ${opdIcon('download')}
      <span>${importLabel}</span>
    </li>
  `;
}

/**
 * Brief copy feedback on the button label.
 * @param {HTMLButtonElement} btn
 * @param {string} message
 */
function flashButtonLabel(btn, message) {
  const original = btn.innerHTML;
  btn.innerHTML = `${opdIcon('check')} ${message}`;
  btn.disabled = true;
  setTimeout(() => {
    btn.innerHTML = original;
    btn.disabled = false;
  }, 2000);
}

/** Replace static Material icon placeholders in prompt.html with inline SVG. */
function wireDetailButtonIcons() {
  const map = [
    ['opd-import-btn', 'download'],
    ['opd-copy-btn', 'content_copy'],
    ['opd-share-btn', 'share'],
    ['opd-report-btn', 'flag'],
  ];
  for (const [id, name] of map) {
    const btn = document.getElementById(id);
    const legacy = btn?.querySelector('.material-symbols-rounded');
    if (legacy) legacy.outerHTML = opdIcon(name);
  }
  const trust = document.querySelector('.opd-trust-icon.material-symbols-rounded');
  if (trust) trust.outerHTML = opdIcon('verified_user', 'opd-trust-icon');
}

async function init() {
  wireDetailButtonIcons();
  renderPromptDetailSkeleton({
    breadcrumb: els.breadcrumbCurrent,
    title: els.title,
    stats: els.stats,
    tags: els.tags,
    content: els.content,
  });
  await mountSiteNav('');
  const id = getPromptIdFromLocation();
  if (!id) {
    if (els.status) els.status.textContent = 'Missing prompt id.';
    return;
  }

  try {
    const { prompt } = await apiGet(`/prompts/${encodeURIComponent(id)}`);
    const pageUrl = `${window.location.origin}/p/${encodeURIComponent(prompt.id)}`;
    applyPromptMeta(prompt, pageUrl);

    if (els.breadcrumbCurrent) {
      clearInlineSkeleton(els.breadcrumbCurrent);
      els.breadcrumbCurrent.textContent = prompt.title;
    }
    if (els.title) {
      clearInlineSkeleton(els.title);
      els.title.textContent = prompt.title;
    }
    if (els.stats) els.stats.removeAttribute('aria-busy');
    renderStats(prompt);

    if (els.authorLink) {
      els.authorLink.href = `/u/${encodeURIComponent(prompt.author)}`;
      els.authorLink.textContent = `@${prompt.author}`;
    }

    if (els.tags) renderTagChips(els.tags, prompt.tags, { link: true });

    const hasPlaceholders = /#[a-zA-Z0-9_-]+#/.test(prompt.content || '');
    if (els.contentHint) els.contentHint.hidden = !hasPlaceholders;

    if (els.content) {
      els.content.classList.remove('opd-skeleton-content-block');
      els.content.removeAttribute('aria-busy');
      els.content.innerHTML = formatPromptContentHtml(prompt.content);
    }

    if (els.copyBtn) {
      els.copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(prompt.content);
          if (els.status) els.status.textContent = '';
          flashButtonLabel(els.copyBtn, 'Copied');
        } catch {
          if (els.status) els.status.textContent = 'Copy failed — select the prompt text manually.';
        }
      });
    }

    if (els.shareBtn) {
      els.shareBtn.addEventListener('click', async () => {
        const result = await sharePrompt(prompt);
        if (!els.status) return;
        if (result === 'shared') {
          els.status.textContent = 'Shared.';
        } else if (result === 'copied') {
          els.status.textContent = 'Share link copied to clipboard.';
          flashButtonLabel(els.shareBtn, 'Copied');
        } else if (result === 'cancelled') {
          els.status.textContent = '';
        } else {
          els.status.textContent = 'Share is not supported in this browser.';
        }
      });
    }

    if (els.reportBtn) {
      els.reportBtn.addEventListener('click', () => reportPrompt(prompt));
    }

    if (els.importBtn) {
      els.importBtn.addEventListener('click', async () => {
        els.importBtn.disabled = true;
        const result = await importPromptToOpm(prompt);
        els.importBtn.disabled = false;
        if (result === 'ok') {
          flashButtonLabel(els.importBtn, 'Added!');
        } else if (result === 'updated') {
          flashButtonLabel(els.importBtn, 'Updated!');
        } else if (result === 'already') {
          flashButtonLabel(els.importBtn, 'In library');
        }
        if (!els.status) return;
        if (result === 'ok') {
          els.status.textContent = 'Added to Open Prompt Manager.';
        } else if (result === 'updated') {
          els.status.textContent = 'Updated in Open Prompt Manager (catalog changed).';
        } else if (result === 'already') {
          els.status.textContent = 'Already in your Open Prompt Manager library.';
        } else if (result === 'no_extension') {
          els.status.textContent = opmImportHelpMessage();
        } else {
          els.status.textContent = 'Could not import — try again or copy the prompt manually.';
        }
      });
    }
  } catch (err) {
    if (els.title) els.title.textContent = 'Prompt not found';
    if (els.breadcrumbCurrent) els.breadcrumbCurrent.textContent = 'Not found';
    if (els.status) {
      els.status.textContent =
        err.status === 404 ? 'This prompt does not exist or was removed.' : 'Could not load prompt.';
    }
  }
}

init();
