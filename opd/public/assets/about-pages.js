/**
 * Shared init for About and Changelog static pages (subnav + site header).
 */
import { mountSiteNav } from './opd-nav.js';

const CHROME_STORE_URL =
  'https://chromewebstore.google.com/detail/open-prompt-manager/gmhaghdbihgenofhnmdbglbkbplolain';

/**
 * @param {{ tab: 'about' | 'changelog', title: string, description: string, path: string }} opts
 */
export async function initAboutPage(opts) {
  document.querySelectorAll('.opd-about-subnav-link').forEach((link) => {
    const active = link.dataset.opdAboutTab === opts.tab;
    link.classList.toggle('is-active', active);
    if (active) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });

  const cta = document.getElementById('opd-about-chrome-cta');
  if (cta) {
    cta.href = CHROME_STORE_URL;
  }

  await mountSiteNav('about', {
    title: opts.title,
    description: opts.description,
    path: opts.path,
  });
}
