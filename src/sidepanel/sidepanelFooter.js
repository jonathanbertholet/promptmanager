/**
 * Shared side panel footer — main side panel + settings subpages.
 */

/** @returns {string} */
export function resolveSidepanelFooterPrefix() {
  return window.location.pathname.includes('/sidepanel/') ? '../' : '';
}

/**
 * @param {{ active?: 'opd'|'settings'|null, root?: HTMLElement }} [options]
 */
export function mountSidepanelFooter({ active = null, root = document.body } = {}) {
  if (root.querySelector('footer.footer')) return;

  const prefix = resolveSidepanelFooterPrefix();
  const footer = document.createElement('footer');
  footer.className = 'footer';

  footer.innerHTML = `
    <div class="footer-icons">
      <a class="footer-icon-link${active === 'opd' ? ' footer-icon-link-active' : ''}" data-footer-page="opd" href="${prefix}opd-settings.html" title="Open Prompt Database">
        <svg class="footer-md-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
      </a>
      <a class="footer-icon-link" href="https://github.com/jonathanbertholet/promptmanager" target="_blank" rel="noopener" title="Github">
        <svg class="footer-md-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.49.5.09.68-.22.68-.48 0-.24-.01-.87-.01-1.7-2.78.62-3.37-1.37-3.37-1.37-.45-1.16-1.11-1.47-1.11-1.47-.91-.64.07-.63.07-.63 1 .07 1.53 1.05 1.53 1.05.89 1.52 2.34 1.08 2.91.83.09-.64.35-1.08.63-1.33-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.27 2.75 1.05A9.2 9.2 0 0 1 12 6.84c.85.004 1.71.12 2.51.34 1.91-1.32 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.81-4.57 5.07.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.8 0 .27.18.58.69.48A10.01 10.01 0 0 0 22 12c0-5.52-4.48-10-10-10z"/></svg>
      </a>
      <a class="footer-icon-link" href="https://buymeacoffee.com/jonathanbertholet" target="_blank" rel="noopener" title="Buy me a coffee">
        <svg class="footer-md-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20 3H4v10c0 2.21 1.79 4 4 4h6c2.21 0 4-1.79 4-4v-3h2c1.11 0 2-.9 2-2V5c0-1.11-.9-2-2-2zm0 5h-2V5h2v3zM4 19h16v2H4v-2z"/></svg>
      </a>
      <a class="footer-icon-link" href="https://chromewebstore.google.com/detail/open-prompt-manager/gmhaghdbihgenofhnmdbglbkbplolain" target="_blank" rel="noopener" title="Review me">
        <svg class="footer-md-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.62L12 2 9.19 8.62 2 9.24l5.46 4.73L5.82 21 12 17.27z"/></svg>
      </a>
      <a class="footer-icon-link${active === 'settings' ? ' footer-icon-link-active' : ''}" data-footer-page="settings" href="${prefix}settings.html" title="Settings">
        <svg class="footer-md-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94L14.4 2.81a.488.488 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.488.488 0 0 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.03-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z"/></svg>
      </a>
      <a class="footer-cta-link" href="${prefix}permissions/permissions.html" title="Get Started" target="_blank" rel="noopener">
        Get Started
      </a>
    </div>
  `;

  root.appendChild(footer);
}
