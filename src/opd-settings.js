/**
 * Entry for opd-settings.html.
 */
import { initOpdSettingsPage } from './opd/opdSettingsPage.js';
import { mountSidepanelFooter } from './sidepanel/sidepanelFooter.js';

document.addEventListener('DOMContentLoaded', async () => {
  await globalThis.OPMI18n.ready;
  const shell = document.querySelector('.settings-page-shell');
  mountSidepanelFooter({ active: 'opd', root: shell || document.body });
  initOpdSettingsPage(document);
});
