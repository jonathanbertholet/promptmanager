// sidepanel.js

// COMMENT: Use unified prompt storage for all prompt operations
import * as PromptStorage from '../promptStorage.js';
import { exportPrompts, importPrompts } from '../importExport.js';

// COMMENT: Helper to check if any provider permissions are granted
async function hasAnyGrantedProviderPermission() {
  return new Promise(resolve => {
    try {
      chrome.storage.local.get(['aiProvidersMap'], result => {
        if (!result || !result.aiProvidersMap) {
          resolve(false);
          return;
        }
        const providersMap = result.aiProvidersMap;
        const anyGranted = Object.values(providersMap).some(p => p && p.hasPermission === 'Yes');
        resolve(anyGranted);
      });
    } catch (err) {
      resolve(false);
    }
  });
}

// COMMENT: Track folded state of the "Available" group (collapsed by default)
let llmsAvailableCollapsed = true;
// COMMENT: Track folded state of Prompt Management (collapsed by default)
let pmCollapsed = true;

// COMMENT: Smoothly open/close a collapsible element without auto-scrolling the view
function setCollapsibleOpen(collapsibleEl, open) {
  if (!collapsibleEl) return;
  const scrollEl = document.scrollingElement || document.documentElement || document.body;
  const prevScrollTop = scrollEl.scrollTop;
  const targetHeight = collapsibleEl.scrollHeight;
  if (open) {
    // Ensure transition starts from 0 -> height
    collapsibleEl.classList.add('open');
    collapsibleEl.style.maxHeight = '0px';
    // Force reflow then expand to content height
    // eslint-disable-next-line no-unused-expressions
    collapsibleEl.offsetHeight;
    collapsibleEl.style.maxHeight = `${targetHeight}px`;
  } else {
    // Collapse from current height -> 0
    const currentMax = getComputedStyle(collapsibleEl).maxHeight;
    if (currentMax === 'none') {
      collapsibleEl.style.maxHeight = `${targetHeight}px`;
      // eslint-disable-next-line no-unused-expressions
      collapsibleEl.offsetHeight;
    }
    collapsibleEl.style.maxHeight = '0px';
    collapsibleEl.classList.remove('open');
  }
  // Restore scroll so view does not auto-shift
  queueMicrotask(() => {
    try {
      scrollEl.scrollTop = prevScrollTop;
    } catch (e) {
      window.scrollTo({ top: prevScrollTop, behavior: 'auto' });
    }
  });
  // After transition ends and panel is open, set to 'none' so dynamic content is accommodated
  const onEnd = (e) => {
    if (e.propertyName !== 'max-height') return;
    collapsibleEl.removeEventListener('transitionend', onEnd);
    if (collapsibleEl.classList.contains('open')) {
      collapsibleEl.style.maxHeight = 'none';
    }
  };
  collapsibleEl.addEventListener('transitionend', onEnd);
}

// COMMENT: Build a providers map from storage or compute a fallback by reading llm_providers.json and checking current permissions
async function getProvidersMapOrFallback() {
  return new Promise(async (resolve) => {
    try {
      // First, try the canonical storage source (populated by service worker on install/changes)
      chrome.storage.local.get(['aiProvidersMap'], async (result) => {
        if (result && result.aiProvidersMap && Object.keys(result.aiProvidersMap).length > 0) {
          resolve(result.aiProvidersMap);
          return;
        }
        // Fallback: compute from llm_providers.json + current chrome.permissions
        try {
          const response = await fetch(chrome.runtime.getURL('llm_providers.json'));
          const data = await response.json();
          const list = Array.isArray(data?.llm_providers) ? data.llm_providers : [];
          const computedEntries = await Promise.all(list.map(async (p) => {
            const pattern = p.pattern;
            let permitted = false;
            try {
              permitted = await chrome.permissions.contains({ origins: [pattern] });
            } catch (e) {
              permitted = false;
            }
            return [p.name, {
              hasPermission: permitted ? 'Yes' : 'No',
              urlPattern: p.pattern,
              url: p.url,
              iconUrl: p.icon_url
            }];
          }));
          const computedMap = Object.fromEntries(computedEntries);
          resolve(computedMap);
        } catch (e) {
          resolve({});
        }
      });
    } catch (e) {
      resolve({});
    }
  });
}

