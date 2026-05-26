/**
 * All tags page — grouped by first letter / character.
 */
import { apiGet, escapeHtml } from './opd-common.js';
import { mountSiteNav } from './opd-nav.js';
import { renderTagsDirectorySkeleton } from './opd-skeleton.js';

const host = document.getElementById('opd-tags-directory');

/**
 * @param {{ tag: string, count: number }[]} items
 */
function groupByLetter(items) {
  /** @type {Map<string, { tag: string, count: number }[]>} */
  const groups = new Map();

  for (const item of items) {
    const first = item.tag.charAt(0);
    const letter = /[a-z]/i.test(first) ? first.toLowerCase() : '#';
    const key = letter === '#' ? '#' : letter.toUpperCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }

  return [...groups.entries()].sort(([a], [b]) => {
    if (a === '#') return 1;
    if (b === '#') return -1;
    return a.localeCompare(b);
  });
}

async function init() {
  await mountSiteNav('tags', {
    title: 'All tags — Open Prompt Database',
    description: 'Browse the full tag directory for community prompts.',
    path: '/tags',
  });
  if (!host) return;

  renderTagsDirectorySkeleton(host, 4, 6);

  try {
    const { items } = await apiGet('/tags');
    host.innerHTML = '';
    host.removeAttribute('aria-busy');

    if (!items.length) {
      host.innerHTML = '<p class="opd-empty">No tags yet.</p>';
      return;
    }

    const groups = groupByLetter(items);

    for (const [letter, tags] of groups) {
      const section = document.createElement('section');
      section.className = 'opd-letter-group settings-section';

      const heading = document.createElement('h3');
      heading.className = 'settings-heading opd-letter-heading';
      heading.textContent = letter;
      section.appendChild(heading);

      const list = document.createElement('ul');
      list.className = 'opd-tag-directory-list';

      for (const { tag, count } of tags) {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = `/t/${encodeURIComponent(tag)}`;
        a.className = 'opd-tag-directory-link';
        a.innerHTML = `${escapeHtml(tag)} <span class="opd-tag-directory-count">${count}</span>`;
        li.appendChild(a);
        list.appendChild(li);
      }

      section.appendChild(list);
      host.appendChild(section);
    }
  } catch {
    host.innerHTML = '<p class="opd-empty">Could not load tags.</p>';
  }
}

init();
