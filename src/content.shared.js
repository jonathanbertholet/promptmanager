/* ============================================================================
   Prompt Manager Shared UI Helpers (content.shared.js)
   COMMENT: Houses TagService, TagUI, and PromptUI so content.js stays lean.
   ============================================================================ */
(function registerPromptManagerShared() {
  function initPromptManagerShared() {
    if (window.__OPM_PROMPT_SHARED__) return;
    window.__OPM_PROMPT_SHARED__ = true;

    const createEl = window.createEl;
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
    help: `<img src="${chrome.runtime.getURL('icons/help.svg')}" width="16" height="16" alt="Help" title="Help" style="filter: ${iconFilter()}">`,
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
    const createTagInput = ({ initialTags = [] } = {}) => {
      const tagsSet = new Set(Array.isArray(initialTags) ? initialTags : []);
      const row = createEl('div', { className: `opm-tag-row opm-${getMode()}` });
      const pills = createEl('div', { className: 'opm-tags-container' });
      const input = createEl('input', { attributes: { type: 'text', placeholder: 'Tags' }, className: `opm-tag-input opm-${getMode()}` });
      const suggestions = createEl('div', { className: `opm-tag-suggestions opm-${getMode()}`, styles: { display: 'none' } });
      let activeIndex = -1; let options = [];

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
          item.addEventListener('mousedown', e => { e.preventDefault(); addTag(t); input.value = ''; suggestions.style.display = 'none'; });
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
        if (e.key === 'Enter') { e.preventDefault(); if (activeIndex >= 0 && activeIndex < options.length) { addTag(options[activeIndex]); input.value = ''; } else { addTag(input.value); input.value = ''; } suggestions.style.display = 'none'; }
        if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex = Math.min(activeIndex + 1, options.length - 1); refreshSuggestions(); }
        if (e.key === 'ArrowUp') { e.preventDefault(); activeIndex = Math.max(activeIndex - 1, -1); refreshSuggestions(); }
        if (e.key === 'Escape') { suggestions.style.display = 'none'; }
      });
      input.addEventListener('focus', () => { suggestions.style.display = 'none'; });
      input.addEventListener('blur', () => { suggestions.style.display = 'none'; });
      document.addEventListener('click', (evt) => { if (!suggestions.contains(evt.target)) suggestions.style.display = 'none'; });
      window.addEventListener('resize', positionSuggestions);
      window.addEventListener('scroll', positionSuggestions, true);

      renderPills();
      row.append(pills, input);
      return { element: row, getTags: () => Array.from(tagsSet) };
    };

    return { createTagInput };
  })();
  window.TagUI = TagUI;

  const PromptUI = (() => {
    const State = {
      manuallyOpened: false,
      inVariableInputMode: false,
      closeTimer: null
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
          if (confirm(`Delete \"${prompt.title}\"?`)) window.PromptUIManager.deletePrompt(prompt.uuid);
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
        const btns = ['list', 'add', 'edit', 'help', 'changelog', 'settings'];
        const actions = {
          list: e => { e.stopPropagation(); PromptUIManager.manuallyOpened = true; PanelRouter.mount(PanelView.LIST); },
          add: e => { e.stopPropagation(); PromptUIManager.manuallyOpened = true; PanelRouter.mount(PanelView.CREATE); },
          edit: e => { e.stopPropagation(); PromptUIManager.manuallyOpened = true; PanelRouter.mount(PanelView.EDIT); },
          settings: e => { e.stopPropagation(); PromptUIManager.manuallyOpened = true; PanelRouter.mount(PanelView.SETTINGS); },
          help: e => { e.stopPropagation(); PromptUIManager.manuallyOpened = true; PanelRouter.mount(PanelView.HELP); },
          changelog: e => { e.stopPropagation(); PromptUIManager.manuallyOpened = true; PanelRouter.mount(PanelView.CHANGELOG); },
        };
        btns.forEach(type => bar.appendChild(Elements.createIconButton(type, actions[type])));
        return bar;
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
        search.addEventListener('input', e => { PromptUIManager.filterPromptItems(e.target.value); });
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
      }
    };

    const Reorder = {
      attach(promptsContainer, prompts, onReorder) {
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

        (async () => {
          try {
            const enableTags = await window.PromptStorageManager.getEnableTags();
            if (!enableTags) { tagsHost.style.display = 'none'; return; }
            const counts = await TagService.getCounts(prompts);
            if (counts.size === 0) { tagsHost.style.display = 'none'; return; }
            const ordered = await TagService.getOrderedTags(counts);

            let persisted = 'all';
            try { persisted = (await window.PromptStorageManager.getActiveTagFilter() || 'all').toLowerCase(); } catch (_) { persisted = 'all'; }
            const prev = (window.PromptUIManager.activeTagFilter || persisted || 'all').toLowerCase();
            const selected = prev !== 'all' && counts.has(prev) ? prev : 'all';
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
        })();
        return content;
      },
      async createPromptCreationForm(prefill = '') {
        const search = document.getElementById(SELECTORS.PROMPT_SEARCH_INPUT);
        if (search) search.style.display = 'none';

        const enableTags = await window.PromptStorageManager.getEnableTags();

        const form = createEl('div', { className: `opm-form-container opm-${getMode()}`, styles: { padding: '0', display: 'flex', flexDirection: 'column', gap: '8px' } });
        const titleIn = createEl('input', { attributes: { placeholder: 'Prompt Title' }, className: `opm-input-field opm-${getMode()}`, styles: { borderRadius: '4px' } });
        const contentArea = createEl('textarea', {
          attributes: { placeholder: 'Enter your prompt here. Add variables with #examplevariable#' },
          className: `opm-textarea-field opm-${getMode()}`,
          styles: { flex: '1 1 auto', minHeight: '0', height: 'auto' }
        });
        titleIn.value = '';
        contentArea.value = prefill || '';

        let tagsBlock = null;
        let tagInput = null;
        if (enableTags) {
          const label = createEl('label', { styles: { fontSize: '12px', fontWeight: 'bold' } });
          tagInput = TagUI.createTagInput();
          tagsBlock = createEl('div');
          tagsBlock.append(label, tagInput.element);
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
        form.append(saveBtn);
        form.addEventListener('click', e => e.stopPropagation());
        return form;
      },
      createSettingsForm() {
        const form = createEl('div', { className: `opm-form-container opm-${getMode()}`, styles: { padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' } });
        const title = createEl('div', { styles: { fontWeight: 'bold', fontSize: '16px', marginBottom: '10px' }, innerHTML: 'Settings' });
        const settings = createEl('div', { styles: { display: 'flex', flexDirection: 'column', gap: '12px' } });

        settings.appendChild(Elements.createToggleRow({
          labelText: 'Hot Corner Mode',
          getValue: async () => (await window.PromptStorageManager.getDisplayMode()) === 'hotCorner',
          onToggle: async (active) => {
            const newMode = active ? 'hotCorner' : 'standard';
            await window.PromptStorageManager.saveDisplayMode(newMode);
            await window.PromptUIManager.refreshDisplayMode();
          }
        }));

        settings.appendChild(Elements.createToggleRow({
          labelText: 'Append prompts to text',
          getValue: async () => await window.PromptStorageManager.getDisableOverwrite(),
          onToggle: async (active) => { await window.PromptStorageManager.saveDisableOverwrite(active); }
        }));

        settings.appendChild(Elements.createToggleRow({
          labelText: 'Enable tags',
          getValue: async () => await window.PromptStorageManager.getEnableTags(),
          onToggle: async (active) => { await window.PromptStorageManager.saveEnableTags(active); }
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
            const prompts = await window.PromptStorageManager.getPrompts();
            const json = JSON.stringify(prompts, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = createEl('a', { attributes: { href: url, download: `prompts-${new Date().toISOString().split('T')[0]}.json` } });
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
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
                const text = await file.text();
                const imported = JSON.parse(text);
                if (!Array.isArray(imported)) throw new Error('Invalid format');
                const merged = await window.PromptStorageManager.mergeImportedPrompts(imported);
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
        const tagMgmtTitle = createEl('div', { styles: { fontWeight: 'bold', fontSize: '14px', marginTop: '12px', display: 'none' }, innerHTML: 'Tag management' });
        const tagMgmtContainer = createEl('div', { styles: { display: 'none', flexDirection: 'column', gap: '6px' } });
        (async () => {
          try {
            const enableTags = await window.PromptStorageManager.getEnableTags();
            if (!enableTags) { tagMgmtTitle.style.display = 'none'; tagMgmtContainer.style.display = 'none'; return; }
            tagMgmtTitle.style.display = '';
            tagMgmtContainer.style.display = '';

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

        // COMMENT: Prepare shared styles so the external link tiles match the active theme.
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

        // COMMENT: Builder keeps GitHub + review links consistent (icon + label + spacing).
        const createCommunityLink = ({ label, href, icon, alt }) => {
          const link = createEl('a', {
            attributes: { href, target: '_blank', rel: 'noopener noreferrer' },
            styles: { ...linkTileStyles }
          });
          const iconImg = createEl('img', {
            attributes: { src: chrome.runtime.getURL(icon), alt, width: '20', height: '20' },
            styles: { filter: iconFilter() }
          });
          const text = createEl('span', { innerHTML: label });
          link.append(iconImg, text);
          return link;
        };

        // COMMENT: Highlight community call-to-actions so users can find GitHub + reviews fast.
        const communityTitle = createEl('div', { styles: { fontWeight: 'bold', fontSize: '13px', marginTop: '10px', opacity: 0.85 }, innerHTML: 'Support & Links' });
        const communityLinks = createEl('div', { styles: { display: 'flex', flexDirection: 'column', gap: '6px' } });
        communityLinks.append(
          createCommunityLink({
            label: 'Visit the GitHub Repository',
            href: 'https://github.com/jonathanbertholet/promptmanager',
            icon: 'icons/github-icon.png',
            alt: 'GitHub icon'
          }),
          createCommunityLink({
            label: 'Leave a Review',
            href: 'https://chromewebstore.google.com/detail/open-prompt-manager/gmhaghdbihgenofhnmdbglbkbplolain',
            icon: 'icons/review-icon.png',
            alt: 'Review icon'
          }),
          createCommunityLink({
            label: 'Buy me a Coffee',
            href: 'https://buymeacoffee.com/jonathanbertholet',
            icon: 'icons/coffee.svg',
            alt: 'Coffee icon'
          })
        );

        form.append(title, settings, dataSectionTitle, dataActions, deleteAllBtn, tagMgmtTitle, tagMgmtContainer, communityTitle, communityLinks);
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
            try { persisted = (await window.PromptStorageManager.getActiveTagFilter() || 'all').toLowerCase(); } catch (_) { persisted = 'all'; }
            const prev = (window.PromptUIManager.activeTagFilter || persisted || 'all').toLowerCase();
            const selected = prev !== 'all' && counts.has(prev) ? prev : 'all';
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
      attachButtonEvents(button, listEl) {
        let isOpen = false;
        const startClose = (e) => {
          if (e) e.stopPropagation();
          Behaviors.startCloseTimer(listEl, () => { isOpen = false; });
        };

        button.addEventListener('click', e => {
          e.stopPropagation();
          State.manuallyOpened = true;
          isOpen ? Behaviors.hideList(listEl) : Behaviors.showList(listEl);
          isOpen = !isOpen;
        });

        button.addEventListener('mouseenter', async e => {
          e.stopPropagation();
          Behaviors.cancelCloseTimer();
          const listIsVisible = listEl.classList.contains('opm-visible');
          if (!listIsVisible && !window.PromptUIManager.inVariableInputMode) {
            window.PromptUIManager.manuallyOpened = false;
            await window.PromptUIManager.mountListOrCreateBasedOnPrompts();
            isOpen = true;
          } else {
            isOpen = true;
          }
        });

        button.addEventListener('mouseleave', startClose);
        listEl.addEventListener('mouseenter', Behaviors.cancelCloseTimer);
        listEl.addEventListener('mouseleave', startClose);
      }
    };

    return Object.freeze({ State, Elements, Views, Behaviors, Events });
  })();
  window.PromptUI = PromptUI;
  }

  window.__initPromptShared = initPromptManagerShared;
})();

