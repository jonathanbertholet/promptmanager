// Executed in a browser with real page modules and a deterministic Chrome API fixture.
(() => {
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const value = (selector, attribute = 'textContent') => document.querySelector(selector)?.[attribute];
  const click = selector => { const el = document.querySelector(selector); assert(el, `Missing ${selector}`); el.click(); };
  const params = element => Object.fromEntries([...element.attributes].filter(a => a.name.startsWith('data-i18n-param-')).map(a => [a.name.slice(16), a.value]));

  function checkBindings() {
    for (const element of document.querySelectorAll('[data-i18n],[data-i18n-placeholder],[data-i18n-title],[data-i18n-aria-label],[data-i18n-alt]')) {
      for (const [attr, name] of [['textContent', 'i18n'], ['placeholder', 'i18nPlaceholder'], ['title', 'i18nTitle'], ['aria-label', 'i18nAriaLabel'], ['alt', 'i18nAlt']]) {
        const key = element.dataset[name]; if (!key) continue;
        const expected = OPMI18n.t(key, params(element));
        assert(expected !== key, `Missing key ${key}`);
        const actual = attr === 'textContent' ? element.textContent : element.getAttribute(attr);
        assert(actual === expected, `${element.id || element.tagName} ${key}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
      }
    }
  }

  globalThis.runPageChecks = async pageName => {
    const passed = [];
    await OPMI18n.ready; await wait(250);
    checkBindings();
    assert(!document.documentElement.hasAttribute('data-i18n-pending'), 'Startup remains hidden');
    passed.push(`${pageName}: all declared bindings translate before showing the page`);
    const firstVisible = __firstPaints.find(p => p.visible);
    assert(firstVisible?.bindings.length, `No visible UI frame recorded: ${pageName}`);
    for (const binding of firstVisible.bindings) {
      assert(binding.text === OPMI18n.t(binding.key, binding.params), `Untranslated first visible binding: ${binding.key}`);
    }
    passed.push(`${pageName}: delayed-locale first-paint check`);

    if (pageName.startsWith('sidepanel')) {
      const row = document.querySelector('#prompt-list li');
      assert(row, 'Seed prompt missing');
      assert(row.querySelector('span').textContent === 'Settings', 'User title translated');
      row.querySelector('[data-opm-action="copy"]').click(); await wait(25);
      assert(__copiedText === 'Copy\n#name#', 'Copy content changed');
      row.querySelector('.spm-prompt-action-more').click();
      await OPMI18n.setLanguage('en');
      assert(row === document.querySelector('#prompt-list li'), 'Language switch rebuilt the prompt row');
      assert(row.classList.contains('spm-actions-menu-open'), 'Language switch closed the action menu');
      row.querySelector('[data-i18n-title="common.edit"]').click();
      const field = document.querySelector('#prompt-content');
      field.value = '  Settings\n#name#\n中文草稿  '; field.focus(); field.setSelectionRange(3, 9);
      const tag = document.querySelector('.spm-tag-pill');
      await OPMI18n.setLanguage('zh-CN');
      assert(field === document.activeElement && field.selectionStart === 3 && field.selectionEnd === 9, 'Draft caret lost');
      assert(field.value === '  Settings\n#name#\n中文草稿  ', 'Draft modified');
      assert(tag === document.querySelector('.spm-tag-pill'), 'Tag editor rebuilt');
      assert(!document.querySelector('.spm-tag-pill b'), 'User tag parsed as HTML');
      assert(value('#submit-button').trim() === '保存更改', 'Edit button lost its state');
      passed.push('sidepanel: copy, stable action menus, literal user tags and preserved edit draft/caret');
      click('#cancel-edit-button');
      row.click();
      const variable = document.querySelector('#spm-variable-fields textarea');
      assert(variable, 'Variable form missing');
      variable.value = 'Copy <b>中文</b>'; variable.focus(); variable.setSelectionRange(1, 4);
      await OPMI18n.setLanguage('en');
      assert(variable.placeholder === 'Name value', 'Variable placeholder did not change');
      assert(variable.value === 'Copy <b>中文</b>' && variable.selectionStart === 1, 'Variable content/caret changed');
      await OPMI18n.setLanguage('zh-CN');
      assert(variable.placeholder === 'Name 的值', 'Chinese variable placeholder missing');
      passed.push('sidepanel: open variable form changes language without changing input');
    } else if (pageName === 'settings.html') {
      click('#open-shortcut-record');
      await OPMI18n.setLanguage('en');
      assert(value('#open-shortcut-record') === 'Press keys… (Esc to cancel)', 'Recording state lost');
      assert(value('#open-shortcut-display') === 'Listening…', 'Recording hint stale');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(20);
      await OPMI18n.setLanguage('zh-CN');
      assert(value('#open-shortcut-record') === '录制快捷键', 'Record reset failed');
      assert(!value('#open-shortcut-display').includes('等待'), 'Shortcut not restored');
      const file = new File(['{invalid'], 'broken.json', { type: 'application/json' });
      const transfer = new DataTransfer(); transfer.items.add(file);
      const input = document.querySelector('#import-file'); input.files = transfer.files; input.dispatchEvent(new Event('change')); await wait(50);
      assert(value('#import-export-status').includes('导入失败'), 'Import error untranslated');
      await OPMI18n.setLanguage('en');
      assert(value('#import-export-status').includes('Import failed'), 'Existing status did not follow locale');
      passed.push('settings: recording and import-error states follow the selected language');
    } else if (pageName === 'opd-settings.html') {
      const handle = document.querySelector('#opd-handle-input'); handle.value = 'x';
      click('#opd-handle-confirm'); await wait(20);
      assert(value('#opd-handle-status').includes('3'), 'Validation missing');
      await OPMI18n.setLanguage('en');
      assert(value('#opd-handle-status') === 'Min. 3 characters.', 'Existing validation did not change language');
      assert(handle.value === 'x', 'Handle draft changed');
      handle.value = 'settings'; click('#opd-handle-confirm'); await wait(50);
      assert(value('#opd-handle-status').includes('Catalog access'), 'Permission failure missing');
      await OPMI18n.setLanguage('zh-CN');
      assert(value('#opd-handle-status').includes('用户名'), 'Permission failure did not change language');
      passed.push('community settings: validation, permission failures and handle draft preserved');
    }

    const rich = [...document.querySelectorAll('[data-i18n-rich]')];
    const slots = rich.flatMap(el => [...el.querySelectorAll('[data-i18n-slot]')]);
    const hrefs = slots.map(el => el.getAttribute('href'));
    for (const lang of ['en', 'zh-CN', 'en', 'zh-CN']) { await OPMI18n.setLanguage(lang); checkBindings(); }
    slots.forEach((el, i) => {
      assert(el.isConnected, 'A rich-text slot was destroyed');
      assert(el.getAttribute('href') === hrefs[i], 'A translated link destination changed');
    });
    if (pageName.startsWith('permissions')) assert(document.querySelector('[data-i18n-rich="onboarding.openSourceRich"] a[href$="PRIVACY.md"]'), 'Privacy link lost');
    assert(fetch === __nativeFunctions.fetch && alert === __nativeFunctions.alert && confirm === __nativeFunctions.confirm, 'Native browser API was patched');
    passed.push(`${pageName}: repeated EN/ZH round trips preserve slots, links and native APIs`);
    return passed;
  };

  globalThis.runHostChecks = async () => {
    const passed = [];
    await OPMI18n.ready; await wait(200);
    const root = document.querySelector('#opm-root'); assert(root, 'In-page UI not mounted');
    const hostText = value('#host-text'); const hostLang = document.documentElement.lang;
    const hostHint = value('#host-key');
    await PanelRouter.mount(PanelView.CREATE);
    let draft = root.querySelector('.opm-create-form textarea'); assert(draft, 'Create form not mounted');
    draft.value = '  Copy\n中文 #name# '; draft.focus(); draft.setSelectionRange(1, 6);
    await OPMI18n.setLanguage('en');
    assert(draft.isConnected && draft.value === '  Copy\n中文 #name# ' && draft.selectionStart === 1, 'In-page draft/caret changed');
    await OPMI18n.setLanguage('zh-CN');
    assert(value('#host-text') === hostText && value('#host-key') === hostHint && document.documentElement.lang === hostLang, 'Host was localized');
    assert(!root.innerText.includes('prompt.create'), 'Raw semantic key leaked');
    passed.push('in-page UI: host isolation and open editor draft/caret preservation');

    await InputBoxHandler.startPinPickerMode();
    const picker = document.querySelector('#opm-pin-picker-root'); assert(picker, 'Input picker missing');
    await OPMI18n.setLanguage('en');
    assert(picker.innerText.includes('Choose an input field'), 'Input picker remains Chinese');
    await OPMI18n.setLanguage('zh-CN');
    assert(picker.innerText.includes('输入框'), 'Input picker remains English');
    picker.querySelector('button').click();
    InputBoxHandler._showPinToast('inputPicker.clickField');
    await OPMI18n.setLanguage('en');
    assert(value('#opm-pin-toast') === 'Click the input field on the page', 'Toast remains Chinese');
    passed.push('in-page UI: transient picker and toast update without a DOM observer');

    await PanelRouter.mount(PanelView.CHANGELOG); await wait(150);
    let log = document.getElementById('opm-changelog-content'); assert(log, 'Changelog missing');
    await OPMI18n.setLanguage('zh-CN'); await wait(150);
    assert(log.innerText.includes('版本 3.0.6'), 'Chinese changelog missing');
    const nativeFetch = fetch; const pending = [];
    globalThis.fetch = url => String(url).includes('changelog') ? new Promise(resolve => pending.push({ url, resolve })) : nativeFetch(url);
    try {
      await OPMI18n.setLanguage('en'); await OPMI18n.setLanguage('zh-CN');
      const old = pending.find(p => !p.url.includes('zh-CN')); const fresh = pending.find(p => p.url.includes('zh-CN'));
      assert(old && fresh, 'Expected language-specific changelog requests');
      fresh.resolve({ ok: true, text: async () => '<p>新中文日志</p>' }); await wait(0);
      old.resolve({ ok: true, text: async () => '<p>Old English log</p>' }); await wait(0);
      assert(log.textContent === '新中文日志', 'Stale changelog response won');
    } finally { globalThis.fetch = nativeFetch; }
    passed.push('changelog: a stale request cannot overwrite the latest locale');
    globalThis.fetch = url => String(url).includes('changelog.zh-CN') ? Promise.resolve({ ok: false, status: 404 }) : nativeFetch(url);
    try {
      await log.__opmReloadLocalized();
      assert(log.lang === 'en' && log.innerText.includes('英文原文'), 'Changelog fallback is not explicit');
    } finally { globalThis.fetch = nativeFetch; }
    passed.push('changelog: missing Chinese resource falls back explicitly to English');
    return passed;
  };
})();
