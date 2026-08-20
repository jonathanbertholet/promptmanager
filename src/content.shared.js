/* ============================================================================
   Prompt Manager Shared UI Helpers (content.shared.js)
   COMMENT: Houses TagService, TagUI, and PromptUI so content.js stays lean.
   ============================================================================ */
(function registerPromptManagerShared() {
  function initPromptManagerShared() {
    if (window.__OPM_PROMPT_SHARED__) return;
    window.__OPM_PROMPT_SHARED__ = true;

    // COMMENT: Sync with src/opd/opdConstants.js OPD_CATALOG_URL
    const OPD_CATALOG_URL = 'https://openpromptdatabase.com';
    // COMMENT: Same people/community SVG as the sidebar footer OPD link
    const OPD_COMMUNITY_ICON_SVG = '<svg class="footer-md-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>';

    const createEl = window.createEl;
    const debounce = window.debounce || ((fn, wait = 100) => {
      let timeout;
      return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(null, args), wait);
      };
    });
    const getMode = window.getMode;
    const getIconFilterFn = window.getIconFilter;
    const showEl = window.showEl;
    const hideEl = window.hideEl;
    const SELECTORS = window.SELECTORS;
    const PanelRouter = window.PanelRouter;
    const PanelView = window.PanelView;
    const PromptUIManager = window.PromptUIManager;
    const PromptStorageManager = window.PromptStorageManager;
    if (!createEl || !getMode || !showEl || !hideEl || !SELECTORS || !PanelRouter || !PanelView || !PromptUIManager || !PromptStorageManager) {
      window.__OPM_PROMPT_SHARED__ = false;
      console.warn('[PromptManager] Shared helpers unavailable; deferring initialization.');
      return;
    }

    const fallbackIconFilter = 'invert(37%) sepia(74%) saturate(380%) hue-rotate(175deg) brightness(93%) contrast(88%)';
    const iconFilter = () => (typeof getIconFilterFn === 'function' ? getIconFilterFn() : fallbackIconFilter);

    const ICON_SVGS = {
      list: `<img src="${chrome.runtime.getURL('icons/list.svg')}" width="16" height="16" alt="List Prompts" title="List Prompts" style="filter: ${iconFilter()}">`,
      add: `<img src="${chrome.runtime.getURL('icons/new.svg')}" width="16" height="16" alt="Add Prompt" title="Add Prompt" style="filter: ${iconFilter()}">`,
      delete: `<img src="${chrome.runtime.getURL('icons/delete.svg')}" width="16" height="16" alt="Delete" title="Delete" style="filter: ${iconFilter()}">`,
      edit: `<img src="${chrome.runtime.getURL('icons/edit.svg')}" width="16" height="16" alt="Edit" title="Edit" style="filter: ${iconFilter()}">`,
      settings: `<img src="${chrome.runtime.getURL('icons/settings.svg')}" width="16" height="16" alt="Settings" title="Settings" style="filter: ${iconFilter()}">`,
      changelog: `<img src="${chrome.runtime.getURL('icons/notes.svg')}" width="16" height="16" alt="Changelog" title="Changelog" style="filter: ${iconFilter()}">`,
    };

    const TagService = (() => {
      const computeCounts = (prompts = []) => {
        const counts = new Map();
        prompts.forEach(p => (Array.isArray(p.tags) ? p.tags : []).forEach(t => {
          const key = String(t).trim();
          if (!key) return;
          counts.set(key, (counts.get(key) || 0) + 1);
        }));
        return counts;
      };

      const getCounts = async (prompts) => {
        if (!Array.isArray(prompts)) {
          try { prompts = await window.PromptStorageManager.getPrompts(); } catch (_) { prompts = []; }
        }
        return computeCounts(prompts);
      };

      const getOrderedTags = async (countsOrPrompts) => {
        const counts = countsOrPrompts instanceof Map ? countsOrPrompts : await getCounts(countsOrPrompts);
        const order = await window.PromptStorageManager.getTagsOrder();
        const tags = Array.from(counts.keys());
        const missing = tags.filter(t => !order.includes(t)).sort((a, b) => a.localeCompare(b));
        return [...order.filter(t => counts.has(t)), ...missing];
      };

      const getSuggestions = async ({ term = '', exclude = new Set() } = {}) => {
        const counts = await getCounts();
        const ordered = await getOrderedTags(counts);
        const lcTerm = term.trim().toLowerCase();
        return ordered.filter(t => !exclude.has(t) && (lcTerm === '' || String(t).toLowerCase().includes(lcTerm)));
      };

      return { getCounts, getOrderedTags, getSuggestions };
    })();
    window.TagService = TagService;

    const TagUI = (() => {
      const openInputs = new Set();

      const createTagInput = ({ initialTags = [] } = {}) => {
        const tagsSet = new Set(Array.isArray(initialTags) ? initialTags : []);
        const row = createEl('div', { className: `opm-tag-row opm-${getMode()}` });
        const pills = createEl('div', { className: 'opm-tags-container' });
        const input = createEl('input', { attributes: { type: 'text', placeholder: 'Enter tags here.' }, className: `opm-tag-input opm-${getMode()}` });
        const suggestions = createEl('div', { className: `opm-tag-suggestions opm-${getMode()}`, styles: { display: 'none' } });
        let activeIndex = -1; let options = [];
        let destroyed = false;

        const renderPills = () => {
          pills.innerHTML = '';
          Array.from(tagsSet).forEach(tag => {
            const pill = createEl('span', { className: `opm-tag-pill opm-${getMode()}`, innerHTML: String(tag) });
            const removeBtn = createEl('button', { className: 'opm-tag-remove', innerHTML: '×' });
            removeBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              tagsSet.delete(tag);
              if (pill && pill.parentNode) pill.parentNode.removeChild(pill);
            });
            pill.appendChild(removeBtn);
            pills.appendChild(pill);
          });
        };

        const mountSuggestionsPortal = () => {
          const root = document.getElementById(SELECTORS.ROOT) || document.body;
          if (suggestions.parentElement !== root) root.appendChild(suggestions);
          suggestions.style.position = 'fixed';
          suggestions.style.zIndex = '100000';
        };

        const positionSuggestions = () => {
          const rect = row.getBoundingClientRect();
          suggestions.style.left = `${Math.max(0, rect.left)}px`;
          const spaceAbove = rect.top;
          const desiredHeight = Math.min(160, window.innerHeight * 0.4);
          if (spaceAbove > desiredHeight + 8) {
            suggestions.style.top = `${rect.top}px`;
            suggestions.style.transform = 'translateY(-100%)';
          } else {
            suggestions.style.top = `${rect.bottom}px`;
            suggestions.style.transform = 'translateY(2px)';
          }
          suggestions.style.minWidth = `${Math.max(180, rect.width - 12)}px`;
        };

        const addTag = (val) => {
          const tag = (val || '').trim();
          if (!tag || tagsSet.has(tag)) return;
          tagsSet.add(tag);
          renderPills();
          activeIndex = -1;
          suggestions.style.display = 'none';
        };

        const refreshSuggestions = async () => {
          options = await TagService.getSuggestions({ term: input.value, exclude: tagsSet });
          suggestions.innerHTML = '';
          options.forEach((t, idx) => {
            const item = createEl('div', { className: 'opm-tag-suggestion-item', innerHTML: t });
            if (idx === activeIndex) item.classList.add('active');
            item.addEventListener('mousedown', e => {
              e.preventDefault();
              e.stopPropagation();
              addTag(t);
              input.value = '';
              suggestions.style.display = 'none';
            });
            item.addEventListener('click', e => e.stopPropagation());
            suggestions.appendChild(item);
          });
          if (options.length > 0) {
            mountSuggestionsPortal();
            positionSuggestions();
            suggestions.style.display = 'block';
          } else {
            suggestions.style.display = 'none';
          }
        };

        input.addEventListener('input', () => {
          activeIndex = -1;
          const term = input.value.trim();
          if (term.length === 0) { suggestions.style.display = 'none'; options = []; return; }
          refreshSuggestions();
        });
        input.addEventListener('keydown', e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            if (activeIndex >= 0 && activeIndex < options.length) { addTag(options[activeIndex]); input.value = ''; } else { addTag(input.value); input.value = ''; }
            suggestions.style.display = 'none';
          }
          if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); activeIndex = Math.min(activeIndex + 1, options.length - 1); refreshSuggestions(); }
          if (e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); activeIndex = Math.max(activeIndex - 1, -1); refreshSuggestions(); }
          if (e.key === 'Escape') { e.stopPropagation(); suggestions.style.display = 'none'; }
        });
        input.addEventListener('focus', () => { suggestions.style.display = 'none'; });
        input.addEventListener('blur', () => { suggestions.style.display = 'none'; });

        // COMMENT: Named listeners so destroy() can detach them when the form is replaced
        const onDocumentClick = (evt) => {
          if (!suggestions.contains(evt.target)) suggestions.style.display = 'none';
        };
        const onWindowResize = () => positionSuggestions();
        const onWindowScroll = () => positionSuggestions();
        document.addEventListener('click', onDocumentClick);
        window.addEventListener('resize', onWindowResize);
        window.addEventListener('scroll', onWindowScroll, true);

        const destroy = () => {
          if (destroyed) return;
          destroyed = true;
          document.removeEventListener('click', onDocumentClick);
          window.removeEventListener('resize', onWindowResize);
          window.removeEventListener('scroll', onWindowScroll, true);
          if (suggestions.parentElement) suggestions.parentElement.removeChild(suggestions);
          openInputs.delete(api);
        };

        renderPills();
        row.append(pills, input);
        const api = { element: row, getTags: () => Array.from(tagsSet), destroy };
        openInputs.add(api);
        return api;
      };

      const destroyOpenInputs = () => {
        Array.from(openInputs).forEach((tagInput) => tagInput.destroy());
      };

      return { createTagInput, destroyOpenInputs };
    })();
    window.TagUI = TagUI;

    const PromptUI = (() => {
      const State = {
        manuallyOpened: false,
        inVariableInputMode: false,
        closeTimer: null
      };

      // COMMENT: Document-level listeners that outlive a view must be aborted on remount
      let shortcutRecordingHandler = null;
      let abortReorderDrag = null;

      const stopShortcutRecording = () => {
        if (!shortcutRecordingHandler) return;
        document.removeEventListener('keydown', shortcutRecordingHandler, true);
        shortcutRecordingHandler = null;
      };

      const abortTransientListeners = () => {
        stopShortcutRecording();
        abortReorderDrag?.();
      };

      const Elements = {
        createPanelContent() {
          return createEl('div', { id: SELECTORS.PANEL_CONTENT });
        },
        createTagsBar({ tags = [], counts = new Map(), onSelect, selectedTag = 'all' } = {}) {
          const bar = createEl('div', { className: `opm-tags-filter-bar opm-${getMode()}` });
          window.ScrollVisibilityManager?.observe(bar);

          const makePill = (label, isSelected = false) => {
            const pill = createEl('button', { className: `opm-tag-pill-filter opm-${getMode()}`, attributes: { 'aria-pressed': String(!!isSelected) } });
            pill.textContent = label;
            return pill;
          };

          let current = selectedTag || 'all';
          const updateSelected = (nextTag) => {
            current = nextTag;
            Array.from(bar.children).forEach(child => {
              const isSelected = child.dataset && child.dataset.tag === current;
              child.setAttribute('aria-pressed', String(isSelected));
            });
          };

          const allPill = makePill('All', (selectedTag || 'all') === 'all');
          allPill.dataset.tag = 'all';
          allPill.addEventListener('click', e => { e.stopPropagation(); if (typeof onSelect === 'function') onSelect('all'); updateSelected('all'); });
          bar.appendChild(allPill);

          tags.forEach(tag => {
            const count = counts.get(tag) || 0;
            const pill = makePill(count > 0 ? `${tag}` : tag, (selectedTag || 'all') === tag);
            pill.dataset.tag = tag;
            pill.addEventListener('click', e => { e.stopPropagation(); if (typeof onSelect === 'function') onSelect(tag); updateSelected(tag); });
            bar.appendChild(pill);
          });

          return bar;
        },
        createItemsContainer({ mode = 'list' } = {}) {
          const classes = [
            SELECTORS.PROMPT_ITEMS_CONTAINER,
            'opm-prompt-list-items',
            'opm-view-list',
            `opm-${getMode()}`
          ];
          if (mode === 'edit') classes.push('opm-edit-mode');
          return createEl('div', { className: classes.join(' ') });
        },
        createPromptItem(prompt) {
          const item = createEl('div', {
            className: `opm-prompt-list-item opm-${getMode()}`,
            eventListeners: {
              click: () => PromptUIManager.emitPromptSelect(prompt),
              mouseenter: () => {
                document.querySelectorAll(`#${SELECTORS.ROOT} .opm-prompt-list-item`).forEach(i => i.classList.remove('opm-keyboard-selected'));
                PromptUIManager.cancelCloseTimer();
              }
            }
          });
          const text = createEl('div', { styles: { flex: '1' } });
          text.textContent = prompt.title;
          item.appendChild(text);
          item.dataset.title = prompt.title.toLowerCase();
          item.dataset.content = prompt.content.toLowerCase();
          item.dataset.tags = Array.isArray(prompt.tags) ? prompt.tags.map(t => String(t).toLowerCase()).join(' ') : '';
          item.dataset.tagsList = JSON.stringify(Array.isArray(prompt.tags) ? prompt.tags.map(t => String(t).toLowerCase()) : []);
          return item;
        },
        createEditablePromptItem(prompt, idx, reorder) {
          const item = createEl('div', {
            className: `opm-prompt-list-item opm-${getMode()}`,
            styles: {
              justifyContent: 'space-between',
              padding: '6px 12px',
              margin: '6px 0',
              borderRadius: '10px',
              gap: '8px'
            },
            eventListeners: {
              click: () => PromptUIManager.emitPromptSelect(prompt),
              mouseenter: () => {
                document.querySelectorAll(`#${SELECTORS.ROOT} .opm-prompt-list-item`).forEach(i => i.classList.remove('opm-keyboard-selected'));
                PromptUIManager.cancelCloseTimer();
              }
            }
          });
          item.dataset.index = idx;
          item.dataset.title = prompt.title.toLowerCase();
          item.dataset.content = prompt.content.toLowerCase();
          item.dataset.tags = Array.isArray(prompt.tags) ? prompt.tags.map(t => String(t).toLowerCase()).join(' ') : '';
          item.dataset.tagsList = JSON.stringify(Array.isArray(prompt.tags) ? prompt.tags.map(t => String(t).toLowerCase()) : []);

          const dragHandle = createEl('div', {
            className: 'opm-drag-handle opm-edit-only',
            innerHTML: `
            <img 
              src="${chrome.runtime.getURL('icons/drag_indicator.svg')}" 
              width="16" 
              height="16" 
              alt="Drag handle" 
              title="Drag to reorder"
              style="display: block; opacity: 0.9; filter: ${iconFilter()}"
            >
          `,
            styles: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '16px',
              height: '16px',
              margin: '0',
              flex: '0 0 auto',
              cursor: 'grab',
              userSelect: 'none',
              opacity: '0.9'
            }
          });

          reorder?.wireItem(item, idx, dragHandle);

          const info = createEl('div', { styles: { display: 'flex', flexDirection: 'column', flex: '1', gap: '2px' } });
          const text = createEl('div', { styles: { flex: '0 0 auto' } });
          text.textContent = prompt.title;
          info.appendChild(text);

          const actions = createEl('div', { className: 'opm-edit-only', styles: { display: 'flex', gap: '4px', flex: '0 0 auto' } });
          const editIcon = Elements.createIconButton('edit', (e) => { e.stopPropagation(); window.PromptUIManager.showEditForm(prompt); });
          const deleteIcon = Elements.createIconButton('delete', (e) => {
            e.stopPropagation();
            if (confirm(`Delete "${prompt.title}"?`)) window.PromptUIManager.deletePrompt(prompt.uuid);
          });
          actions.append(editIcon, deleteIcon);

          item.append(dragHandle, info, actions);
          return item;
        },
        createIconButton(type, onClick) {
          return createEl('button', { className: 'opm-icon-button', eventListeners: { click: onClick }, innerHTML: ICON_SVGS[type] || '' });
        },
        createMenuBar() {
          const bar = createEl('div', { styles: { display: 'flex', alignItems: 'center', justifyContent: 'space-evenly', width: '100%' } });
          const btns = ['list', 'add', 'edit', 'changelog', 'settings'];
          const actions = {
            list: e => { e.stopPropagation(); PromptUIManager.manuallyOpened = true; PanelRouter.mount(PanelView.LIST); },
            add: e => { e.stopPropagation(); PromptUIManager.manuallyOpened = true; PanelRouter.mount(PanelView.CREATE); },
            edit: e => { e.stopPropagation(); PromptUIManager.manuallyOpened = true; PanelRouter.mount(PanelView.EDIT); },
            settings: e => { e.stopPropagation(); PromptUIManager.manuallyOpened = true; PanelRouter.mount(PanelView.SETTINGS); },
            changelog: e => { e.stopPropagation(); PromptUIManager.manuallyOpened = true; PanelRouter.mount(PanelView.CHANGELOG); },
          };
          btns.forEach(type => bar.appendChild(Elements.createIconButton(type, actions[type])));
          return bar;
        },
        /** COMMENT: Link to Open Prompt Database — shown below Create Prompt (in-page panel). */
        createOpdCatalogLink() {
          const dark = typeof window.isDarkMode === 'function' ? window.isDarkMode() : getMode() === 'dark';
          const link = createEl('a', {
            className: `opm-opd-catalog-link opm-${getMode()}`,
            attributes: {
              href: `${OPD_CATALOG_URL}/`,
              target: '_blank',
              rel: 'noopener noreferrer',
            },
            styles: {
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              marginTop: '4px',
              padding: '10px 12px',
              borderRadius: '6px',
              textDecoration: 'none',
              fontSize: '12px',
              lineHeight: '1.45',
              flexShrink: '0',
              border: dark ? '1px solid rgba(99, 179, 237, 0.25)' : '1px solid rgba(54, 116, 181, 0.2)',
              backgroundColor: dark ? 'rgba(54, 116, 181, 0.15)' : '#ebf8ff',
              color: dark ? '#E2E8F0' : '#2C5282',
            },
          });
          const icon = createEl('span', {
            className: 'opm-opd-catalog-link-icon',
            attributes: { 'aria-hidden': 'true' },
            innerHTML: OPD_COMMUNITY_ICON_SVG,
          });
          const text = createEl('span', {
            className: 'opm-opd-catalog-link-text',
            innerHTML: 'Import Community Prompts',
          });
          link.append(icon, text);
          link.addEventListener('click', (e) => e.stopPropagation());
          return link;
        },
        createBottomMenu() {
          const menu = createEl('div', {
            className: `opm-bottom-menu opm-${getMode()}`,
            styles: { display: 'flex', flexDirection: 'column', gap: '10px', padding: '10px 10px 5px 10px', borderTop: '1px solid var(--light-border)' }
          });
          const search = createEl('input', {
            id: SELECTORS.PROMPT_SEARCH_INPUT,
            className: `opm-search-input opm-${getMode()}`,
            attributes: { type: 'text', placeholder: 'Type to search', style: 'border-radius: 4px;' }
          });
          search.addEventListener('input', debounce(e => {
            PromptUIManager.filterPromptItems(e.target.value);
          }, 120));
          menu.appendChild(search);
          menu.appendChild(Elements.createMenuBar());
          return menu;
        },
        createToggleRow({ labelText, getValue, onToggle }) {
          const row = createEl('div', { styles: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } });
          const label = createEl('label', { innerHTML: labelText, styles: { fontSize: '14px' } });
          const toggleSwitch = createEl('div', {
            className: `opm-toggle-switch opm-${getMode()}`
          });

          const applyValue = (active) => {
            if (active) toggleSwitch.classList.add('active'); else toggleSwitch.classList.remove('active');
          };

          toggleSwitch.addEventListener('click', e => {
            e.stopPropagation();
            const nextActive = !toggleSwitch.classList.contains('active');
            applyValue(nextActive);
            Promise.resolve(onToggle?.(nextActive)).catch(err => console.error('[PromptManager] Toggle handler failed:', err));
          });

          Promise.resolve(getValue?.())
            .then(applyValue)
            .catch(err => console.warn('[PromptManager] Failed to initialize toggle state:', err));

          row.append(label, toggleSwitch);
          return row;
        },
        // COMMENT: Three-way launcher mode picker for the in-page settings panel
        createLauncherModePicker({ getValue, onChange }) {
          const wrapper = createEl('div', { styles: { display: 'flex', flexDirection: 'column', gap: '8px' } });
          const title = createEl('div', {
            styles: { fontWeight: 'bold', fontSize: '14px' },
            innerHTML: 'Launcher mode',
          });
          const optionsWrap = createEl('div', { styles: { display: 'flex', flexDirection: 'column', gap: '6px' } });
          const modes = [
            { value: 'standard', label: 'Floating button' },
            { value: 'hotCorner', label: 'Hot corner' },
            { value: 'invisible', label: 'Invisible (shortcut only)' },
          ];

          const syncChecked = (activeMode) => {
            optionsWrap.querySelectorAll('input[type="radio"]').forEach((radio) => {
              radio.checked = radio.value === activeMode;
            });
          };

          modes.forEach(({ value, label }) => {
            const row = createEl('label', {
              styles: {
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '14px',
                cursor: 'pointer',
              },
            });
            const radio = createEl('input', {
              attributes: { type: 'radio', name: 'opm-display-mode', value },
            });
            radio.addEventListener('change', () => {
              if (!radio.checked) return;
              Promise.resolve(onChange?.(value))
                .then(() => syncChecked(value))
                .catch(err => console.error('[PromptManager] Launcher mode change failed:', err));
            });
            row.append(radio, createEl('span', { innerHTML: label }));
            optionsWrap.appendChild(row);
          });

          Promise.resolve(getValue?.())
            .then(syncChecked)
            .catch(err => console.warn('[PromptManager] Failed to initialize launcher mode picker:', err));

          wrapper.append(title, optionsWrap);
          return wrapper;
        }
      };

      const Reorder = {
        attach(promptsContainer, prompts, onReorder) {
          abortReorderDrag?.();

          let isDragging = false;
          let dragSrcEl = null;
          let ghost = null;
          let autoScrollTimer = null;
          const SCROLL_ZONE_PX = 40;
          const SCROLL_SPEED_PX = 8;

          const getListItems = () => Array.from(promptsContainer.children).filter(c => c.classList.contains('opm-prompt-list-item'));

          const cleanup = () => {
            isDragging = false;
            if (ghost) { ghost.remove(); ghost = null; }
            if (dragSrcEl) { 
              dragSrcEl.style.opacity = ''; 
              dragSrcEl = null; 
            }
            if (autoScrollTimer) { clearInterval(autoScrollTimer); autoScrollTimer = null; }
            document.body.style.cursor = '';
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            if (abortReorderDrag === cleanup) abortReorderDrag = null;
          };

          const handleMouseMove = (e) => {
            if (!isDragging || !ghost) return;
            e.preventDefault();

            // Move ghost
            const ghostHeight = ghost.offsetHeight;
            ghost.style.top = `${e.clientY - (ghostHeight / 2)}px`;
            ghost.style.left = `${e.clientX + 10}px`;

            // Auto scroll
            const rect = promptsContainer.getBoundingClientRect();
            if (autoScrollTimer) clearInterval(autoScrollTimer);
            autoScrollTimer = null;

            if (e.clientY < rect.top + SCROLL_ZONE_PX) {
              autoScrollTimer = setInterval(() => { promptsContainer.scrollTop -= SCROLL_SPEED_PX; }, 16);
            } else if (e.clientY > rect.bottom - SCROLL_ZONE_PX) {
              autoScrollTimer = setInterval(() => { promptsContainer.scrollTop += SCROLL_SPEED_PX; }, 16);
            }

            // Swap logic
            const mouseY = e.clientY;
            const items = getListItems();
            let target = null;
          
            for (const item of items) {
              if (item === dragSrcEl) continue;
              const r = item.getBoundingClientRect();
              const mid = r.top + (r.height / 2);
              if (mouseY < mid) {
                target = item;
                break;
              }
            }
          
            if (target) {
              if (dragSrcEl.nextElementSibling !== target) {
                promptsContainer.insertBefore(dragSrcEl, target);
              }
            } else {
              if (dragSrcEl.nextElementSibling) {
                promptsContainer.appendChild(dragSrcEl);
              }
            }
          };

          const handleMouseUp = (e) => {
            if (!isDragging) return;
           
            const items = getListItems();
            const newOrderIndices = items.map(item => parseInt(item.dataset.index, 10));
           
            cleanup();
           
            let changed = false;
            for (let i = 0; i < newOrderIndices.length; i++) {
              if (newOrderIndices[i] !== i) {
                changed = true;
                break;
              }
            }
           
            if (changed) {
              const newPrompts = newOrderIndices.map(originalIdx => prompts[originalIdx]);
              onReorder(newPrompts);
            }
          };

          const wireItem = (item, index, handle) => {
            handle.style.cursor = 'grab';
            handle.addEventListener('dragstart', (e) => e.preventDefault());
            handle.addEventListener('mousedown', (e) => {
              if (e.button !== 0) return;
              const mode = window.PromptUIManager?.state?.listMode;
              if (mode !== 'edit') return;
              e.preventDefault(); 
              e.stopPropagation();

              isDragging = true;
              dragSrcEl = item;
            
              const rect = item.getBoundingClientRect();
              ghost = item.cloneNode(true);
              Object.assign(ghost.style, {
                position: 'fixed',
                top: `${rect.top}px`,
                left: `${rect.left}px`,
                width: `${rect.width}px`,
                height: `${rect.height}px`,
                zIndex: '99999',
                pointerEvents: 'none',
                opacity: '0.95',
                boxShadow: '0 8px 20px rgba(0,0,0,0.2)',
                transform: 'scale(1.02)',
                margin: '0',
                transition: 'none',
                backgroundColor: getMode() === 'dark' ? 'var(--dark-bg)' : 'var(--light-bg)'
              });
            
              const root = document.getElementById(SELECTORS.ROOT);
              if (root) root.appendChild(ghost);
              else document.body.appendChild(ghost);

              item.style.opacity = '0.0'; 
              document.body.style.cursor = 'grabbing';
              handle.style.cursor = 'grabbing';

              document.addEventListener('mousemove', handleMouseMove);
              document.addEventListener('mouseup', handleMouseUp);
            });
          };

          abortReorderDrag = cleanup;
          return { wireItem };
        }
      };

      const Views = {
        createPromptForm({ initialTitle = '', initialContent = '', submitLabel = 'Save', onSubmit }) {
          const form = createEl('div', { className: `opm-form-container opm-create-form opm-${getMode()}`, styles: { padding: '0', display: 'flex', flexDirection: 'column', gap: '4px' } });
          const titleIn = createEl('input', { attributes: { placeholder: 'Prompt Title' }, className: `opm-input-field opm-${getMode()}`, styles: { borderRadius: '4px' } });
          const contentArea = createEl('textarea', {
            attributes: { placeholder: 'Write your prompt. Use hashtags for #variables#' },
            className: `opm-textarea-field opm-${getMode()}`,
            styles: { flex: '1 1 auto', minHeight: '0', height: 'auto' }
          });
          titleIn.value = initialTitle;
          contentArea.value = initialContent;
          const saveBtn = createEl('button', { innerHTML: submitLabel, className: `opm-button opm-${getMode()}` });
          saveBtn.addEventListener('click', async e => {
            e.stopPropagation();
            const t = titleIn.value.trim(), c = contentArea.value.trim();
            if (!t || !c) { alert('Please fill in both title and content.'); return; }
            if (typeof onSubmit === 'function') await onSubmit({ title: t, content: c });
          });
          form.append(titleIn, contentArea, saveBtn);
          form.addEventListener('click', e => e.stopPropagation());
          return form;
        },
        renderPromptList(prompts = [], { mode = 'list' } = {}) {
          const content = Elements.createPanelContent();
          const tagsHost = createEl('div', { className: `opm-tags-filter-host opm-${getMode()}`, styles: { display: 'none' } });
          content.appendChild(tagsHost);
          const itemsContainer = Elements.createItemsContainer({ mode });
          const reorder = Reorder.attach(
            itemsContainer,
            prompts,
            async (newPrompts) => {
              prompts.splice(0, prompts.length, ...newPrompts);
              Array.from(itemsContainer.children)
                .filter(node => node.classList?.contains('opm-prompt-list-item'))
                .forEach((node, idx) => { node.dataset.index = idx; });
              if (window.PromptUIManager?.state?.listMode === 'edit') {
                window.PromptUIManager.requestListRefreshSuppression?.();
              }
              await window.PromptStorageManager.setPrompts(newPrompts);
            }
          );

          prompts.forEach((p, idx) => {
            const item = Elements.createEditablePromptItem(p, idx, reorder);
            itemsContainer.appendChild(item);
          });
          content.appendChild(itemsContainer);
          content.appendChild(Elements.createBottomMenu());

          // COMMENT: List panel resize waits for this before measuring natural height.
          let resolveTagsLayout;
          const tagsLayoutReady = new Promise((resolve) => { resolveTagsLayout = resolve; });
          content.__opmLayoutReady = tagsLayoutReady;

          (async () => {
            try {
              const enableTags = await window.PromptStorageManager.getEnableTags();
              if (!enableTags) { tagsHost.style.display = 'none'; return; }
              const counts = await TagService.getCounts(prompts);
              if (counts.size === 0) { tagsHost.style.display = 'none'; return; }
              const ordered = await TagService.getOrderedTags(counts);

              let persisted = 'all';
              try { persisted = (await window.PromptStorageManager.getActiveTagFilter() || 'all'); } catch (_) { persisted = 'all'; }
              const prevLower = (window.PromptUIManager.activeTagFilter || persisted || 'all').toLowerCase();
              const selected = prevLower !== 'all'
                ? (ordered.find(t => String(t).toLowerCase() === prevLower) || 'all')
                : 'all';
              window.PromptUIManager.activeTagFilter = selected;

              const bar = Elements.createTagsBar({
                tags: ordered,
                counts,
                selectedTag: selected,
                onSelect: (tag) => { window.PromptUIManager.filterByTag(tag); }
              });
              tagsHost.replaceWith(bar);
              window.PromptUIManager.filterByTag(selected);
              window.ScrollVisibilityManager?.observe(bar);
            } catch (_) { tagsHost.style.display = 'none'; }
            finally { resolveTagsLayout(); }
          })();
          return content;
        },
        async createPromptCreationForm(prefill = '') {
          const search = document.getElementById(SELECTORS.PROMPT_SEARCH_INPUT);
          if (search) search.style.display = 'none';

          const enableTags = await window.PromptStorageManager.getEnableTags();

          const form = createEl('div', { className: `opm-form-container opm-create-form opm-${getMode()}`, styles: { padding: '0', display: 'flex', flexDirection: 'column', gap: '8px' } });
          const titleIn = createEl('input', { attributes: { placeholder: 'Prompt Title' }, className: `opm-input-field opm-${getMode()}`, styles: { borderRadius: '4px' } });
          const contentArea = createEl('textarea', {
            attributes: { placeholder: 'Enter prompt. # for #variables#' },
            className: `opm-textarea-field opm-create-textarea opm-${getMode()}`,
            styles: { flex: '1 1 auto', minHeight: '0', height: 'auto' }
          });
          titleIn.value = '';
          contentArea.value = prefill || '';

          let tagsBlock = null;
          let tagInput = null;
          if (enableTags) {
            tagInput = TagUI.createTagInput();
            tagsBlock = createEl('div');
            tagsBlock.append(tagInput.element);
          }

          const saveBtn = createEl('button', { innerHTML: 'Create Prompt', className: `opm-button opm-${getMode()}` });
          saveBtn.addEventListener('click', async e => {
            e.stopPropagation();
            const t = titleIn.value.trim(), c = contentArea.value.trim();
            if (!t || !c) { alert('Please fill in both title and content.'); return; }
            const tags = enableTags && tagInput ? tagInput.getTags() : [];
            const res = await window.PromptStorageManager.savePrompt({ title: t, content: c, tags });
            if (!res.success) { alert('Error saving prompt.'); return; }
            window.PanelRouter.mount(window.PanelView.LIST);
          });

          form.append(titleIn, contentArea);
          if (tagsBlock) form.append(tagsBlock);
          form.append(saveBtn, Elements.createOpdCatalogLink());
          form.addEventListener('click', e => e.stopPropagation());
          return form;
        },
        createSettingsForm() {
          const form = createEl('div', { className: `opm-form-container opm-${getMode()}`, styles: { padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' } });
          const title = createEl('div', { styles: { fontWeight: 'bold', fontSize: '16px', marginBottom: '10px' }, innerHTML: 'Settings' });
          const settings = createEl('div', { styles: { display: 'flex', flexDirection: 'column', gap: '12px' } });

          // COMMENT: Format stored shortcut for display in the in-page settings panel
          const formatKeyboardShortcut = (shortcut) => {
            const isMac = navigator.platform.toUpperCase().includes('MAC');
            const parts = [];
            if (shortcut.modifier === 'metaKey') parts.push(isMac ? '⌘' : 'Meta');
            else if (shortcut.modifier === 'ctrlKey') parts.push(isMac ? '⌃' : 'Ctrl');
            else if (shortcut.modifier === 'altKey') parts.push(isMac ? '⌥' : 'Alt');
            if (shortcut.requiresShift) parts.push(isMac ? '⇧' : 'Shift');
            parts.push(String(shortcut.key || '').toUpperCase());
            return parts.join(' + ');
          };

          const shortcutTitle = createEl('div', { styles: { fontWeight: 'bold', fontSize: '14px', marginTop: '2px' }, innerHTML: 'Open / close shortcut' });
          const shortcutRow = createEl('div', { styles: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' } });
          const shortcutDisplay = createEl('span', {
            className: `opm-${getMode()}`,
            styles: { fontSize: '13px', fontWeight: '600', opacity: '0.9' },
            innerHTML: '…'
          });
          const recordShortcutBtn = createEl('button', { innerHTML: 'Record', className: `opm-button opm-${getMode()}` });

          const refreshShortcutDisplay = async () => {
            const shortcut = await window.PromptStorageManager.getKeyboardShortcut();
            shortcutDisplay.innerHTML = formatKeyboardShortcut(shortcut);
          };

          recordShortcutBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (shortcutRecordingHandler) {
              stopShortcutRecording();
              recordShortcutBtn.innerHTML = 'Record';
              refreshShortcutDisplay().catch(() => {});
              return;
            }
            recordShortcutBtn.innerHTML = 'Press keys…';
            shortcutDisplay.innerHTML = 'Listening…';
            shortcutRecordingHandler = async (event) => {
              event.preventDefault();
              event.stopPropagation();
              if (event.key === 'Escape') {
                stopShortcutRecording();
                recordShortcutBtn.innerHTML = 'Record';
                refreshShortcutDisplay().catch(() => {});
                return;
              }
              if (['Control', 'Meta', 'Alt', 'Shift'].includes(event.key)) return;
              let modifier = 'ctrlKey';
              if (event.metaKey) modifier = 'metaKey';
              else if (event.altKey) modifier = 'altKey';
              await window.PromptStorageManager.saveKeyboardShortcut({
                modifier,
                requiresShift: event.shiftKey,
                key: event.key.length === 1 ? event.key.toLowerCase() : event.key.toLowerCase()
              });
              stopShortcutRecording();
              recordShortcutBtn.innerHTML = 'Record';
              refreshShortcutDisplay().catch(() => {});
            };
            document.addEventListener('keydown', shortcutRecordingHandler, true);
          });
          shortcutRow.append(recordShortcutBtn, shortcutDisplay);
          refreshShortcutDisplay().catch(() => {});

          settings.appendChild(Elements.createLauncherModePicker({
            getValue: async () => window.PromptStorageManager.getDisplayMode(),
            onChange: async (mode) => {
              // COMMENT: storage.onChanged triggers refreshDisplayMode — avoid duplicate refresh races
              await window.PromptStorageManager.saveDisplayMode(mode);
            },
          }));

          settings.appendChild(Elements.createToggleRow({
            labelText: 'Append prompts to text',
            getValue: async () => await window.PromptStorageManager.getDisableOverwrite(),
            onToggle: async (active) => { await window.PromptStorageManager.saveDisableOverwrite(active); }
          }));

          const tagMgmtTitle = createEl('div', { styles: { fontWeight: 'bold', fontSize: '14px', marginTop: '12px', display: 'none' }, innerHTML: 'Tag management' });
          const tagMgmtContainer = createEl('div', { styles: { display: 'none', flexDirection: 'column', gap: '6px' } });

          const syncTagManagementVisibility = async (enabled) => {
            tagMgmtTitle.style.display = enabled ? '' : 'none';
            tagMgmtContainer.style.display = enabled ? 'flex' : 'none';
          };

          settings.appendChild(Elements.createToggleRow({
            labelText: 'Enable tags',
            getValue: async () => await window.PromptStorageManager.getEnableTags(),
            onToggle: async (active) => {
              await window.PromptStorageManager.saveEnableTags(active);
              // COMMENT: Remount settings so tag management UI initializes when tags are turned on
              window.PanelRouter.mount(window.PanelView.SETTINGS);
            }
          }));

          settings.appendChild(Elements.createToggleRow({
            labelText: 'Force Dark Mode',
            getValue: async () => {
              const enabled = await window.PromptStorageManager.getForceDarkMode();
              window.isDarkModeForced = !!enabled;
              return enabled;
            },
            onToggle: async (active) => {
              window.isDarkModeForced = active;
              await window.PromptStorageManager.saveForceDarkMode(active);
              window.PromptUIManager.updateThemeForUI();
            }
          }));

          const dataSectionTitle = createEl('div', { styles: { fontWeight: 'bold', fontSize: '14px', marginTop: '6px' }, innerHTML: 'Prompt Management' });
          const dataActions = createEl('div', { styles: { display: 'flex', gap: '8px' } });
          const exportBtn = createEl('button', { innerHTML: 'Export', className: `opm-button opm-${getMode()}` });
          exportBtn.addEventListener('click', async e => {
            e.stopPropagation();
            try {
              await window.PromptStorageManager.exportPrompts();
            } catch (err) {
              alert('Export failed.');
            }
          });
          const importBtn = createEl('button', { innerHTML: 'Import', className: `opm-button opm-${getMode()}` });
          importBtn.addEventListener('click', async e => {
            e.stopPropagation();
            const fileInput = createEl('input', { attributes: { type: 'file', accept: '.json' } });
            fileInput.addEventListener('change', async event => {
              const file = event.target.files[0];
              if (file) {
                try {
                  const merged = await window.PromptStorageManager.mergeImportedPrompts(file);
                  window.PromptUIManager.refreshPromptList(merged);
                  importBtn.textContent = 'Import successful!';
                  setTimeout(() => importBtn.textContent = 'Import', window.IMPORT_SUCCESS_RESET_MS || 2000);
                } catch (err) {
                  alert('Invalid JSON file format.');
                }
              }
            });
            fileInput.click();
          });
          dataActions.append(exportBtn, importBtn);
          const deleteAllBtn = createEl('button', {
            innerHTML: 'Delete all prompts',
            className: `opm-button opm-${getMode()}`,
            styles: { backgroundColor: '#9CA3AF', marginTop: '4px' }
          });
          deleteAllBtn.addEventListener('click', async e => {
            e.stopPropagation();
            if (!confirm('Delete ALL prompts? This cannot be undone.')) return;
            try {
              await window.PromptStorageManager.setPrompts([]);
              window.PanelRouter.mount(window.PanelView.SETTINGS);
            } catch (_) {
              alert('Failed to delete prompts.');
            }
          });

          (async () => {
            try {
              const enableTags = await window.PromptStorageManager.getEnableTags();
              await syncTagManagementVisibility(enableTags);
              if (!enableTags) return;

              let counts = await TagService.getCounts();
              const row = createEl('div', { className: 'opm-tags-mgmt-container' });
              let finalOrder = await TagService.getOrderedTags(counts);
              const placeholder = createEl('span', { className: `opm-tag-pill opm-${getMode()} opm-drop-placeholder`, innerHTML: '&nbsp;' });
              let dragFromIndex = null;

              const pillsOnly = () => Array.from(row.children).filter(n => n.classList && n.classList.contains('opm-tag-pill') && n !== placeholder);

              const insertPlaceholderAt = (clientX, clientY) => {
                const pills = pillsOnly();
                if (pills.length === 0) { row.appendChild(placeholder); return; }
                let inserted = false;
                for (let i = 0; i < pills.length; i++) {
                  const rect = pills[i].getBoundingClientRect();
                  if (clientY >= rect.top && clientY <= rect.bottom) {
                    placeholder.style.width = `${rect.width}px`;
                    const before = clientX < rect.left + rect.width / 2;
                    if (before) {
                      if (pills[i].previousSibling !== placeholder) row.insertBefore(placeholder, pills[i]);
                    } else {
                      if (pills[i].nextSibling !== placeholder) row.insertBefore(placeholder, pills[i].nextSibling);
                    }
                    inserted = true;
                    break;
                  }
                }
                if (!inserted) {
                  const first = pills[0];
                  const last = pills[pills.length - 1];
                  const firstRect = first.getBoundingClientRect();
                  const lastRect = last.getBoundingClientRect();
                  placeholder.style.width = `${(firstRect || lastRect).width}px`;
                  if (clientY < firstRect.top) {
                    if (first.previousSibling !== placeholder) row.insertBefore(placeholder, first);
                  } else {
                    if (last.nextSibling !== placeholder) row.insertBefore(placeholder, last.nextSibling);
                  }
                }
              };

              row.addEventListener('dragover', e => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                insertPlaceholderAt(e.clientX, e.clientY);
              });
              row.addEventListener('drop', async e => {
                e.preventDefault();
                const nodes = Array.from(row.children);
                let to = 0;
                for (let i = 0; i < nodes.length; i++) {
                  const node = nodes[i];
                  if (node === placeholder) break;
                  if (node.classList && node.classList.contains('opm-tag-pill')) to++;
                }
                let from = dragFromIndex;
                if (from === null) {
                  const txt = e.dataTransfer.getData('text/plain');
                  const parsed = parseInt(txt, 10);
                  from = Number.isNaN(parsed) ? null : parsed;
                }
                if (from === null || from === to) {
                  if (placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
                  dragFromIndex = null;
                  return;
                }
                if (from < to) to = to - 1;
                const moved = finalOrder.splice(from, 1)[0];
                finalOrder.splice(Math.max(0, Math.min(finalOrder.length, to)), 0, moved);
                await window.PromptStorageManager.saveTagsOrder(finalOrder);
                if (placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
                dragFromIndex = null;
                render();
              });

              const render = () => {
                row.innerHTML = '';
                finalOrder.forEach((tag, idx) => {
                  const n = counts.get(tag) || 0;
                  const pill = createEl('span', { className: `opm-tag-pill opm-${getMode()}` });
                  const handle = createEl('span', {
                    styles: { display: 'inline-flex', alignItems: 'center', marginRight: '6px', cursor: 'grab' },
                    innerHTML: `
                    <img 
                      src="${chrome.runtime.getURL('icons/drag_indicator.svg')}" 
                      width="14"
                      height="14"
                      alt="Drag"
                      title="Drag to reorder"
                      style="opacity: 0.9; filter: ${iconFilter()}"
                    >
                  `
                  });
                  handle.setAttribute('draggable', 'true');
                  handle.addEventListener('dragstart', e => {
                    e.stopPropagation();
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', String(idx));
                    dragFromIndex = idx;
                    try {
                      const rect = pill.getBoundingClientRect();
                      const offsetX = Math.min(8, rect.width / 2);
                      const offsetY = Math.min(8, rect.height / 2);
                      e.dataTransfer.setDragImage(pill, offsetX, offsetY);
                    } catch (_) {}
                  });
                  handle.addEventListener('dragend', () => {
                    if (placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
                    dragFromIndex = null;
                  });

                  const label = createEl('span', { innerHTML: `${tag} (${n})` });
                  const removeBtn = createEl('button', { innerHTML: '×', styles: { marginLeft: '6px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '14px', lineHeight: '1' } });
                  removeBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (!confirm(`Remove tag "${tag}" from all prompts?`)) return;
                    try {
                      const prompts = await window.PromptStorageManager.getPrompts();
                      const updated = prompts.map(p => {
                        const nextTags = Array.isArray(p.tags) ? p.tags.filter(t => t !== tag) : [];
                        return { ...p, tags: nextTags };
                      });
                      await window.PromptStorageManager.setPrompts(updated);
                      counts = await TagService.getCounts(updated);
                      finalOrder = finalOrder.filter(t => t !== tag);
                      await window.PromptStorageManager.saveTagsOrder(finalOrder);
                      render();
                    } catch (_) { /* ignore */ }
                  });

                  pill.append(handle, label, removeBtn);
                  row.appendChild(pill);
                });
              };
              render();
              tagMgmtContainer.appendChild(row);
            } catch (_) { /* ignore */ }
          })();

          // COMMENT: Community links — same SVG icon style as the side panel footer
          const isDarkTheme = getMode() === 'dark';
          const linkTileStyles = {
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            textDecoration: 'none',
            borderRadius: '6px',
            padding: '6px 10px',
            fontSize: '13px',
            fontWeight: '500',
            border: isDarkTheme ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.05)',
            backgroundColor: isDarkTheme ? 'rgba(255,255,255,0.03)' : 'rgba(15, 23, 42, 0.03)',
            color: isDarkTheme ? THEME_COLORS.inputDarkText : THEME_COLORS.inputLightText,
            transition: 'background-color 0.2s ease, border-color 0.2s ease'
          };
          const iconWrapStyles = {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            borderRadius: '999px',
            color: '#3674B5',
            flexShrink: '0'
          };
          const createCommunityLink = ({ label, href, svgPath }) => {
            const link = createEl('a', {
              attributes: { href, target: '_blank', rel: 'noopener noreferrer' },
              styles: { ...linkTileStyles }
            });
            const iconWrap = createEl('span', {
              styles: { ...iconWrapStyles },
              innerHTML: `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="${svgPath}"/></svg>`
            });
            const text = createEl('span', { innerHTML: label });
            link.append(iconWrap, text);
            return link;
          };
          const communityTitle = createEl('div', { styles: { fontWeight: 'bold', fontSize: '13px', marginTop: '10px', opacity: 0.85 }, innerHTML: 'Support & Links' });
          const communityLinks = createEl('div', { styles: { display: 'flex', flexDirection: 'column', gap: '6px' } });
          communityLinks.append(
            createCommunityLink({
              label: 'Visit the GitHub Repository',
              href: 'https://github.com/jonathanbertholet/promptmanager',
              svgPath: 'M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.49.5.09.68-.22.68-.48 0-.24-.01-.87-.01-1.7-2.78.62-3.37-1.37-3.37-1.37-.45-1.16-1.11-1.47-1.11-1.47-.91-.64.07-.63.07-.63 1 .07 1.53 1.05 1.53 1.05.89 1.52 2.34 1.08 2.91.83.09-.64.35-1.08.63-1.33-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.27 2.75 1.05A9.2 9.2 0 0 1 12 6.84c.85.004 1.71.12 2.51.34 1.91-1.32 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.81-4.57 5.07.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.8 0 .27.18.58.69.48A10.01 10.01 0 0 0 22 12c0-5.52-4.48-10-10-10z'
            }),
            createCommunityLink({
              label: 'Leave a Review',
              href: 'https://chromewebstore.google.com/detail/open-prompt-manager/gmhaghdbihgenofhnmdbglbkbplolain',
              svgPath: 'M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.62L12 2 9.19 8.62 2 9.24l5.46 4.73L5.82 21 12 17.27z'
            }),
            createCommunityLink({
              label: 'Buy me a Coffee',
              href: 'https://buymeacoffee.com/jonathanbertholet',
              svgPath: 'M20 3H4v10c0 2.21 1.79 4 4 4h6c2.21 0 4-1.79 4-4v-3h2c1.11 0 2-.9 2-2V5c0-1.11-.9-2-2-2zm0 5h-2V5h2v3zM4 19h16v2H4v-2z'
            })
          );

          form.append(title, shortcutTitle, shortcutRow, settings, dataSectionTitle, dataActions, deleteAllBtn, tagMgmtTitle, tagMgmtContainer, communityTitle, communityLinks);
          form.addEventListener('click', e => e.stopPropagation());
          return form;
        },
        async createEditView() {
          const prompts = await window.PromptStorageManager.getPrompts();
          // COMMENT: Treat edit view as a list variant so global search UI stays visible.
          const container = createEl('div', { className: `opm-form-container opm-view-list opm-${getMode()}`, styles: { padding: '0', display: 'flex', flexDirection: 'column', gap: '4px', minHeight: '0' } });
          const promptsContainer = createEl('div', { className: `${SELECTORS.PROMPT_ITEMS_CONTAINER} opm-prompt-list-items opm-${getMode()}`, styles: { maxHeight: '350px', overflowY: 'auto', marginBottom: '4px' } });
          const reorder = Reorder.attach(
            promptsContainer,
            prompts,
            async (newPrompts) => {
            // COMMENT: Persist the reordered list without remounting so scroll position stays stable.
              prompts.splice(0, prompts.length, ...newPrompts);
              Array.from(promptsContainer.children)
                .filter(node => node.classList?.contains('opm-prompt-list-item'))
                .forEach((node, idx) => { node.dataset.index = idx; });
              await window.PromptStorageManager.setPrompts(newPrompts);
            }
          );
          prompts.forEach((p, idx) => {
            const item = createEl('div', { className: `opm-prompt-list-item opm-${getMode()}`, styles: { justifyContent: 'space-between', padding: '4px 4px', margin: '6px 0' } });
            item.dataset.index = idx;
            const dragHandle = createEl('div', {
              className: 'opm-drag-handle',
              innerHTML: `
              <img 
                src="${chrome.runtime.getURL('icons/drag_indicator.svg')}" 
                width="16" 
                height="16" 
                alt="Drag handle" 
                title="Drag to reorder"
                style="display: block; opacity: 0.9; filter: ${iconFilter()}"
              >
            `,
              styles: {
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '16px', height: '16px', marginRight: '4px', marginLeft: '0px', flex: '0 0 auto',
                cursor: 'grab', userSelect: 'none', opacity: '0.9'
              }
            });
            reorder.wireItem(item, idx, dragHandle);
            const info = createEl('div', { styles: { display: 'flex', flexDirection: 'column', flex: '1', gap: '2px' } });
            const text = createEl('div', { styles: { flex: '0 0 auto' } });
            text.textContent = p.title;
            info.appendChild(text);
            const lowerTags = Array.isArray(p.tags) ? p.tags.map(t => String(t).toLowerCase()).join(' ') : '';
            item.dataset.title = p.title.toLowerCase();
            item.dataset.content = p.content.toLowerCase();
            item.dataset.tags = lowerTags;
            item.dataset.tagsList = JSON.stringify(Array.isArray(p.tags) ? p.tags.map(t => String(t).toLowerCase()) : []);
            const actions = createEl('div', { styles: { display: 'flex', gap: '4px' } });
            const editIcon = Elements.createIconButton('edit', () => { window.PromptUIManager.showEditForm(p); });
            const deleteIcon = Elements.createIconButton('delete', () => { if (confirm(`Delete "${p.title}"?`)) window.PromptUIManager.deletePrompt(p.uuid); });
            actions.append(editIcon, deleteIcon);
            item.append(dragHandle, info, actions);
            promptsContainer.appendChild(item);
          });
          container.appendChild(promptsContainer);

          (async () => {
          // COMMENT: Mirror the LIST view tag filter so edit mode can reuse combined tag+search filtering.
            const tagsHost = document.querySelector(`#${SELECTORS.PANEL_CONTENT} .opm-tags-filter-host`);
            if (!tagsHost) return;
            try {
              const enableTags = await window.PromptStorageManager.getEnableTags();
              if (!enableTags) {
                tagsHost.style.display = 'none';
                return;
              }
              const counts = await TagService.getCounts(prompts);
              if (counts.size === 0) {
                tagsHost.style.display = 'none';
                return;
              }
              const ordered = await TagService.getOrderedTags(counts);
              let persisted = 'all';
              try { persisted = (await window.PromptStorageManager.getActiveTagFilter() || 'all'); } catch (_) { persisted = 'all'; }
              const prevLower = (window.PromptUIManager.activeTagFilter || persisted || 'all').toLowerCase();
              const selected = prevLower !== 'all'
                ? (ordered.find(t => String(t).toLowerCase() === prevLower) || 'all')
                : 'all';
              window.PromptUIManager.activeTagFilter = selected;
              const bar = Elements.createTagsBar({
                tags: ordered,
                counts,
                selectedTag: selected,
                onSelect: (tag) => { window.PromptUIManager.filterByTag(tag); }
              });
              tagsHost.replaceWith(bar);
              window.ScrollVisibilityManager?.observe(bar);
              window.PromptUIManager.filterByTag(selected);
            } catch (_) {
              tagsHost.style.display = 'none';
            }
          })();

          return container;
        }
      };

      const Behaviors = {
        showList(listEl) {
          showEl(listEl);
        },
        hideList(listEl) {
          hideEl(listEl);
        },
        startCloseTimer(listEl, onClose) {
          if (State.closeTimer) clearTimeout(State.closeTimer);
          State.closeTimer = setTimeout(() => {
            try { if (typeof onClose === 'function') onClose(); } finally {
              Behaviors.hideList(listEl);
              State.closeTimer = null;
            }
          }, window.PROMPT_CLOSE_DELAY || 10000);
        },
        cancelCloseTimer() {
          if (State.closeTimer) clearTimeout(State.closeTimer);
          State.closeTimer = null;
        }
      };

      const Events = {
        attachButtonEvents(button, listEl, container) {
          const isListVisible = () => listEl.classList.contains('opm-visible');

          const startClose = (e) => {
            if (e) e.stopPropagation();
            Behaviors.startCloseTimer(listEl);
          };

          // COMMENT: Reopen hidden panel on hover — preserve in-progress forms instead of remounting.
          const reopenPanel = async (e) => {
            if (e) e.stopPropagation();
            Behaviors.cancelCloseTimer();
            if (isListVisible()) return;

            const hasVariableForm = !!listEl.querySelector('.opm-variable-input-form');
            const hasEditForm = !!listEl.querySelector('.opm-edit-prompt-form');
            if (hasVariableForm) {
              window.PromptUIManager.inVariableInputMode = true;
              Behaviors.showList(listEl);
              return;
            }
            if (hasEditForm) {
              Behaviors.showList(listEl);
              return;
            }

            await window.PromptUIManager.mountListOrCreateBasedOnPrompts();
            Behaviors.showList(listEl);
          };

          button.addEventListener('click', async e => {
            e.stopPropagation();
            State.manuallyOpened = true;
            if (isListVisible()) {
              Behaviors.hideList(listEl);
              return;
            }
            await reopenPanel();
          });

          button.addEventListener('mouseenter', reopenPanel);
          if (container) container.addEventListener('mouseenter', reopenPanel);

          button.addEventListener('mouseleave', startClose);
          if (container) container.addEventListener('mouseleave', startClose);
          listEl.addEventListener('mouseenter', Behaviors.cancelCloseTimer);
          listEl.addEventListener('mouseleave', startClose);
        }
      };

      return Object.freeze({ State, Elements, Views, Behaviors, Events, abortTransientListeners });
    })();
    window.PromptUI = PromptUI;
  }

  window.__initPromptShared = initPromptManagerShared;
})();