// COMMENT: Render the LLMs section with "Activated" and "Available" pills, reflecting storage status and permissions behavior
async function renderLLMsSection() {
  const section = document.getElementById('llms-section');
  const activeWrap = document.getElementById('llms-activated');
  const availableWrap = document.getElementById('llms-available');
  const availableToggle = document.getElementById('llms-available-toggle');
  // COMMENT: Group wrappers for conditional display logic
  const shortcutsGroup = activeWrap ? activeWrap.closest('.llms-group') : null;
  const availableGroup = availableWrap ? availableWrap.closest('.llms-group') : null;
  if (!section || !activeWrap || !availableWrap) return;

  // Clear previous contents
  activeWrap.innerHTML = '';
  availableWrap.innerHTML = '';

  const providersMap = await getProvidersMapOrFallback();
  if (!providersMap || Object.keys(providersMap).length === 0) {
    // Nothing to show; leave containers empty
    return;
  }

  // Split into active vs available
  const entries = Object.entries(providersMap);
  const active = entries.filter(([, v]) => v && v.hasPermission === 'Yes');
  const inactive = entries.filter(([, v]) => !v || v.hasPermission !== 'Yes');

  // Helper to create an icon-only element (anchor) with favicon only
  const createPill = ({ name, iconUrl, url, urlPattern, active }) => {
    const a = document.createElement('a');
    a.className = `llm-pill icon-only ${active ? 'active' : 'inactive'}`;
    a.setAttribute('data-provider', name);
    a.setAttribute('data-url-pattern', urlPattern || '');
    a.setAttribute('title', active ? `Open ${name}` : `Activate ${name}`);
    // Active pills open their provider page
    if (active && url) {
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener';
    } else {
      a.href = '#';
    }

    // Icon
    const img = document.createElement('img');
    img.src = iconUrl || '';
    img.alt = `${name} icon`;
    img.width = 20;
    img.height = 20;
    img.className = 'llm-pill-icon';
    a.appendChild(img);

    if (!active) {
      // Request permission on click for inactive pills
      a.addEventListener('click', (ev) => {
        ev.preventDefault();
        const pattern = a.getAttribute('data-url-pattern');
        if (!pattern) return;
        chrome.permissions.request({ origins: [pattern] }, (granted) => {
          if (granted) {
            // Update storage map so both this UI and the permissions page stay in sync
            // Read, mutate, and write the aiProvidersMap
            chrome.storage.local.get(['aiProvidersMap'], (res) => {
              const map = res && res.aiProvidersMap ? res.aiProvidersMap : providersMap;
              if (!map[name]) {
                map[name] = { hasPermission: 'Yes', urlPattern: pattern, url, iconUrl };
              } else {
                map[name].hasPermission = 'Yes';
                map[name].urlPattern = pattern || map[name].urlPattern;
                map[name].url = url || map[name].url;
                map[name].iconUrl = iconUrl || map[name].iconUrl;
              }
              chrome.storage.local.set({ aiProvidersMap: map });
            });
          }
        });
      });
    }

    return a;
  };

  // Render active
  active
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([name, info]) => {
      activeWrap.appendChild(createPill({
        name,
        iconUrl: info.iconUrl,
        url: info.url,
        urlPattern: info.urlPattern,
        active: true
      }));
    });

  // Render inactive
  inactive
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([name, info]) => {
      availableWrap.appendChild(createPill({
        name,
        iconUrl: info?.iconUrl,
        url: info?.url,
        urlPattern: info?.urlPattern,
        active: false
      }));
    });

  // COMMENT: Apply folded state to Available group; collapsed by default
  // Special rule: if Shortcuts is empty, hide it and force Available open
  const hasActive = active.length > 0;
  if (!hasActive) {
    if (shortcutsGroup) shortcutsGroup.style.display = 'none';
    if (availableGroup) availableGroup.style.display = '';
    llmsAvailableCollapsed = false;
    setCollapsibleOpen(availableWrap, true);
    if (availableToggle) availableToggle.setAttribute('aria-expanded', 'true');
  } else {
    if (shortcutsGroup) shortcutsGroup.style.display = '';
    setCollapsibleOpen(availableWrap, !llmsAvailableCollapsed);
    if (availableToggle) {
      availableToggle.setAttribute('aria-expanded', llmsAvailableCollapsed ? 'false' : 'true');
    }
  }
}

// COMMENT: Toggle visibility between permissions shortcut and prompt list based on granted permissions
async function renderPermissionsGate() {
  const shortcut = document.getElementById('permissions-shortcut');
  const promptList = document.getElementById('prompt-list');
  const emptyState = document.getElementById('empty-state');
  if (!shortcut || !promptList) return;
  const allowed = await hasAnyGrantedProviderPermission();
  if (allowed) {
    // Hide shortcut, show list normally
    shortcut.style.display = 'none';
    promptList.style.display = 'block';
    if (emptyState && promptList.children.length === 0) {
      emptyState.style.display = 'block';
    }
  } else {
    // Show shortcut, hide list and empty state
    shortcut.style.display = 'block';
    promptList.style.display = 'none';
    if (emptyState) emptyState.style.display = 'none';
  }
}

// COMMENT: Render the list of prompts in the sidepanel UI
function displayPrompts(prompts) {
  const promptList = document.getElementById('prompt-list');
  const emptyState = document.getElementById('empty-state');
  const shortcut = document.getElementById('permissions-shortcut');
  promptList.innerHTML = '';
  if (!Array.isArray(prompts) || prompts.length === 0) {
    // If permissions shortcut is visible, prefer it over empty-state
    const shortcutVisible = shortcut && shortcut.style.display !== 'none';
    if (emptyState) emptyState.style.display = shortcutVisible ? 'none' : 'block';
    return;
  }
  if (emptyState) emptyState.style.display = 'none';
  prompts.forEach((prompt, index) => {
    const li = document.createElement('li');
    const titleSpan = document.createElement('span');
    titleSpan.textContent = prompt.title;
    titleSpan.style.margin = '2px';
    titleSpan.style.padding = '3px';
    titleSpan.style.verticalAlign = 'middle';
    titleSpan.style.display = 'inline-block';
    li.appendChild(titleSpan);

    // COMMENT: Copy button (revealed on hover)
    const copyBtn = document.createElement('button');
    const copyImg = document.createElement('img');
    copyImg.src = '../icons/copy.png';
    copyImg.alt = 'Copy';
    copyImg.title = 'Copy to clipboard';
    copyImg.width = 14;
    copyImg.height = 14;
    copyImg.style.verticalAlign = 'middle';
    copyBtn.style.display = 'none';
    copyBtn.style.backgroundColor = '#ffffff00';
    copyBtn.appendChild(copyImg);
    copyBtn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(prompt.content);
    });
    li.appendChild(copyBtn);

    // COMMENT: Edit button (revealed on hover)
    const editBtn = document.createElement('button');
    const editImg = document.createElement('img');
    editImg.src = '../icons/edit-icon.png';
    editImg.alt = 'Edit';
    editImg.title = 'Edit';
    editImg.width = 14;
    editImg.height = 14;
    editImg.style.verticalAlign = 'middle';
    editBtn.style.display = 'none';
    editBtn.style.backgroundColor = '#ffffff00';
    editBtn.appendChild(editImg);
    editBtn.addEventListener('click', () => {
      // COMMENT: Populate the form for editing
      document.getElementById('prompt-title').value = prompt.title;
      document.getElementById('prompt-content').value = prompt.content;
      document.getElementById('prompt-index').value = index;
      document.getElementById('submit-button').textContent = 'Update';
      document.getElementById('cancel-edit-button').style.display = 'inline';
    });
    li.appendChild(editBtn);

    // COMMENT: Delete button (revealed on hover)
    const delBtn = document.createElement('button');
    const delImg = document.createElement('img');
    delImg.src = '../icons/delete.svg';
    delImg.alt = 'Delete';
    delImg.title = 'Delete';
    delImg.width = 18;
    delImg.height = 18;
    delImg.style.verticalAlign = 'middle';
    delBtn.style.display = 'none';
    delBtn.style.backgroundColor = '#ffffff00';
    delBtn.appendChild(delImg);
    delBtn.addEventListener('click', async () => {
      if (!window.confirm('Are you sure you want to delete this prompt?')) return;
      const current = await PromptStorage.getPrompts();
      if (index < 0 || index >= current.length) return;
      await PromptStorage.deletePrompt(current[index].uuid);
    });
    li.appendChild(delBtn);

    // COMMENT: Hover interactions for action buttons
    li.addEventListener('mouseenter', () => {
      copyBtn.style.display = 'inline-block';
      editBtn.style.display = 'inline-block';
      delBtn.style.display = 'inline-block';
    });
    li.addEventListener('mouseleave', () => {
      copyBtn.style.display = 'none';
      editBtn.style.display = 'none';
      delBtn.style.display = 'none';
    });

    document.getElementById('prompt-list').appendChild(li);
  });
}

// COMMENT: Load prompts from storage and render them
async function loadPrompts() {
  const prompts = await PromptStorage.getPrompts();
  displayPrompts(prompts);
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('prompt-form');
  const titleInput = document.getElementById('prompt-title');
  const contentInput = document.getElementById('prompt-content');
  const promptIndexInput = document.getElementById('prompt-index');
  const submitButton = document.getElementById('submit-button');
  const cancelEditButton = document.getElementById('cancel-edit-button');
  const exportBtn = document.getElementById('export-btn');
  const importBtn = document.getElementById('import-btn');
  const importFile = document.getElementById('import-file');
  // COMMENT: Info banner elements for close/dismiss behavior
  const infoBanner = document.getElementById('info-banner');
  const infoBannerClose = document.getElementById('info-banner-close');

  // Load prompts and display
  loadPrompts();
  // COMMENT: Evaluate permissions gate on load
  renderPermissionsGate();
  // COMMENT: Render LLMs section on load
  renderLLMsSection();

  // COMMENT: Wire Available subheading toggle (fold/unfold)
  const availableToggle = document.getElementById('llms-available-toggle');
  const availableWrap = document.getElementById('llms-available');
  if (availableToggle && availableWrap) {
    const toggle = (ev) => {
      if (ev && ev.type === 'keydown') {
        if (ev.key !== 'Enter' && ev.key !== ' ') return;
        ev.preventDefault();
      }
      llmsAvailableCollapsed = !llmsAvailableCollapsed;
      setCollapsibleOpen(availableWrap, !llmsAvailableCollapsed);
      availableToggle.setAttribute('aria-expanded', llmsAvailableCollapsed ? 'false' : 'true');
    };
    availableToggle.addEventListener('click', toggle);
    availableToggle.addEventListener('keydown', toggle);
    // Ensure default collapsed state reflected in DOM
    setCollapsibleOpen(availableWrap, false);
    availableToggle.setAttribute('aria-expanded', 'false');
  }

  // COMMENT: Wire Prompt Management toggle (fold/unfold), collapsed by default
  const pmToggle = document.getElementById('pm-toggle');
  const pmControls = document.getElementById('pm-controls');
  if (pmToggle && pmControls) {
    const togglePM = (ev) => {
      if (ev && ev.type === 'keydown') {
        if (ev.key !== 'Enter' && ev.key !== ' ') return;
        ev.preventDefault();
      }
      pmCollapsed = !pmCollapsed;
      setCollapsibleOpen(pmControls, !pmCollapsed);
      pmToggle.setAttribute('aria-expanded', pmCollapsed ? 'false' : 'true');
    };
    pmToggle.addEventListener('click', togglePM);
    pmToggle.addEventListener('keydown', togglePM);
    // Ensure default collapsed state reflected in DOM
    setCollapsibleOpen(pmControls, false);
    pmToggle.setAttribute('aria-expanded', 'false');
  }

  // COMMENT: Refresh UI whenever prompts change in storage
  PromptStorage.onPromptsChanged(loadPrompts);

  // COMMENT: React to permissions updates live (permissions page writes aiProvidersMap)
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.aiProvidersMap) {
        renderPermissionsGate();
        // COMMENT: Also refresh the LLMs section so pills reflect new activation status
        renderLLMsSection();
      }
    });
  } catch (err) {
    // Ignore if not available
  }

  // Decide whether to show the info banner based on a storage-backed toggle.
  // Default is hidden unless `spm_show_info_banner` is true and the user has not dismissed it.
  if (infoBanner) {
    infoBanner.style.display = 'none'; // default: hidden
  }
  try {
    chrome.storage?.local?.get(['spm_show_info_banner'], (res) => {
      const shouldShow = res && res.spm_show_info_banner === true;
      // Respect prior dismissal stored in localStorage
      const dismissed = (() => {
        try { return localStorage.getItem('spm_info_banner_dismissed') === 'true'; } catch (e) { return false; }
      })();
      if (shouldShow && !dismissed && infoBanner) {
        infoBanner.style.display = '';
      }
    });
  } catch (err) {
    // If storage read fails, keep banner hidden unless already visible by markup
    try {
      const dismissed = localStorage.getItem('spm_info_banner_dismissed') === 'true';
      if (dismissed && infoBanner) infoBanner.style.display = 'none';
    } catch (e) {}
  }

  // Close banner and persist choice
  if (infoBannerClose) {
    infoBannerClose.addEventListener('click', () => {
      if (infoBanner) infoBanner.style.display = 'none';
      try {
        localStorage.setItem('spm_info_banner_dismissed', 'true');
        // Turning off the storage toggle ensures it will not show again
        // until explicitly re-enabled by setting `spm_show_info_banner` to true.
        chrome.storage?.local?.set({ spm_show_info_banner: false });
      } catch (err) {
        // Ignore storage errors
      }
    });
  }

  // Add or update prompt
  form.addEventListener('submit', event => {
    event.preventDefault();
    const title = titleInput.value.trim();
    const content = contentInput.value;

    if (promptIndexInput.value === '') {
      // COMMENT: Add new prompt via unified manager
      PromptStorage.savePrompt({ title, content }).catch(console.error);
    } else {
      // COMMENT: Update existing prompt by mapping index to uuid via unified manager
      const index = parseInt(promptIndexInput.value, 10);
      PromptStorage.getPrompts().then(prompts => {
        if (index >= 0 && index < prompts.length) {
          const uuid = prompts[index].uuid;
          return PromptStorage.updatePrompt(uuid, { title, content });
        }
      }).catch(console.error);
    }

    // Reset form
    titleInput.value = '';
    contentInput.value = '';
    promptIndexInput.value = '';
    submitButton.textContent = 'Save prompt';
    cancelEditButton.style.display = 'none';
  });

  // Cancel edit
  cancelEditButton.addEventListener('click', () => {
    // Reset form
    titleInput.value = '';
    contentInput.value = '';
    promptIndexInput.value = '';
    submitButton.textContent = 'Add Prompt';
    cancelEditButton.style.display = 'none';
  });

  // Export prompts
  exportBtn.addEventListener('click', exportPrompts);

  // Import prompts
  importBtn.addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', event => {
    const file = event.target.files[0];
    if (file) importPrompts(file);
  });
});
