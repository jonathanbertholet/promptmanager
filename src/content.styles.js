// content.styles.js
// COMMENT: Extracted styles and merged global constants to reduce content.js size without changing behavior.
// COMMENT: We expose constants and the style injector globally; no permissions or manifest changes required.

/* Global constants (merged from content.constants.js) */
// COMMENT: Use var and window assignments so subsequent injected files see these values.
var THEME_COLORS = window.THEME_COLORS || {
  primary: '#3674B5', primaryGradientStart: '#3674B5', primaryGradientEnd: '#578FCA',
  hoverPrimary: '#205295', darkBackground: '#0A2647', lightBackground: '#F7FAFC',
  darkBorder: '#144272', lightBorder: '#E2E8F0',
  darkShadow: '0 4px 20px rgba(0,0,0,0.3)', lightShadow: '0 4px 20px rgba(0,0,0,0.15)',
  inputDarkBorder: '1px solid #4A5568', inputLightBorder: '1px solid #CBD5E0',
  inputDarkBg: '#2D3748', inputLightBg: '#FFFFFF',
  inputDarkText: '#E2E8F0', inputLightText: '#2D3748'
};
window.THEME_COLORS = THEME_COLORS;

var UI_STYLES = window.UI_STYLES || {
  getPromptButtonContainerStyle: pos => ({
    position: 'fixed', zIndex: '9999',
    bottom: `${pos.y}px`, right: `${pos.x}px`,
    width: '40px', height: '40px',
    userSelect: 'none',
  }),
  hotCornerActiveZone: {
    position: 'fixed',
    bottom: '0',
    right: '0',
    width: '60px',
    height: '60px',
    zIndex: '9998',
    backgroundColor: 'transparent'
  }
};
window.UI_STYLES = UI_STYLES;

var PROMPT_CLOSE_DELAY = typeof window.PROMPT_CLOSE_DELAY === 'number' ? window.PROMPT_CLOSE_DELAY : 10000;
window.PROMPT_CLOSE_DELAY = PROMPT_CLOSE_DELAY;

var SELECTORS = window.SELECTORS || {
  ROOT: 'opm-root',
  PROMPT_BUTTON_CONTAINER: 'opm-prompt-button-container',
  PROMPT_BUTTON: 'opm-prompt-button',
  PROMPT_LIST: 'opm-prompt-list',
  PANEL_CONTENT: 'opm-panel-content',
  PROMPT_SEARCH_INPUT: 'opm-prompt-search-input',
  PROMPT_ITEMS_CONTAINER: 'opm-prompt-items-container',
  ONBOARDING_POPUP: 'opm-onboarding-popup',
  HOT_CORNER_CONTAINER: 'opm-hot-corner-container',
  HOT_CORNER_INDICATOR: 'opm-hot-corner-indicator',
  INFO_CONTENT: 'opm-info-content',
  CHANGELOG_CONTENT: 'opm-changelog-content'
};
window.SELECTORS = SELECTORS;

// COMMENT: Make function globally available (uses constants defined above)
var injectGlobalStyles = window.injectGlobalStyles || function injectGlobalStyles() {
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    #${SELECTORS.ROOT} {
      --primary: ${THEME_COLORS.primary};
      --primary-gradient-start: ${THEME_COLORS.primaryGradientStart};
      --primary-gradient-end: ${THEME_COLORS.primaryGradientEnd};
      --hover-primary: ${THEME_COLORS.hoverPrimary};
      --dark-bg: ${THEME_COLORS.darkBackground};
      --light-bg: ${THEME_COLORS.lightBackground};
      --dark-border: ${THEME_COLORS.darkBorder};
      --light-border: ${THEME_COLORS.lightBorder};
      --dark-shadow: ${THEME_COLORS.darkShadow};
      --light-shadow: ${THEME_COLORS.lightShadow};
      --input-dark-border: ${THEME_COLORS.inputDarkBorder};
      --input-light-border: ${THEME_COLORS.inputLightBorder};
      --input-dark-bg: ${THEME_COLORS.inputDarkBg};
      --input-light-bg: ${THEME_COLORS.inputLightBg};
      --input-dark-text: ${THEME_COLORS.inputDarkText};
      --input-light-text: ${THEME_COLORS.inputLightText};
      --transition-speed: 0.3s;
      --border-radius: 8px;
      --font-family: 'Roboto', sans-serif;
    }
    
    /* COMMENT: Scrollbars remain hidden until ScrollVisibilityManager marks activity */
    #${SELECTORS.ROOT} .opm-scrollable {
      scrollbar-width: none;
      scrollbar-color: transparent transparent;
    }
    #${SELECTORS.ROOT} .opm-scrollable::-webkit-scrollbar {
      width: 0;
      height: 0;
      background: transparent;
    }
    #${SELECTORS.ROOT} .opm-scrollable.opm-scroll-active {
      scrollbar-width: auto !important;
      scrollbar-color: ${THEME_COLORS.primary}90 transparent !important;
    }
    #${SELECTORS.ROOT} .opm-scrollable.opm-scroll-active::-webkit-scrollbar {
      width: 10px;
      height: 10px;
    }
    #${SELECTORS.ROOT} .opm-scrollable.opm-scroll-active::-webkit-scrollbar-thumb {
      background-color: ${THEME_COLORS.primary}90;
      border-radius: 8px;
    }
    #${SELECTORS.ROOT} .opm-scrollable.opm-scroll-active::-webkit-scrollbar-track {
      background: transparent;
    }
    /* COMMENT: Horizontal tags bar uses a shorter scrollbar when active */
    #${SELECTORS.ROOT} .opm-tags-filter-bar.opm-scroll-active::-webkit-scrollbar {
      height: 8px;
    }
    
    #${SELECTORS.ROOT}, #${SELECTORS.ROOT} * { font-family: var(--font-family); }
    /* Prompt Button styling */
    #${SELECTORS.ROOT} .opm-prompt-button {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      border: none;
      outline: none;
      cursor: pointer;
      background: linear-gradient(135deg, var(--primary-gradient-start), var(--primary-gradient-end));
      background-size: cover;
      box-shadow: var(--light-shadow);
      transition: transform var(--transition-speed) ease, box-shadow var(--transition-speed) ease;
      background-position: center;
      background-repeat: no-repeat;
      position: relative;
    }
    
    /* Toggle switch styling */
    #${SELECTORS.ROOT} .opm-toggle-switch {
      position: relative;
      width: 40px;
      height: 20px;
      border-radius: 10px;
      cursor: pointer;
      transition: background-color var(--transition-speed) ease;
    }
    
    #${SELECTORS.ROOT} .opm-toggle-switch.opm-light {
      background-color: #cbd5e0;
    }
    
    #${SELECTORS.ROOT} .opm-toggle-switch.opm-dark {
      background-color: #4a5568;
    }
    
    #${SELECTORS.ROOT} .opm-toggle-switch.active.opm-light {
      background-color: var(--primary);
    }
    
    #${SELECTORS.ROOT} .opm-toggle-switch.active.opm-dark {
      background-color: var(--primary);
    }
    
    #${SELECTORS.ROOT} .opm-toggle-switch::after {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background-color: #fff;
      transition: transform var(--transition-speed) ease;
    }
    
    #${SELECTORS.ROOT} .opm-toggle-switch.active::after {
      transform: translateX(20px);
    }
    
    /* Prompt Button styling */
    #${SELECTORS.ROOT} .opm-prompt-button::after {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-image: url('${chrome.runtime.getURL('icons/icon-button.png')}');
      background-size: 50%;
      background-position: center;
      background-repeat: no-repeat;
    }
    #${SELECTORS.ROOT} .opm-prompt-button:hover {
      transform: scale(1.05);
      box-shadow: var(--dark-shadow);
    }
    /* Prompt list container styling */
    #${SELECTORS.ROOT} .opm-prompt-list {
      position: absolute;
      bottom: 50px;
      right: 0;
      padding: 10px;
      border-radius: var(--border-radius);
      display: none;
      width: 280px;
      z-index: 10000;
      opacity: 0;
      transform: translateY(10px);
      transition: opacity var(--transition-speed) ease, transform var(--transition-speed) ease;
      backdrop-filter: blur(12px);
      /* Constrain panel and let inner list scroll. The main scroll must be inside items, not the whole panel. */
      display: flex;
      flex-direction: column;
      min-height: 450px;
      max-height: 450px;
      overflow: hidden; /* prevent bottom menu from being pushed outside */
    }
    /* Dedicated scrollable content container inside the panel */
    #${SELECTORS.ROOT} #${SELECTORS.PANEL_CONTENT} {
      flex: 1 1 auto;
      min-height: 0;
      overflow: hidden; /* keep scroll limited to items container */
      position: relative; /* anchor bottom menu absolutely inside */
      padding-bottom: 10px; /* reserve space for bottom menu; ensure last item fully visible above it */
      display: flex; /* allow children (list items container or forms) to flex */
      flex-direction: column;
      padding-bottom: 64px; /* COMMENT: increase reserved space to avoid overlap with bottom menu */
    }
    #${SELECTORS.ROOT} .opm-prompt-list.opm-visible {
      opacity: 1;
      transform: translateY(0);
    }
    #${SELECTORS.ROOT} .opm-prompt-list.opm-light {
      background-color: var(--light-bg);
      border: 1px solid var(--light-border);
      box-shadow: var(--light-shadow);
    }
    #${SELECTORS.ROOT} .opm-prompt-list.opm-dark {
      background-color: var(--dark-bg);
      border: 1px solid var(--dark-border);
      box-shadow: var(--dark-shadow);
    }
    /* Height modes: fixed (non-list views) vs variable (list view) */
    #${SELECTORS.ROOT} .opm-prompt-list.opm-fixed-400 {
      min-height: 400px;
      max-height: 400px;
    }
    #${SELECTORS.ROOT} .opm-prompt-list.opm-variable {
      height: auto;
      min-height: 0;
      max-height: 400px;
    }
    /* List Items styled as modern cards */
    #${SELECTORS.ROOT} .opm-prompt-list-items {
      max-height: 350px;
      overflow-y: auto;
      margin-bottom: 8px;
      padding-top: 4px;
      padding-bottom: 24px; /* COMMENT: extra space so the last item is not obscured by bottom menu */
      flex: 1 1 auto; /* ensure items take available space and scroll internally */
    }
    #${SELECTORS.ROOT} .opm-prompt-list-items.opm-light {
      background-color: var(--light-bg);
    }
    #${SELECTORS.ROOT} .opm-prompt-list-items.opm-dark {
      background-color: var(--dark-bg);
    }
    /* Tags filter bar (LIST view only) */
    #${SELECTORS.ROOT} .opm-tags-filter-bar {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 6px;
      overflow-x: auto;
      overflow-y: hidden;
      white-space: nowrap;
      padding: 6px 8px;
      border-bottom: 1px solid rgba(0,0,0,0.08);
      min-height: 34px; /* fixed height impact so panel doesn’t jump */
      box-sizing: border-box;
      flex: none; /* don’t grow/shrink; keep list area stable */
    }
    #${SELECTORS.ROOT}.opm-dark .opm-tags-filter-bar { border-bottom-color: rgba(255,255,255,0.12); }
    #${SELECTORS.ROOT} .opm-tag-pill-filter {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 4px 10px;
      border-radius: 9999px;
      border: 1px solid var(--light-border);
      font-size: 13px;
      cursor: pointer;
      flex: 0 0 auto;
      user-select: none;
      background-color: #FFFFFF;
      color: var(--input-light-text);
    }
    #${SELECTORS.ROOT}.opm-dark .opm-tag-pill-filter {
      border-color: var(--dark-border);
      background-color: #144272;
      color: var(--input-dark-text);
    }
    /* Selected state for tag pill */
    #${SELECTORS.ROOT} .opm-tag-pill-filter[aria-pressed="true"] {
      background-color: #E6F0FF;
      border-color: #BBD3FF;
    }
    #${SELECTORS.ROOT}.opm-dark .opm-tag-pill-filter[aria-pressed="true"] {
      background-color: #2E3A4E;
      border-color: #3E4C66;
    }
    /* Generic text colors for common containers */
    #${SELECTORS.ROOT} .opm-form-container.opm-light { color: var(--input-light-text); }
    #${SELECTORS.ROOT} .opm-form-container.opm-dark { color: var(--input-dark-text); }
    /* Tighter spacing only for prompt creation form */
    #${SELECTORS.ROOT} .opm-create-form { gap: 4px !important; }
    /* Let textarea fields expand to available space in forms */
    #${SELECTORS.ROOT} .opm-form-container {
      display: flex;
      flex-direction: column;
      min-height: 0; /* allow children to flex within constrained parent */
      flex: 1 1 auto; /* fill remaining height in panel content */
      overflow-y: auto; /* scroll form if content is taller */
      padding-bottom: 0px; /* keep save buttons above sticky bottom menu */
    }
    #${SELECTORS.ROOT} .opm-form-container .opm-textarea-field {
      flex: 1 1 auto;
      min-height: 0;
      resize: vertical;
    }
    #${SELECTORS.ROOT} .opm-prompt-list-item.opm-light { color: var(--input-light-text); }
    #${SELECTORS.ROOT} .opm-prompt-list-item.opm-dark { color: var(--input-dark-text); }
    #${SELECTORS.ROOT} .opm-prompt-list-item {
      border-radius: var(--border-radius);
      font-size: 14px;
      cursor: pointer;
      transition: background-color var(--transition-speed) ease, transform var(--transition-speed) ease;
      display: flex;
      align-items: center;
      padding: 6px 12px;
    }
    #${SELECTORS.ROOT} .opm-prompt-list-item.opm-light:hover {
      background-color: #e2e8f0;
      transform: translateY(-2px);
    }
    #${SELECTORS.ROOT} .opm-prompt-list-item.opm-dark:hover {
      background-color: #2d3748;
      transform: translateY(-2px);
    }
    /* Drag-and-drop placeholder to displace items during reordering */
    #${SELECTORS.ROOT} .opm-drop-placeholder {
      border: 1px dashed var(--light-border);
      background-color: ${THEME_COLORS.primary}14;
      border-radius: var(--border-radius);
      margin: 6px 0;
    }
    #${SELECTORS.ROOT}.opm-dark .opm-drop-placeholder {
      border: 1px dashed var(--dark-border);
      background-color: ${THEME_COLORS.primary}26;
    }
    /* Bottom menu styling: stick to bottom of the container */
    #${SELECTORS.ROOT} .opm-bottom-menu {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 10px;
      border-top: 1px solid var(--light-border);
      flex: none;
      z-index: 1;
      background: transparent;
    }
    #${SELECTORS.ROOT} .opm-bottom-menu.opm-light {
      background-color: var(--light-bg);
    }
    #${SELECTORS.ROOT} .opm-bottom-menu.opm-dark {
      background-color: var(--dark-bg);
      border-top: 1px solid var(--dark-border);
    }
    /* Search input styling */
    #${SELECTORS.ROOT} .opm-prompt-list .opm-search-input {
      width: 100%;
      padding: 8px;
      font-size: 14px;
      border-radius: 4px;
      box-sizing: border-box;
      height: 32px;
      line-height: 20px;
      outline: none;
      transition: border-color var(--transition-speed) ease, box-shadow var(--transition-speed) ease;
      display: none; /* initially hidden until Prompt Manager list opens */
    }
    #${SELECTORS.ROOT} .opm-prompt-list .opm-search-input.opm-light {
      border: var(--input-light-border);
      background-color: var(--input-light-bg);
      color: var(--input-light-text);
    }
    #${SELECTORS.ROOT} .opm-prompt-list .opm-search-input.opm-dark {
      border: var(--input-dark-border);
      background-color: var(--input-dark-bg);
      color: var(--input-dark-text);
    }
    /* Form fields styling */
    #${SELECTORS.ROOT} .opm-input-field, #${SELECTORS.ROOT} .opm-textarea-field {
      width: 100%;
      padding: 8px;
      border-radius: 6px;
      box-sizing: border-box;
      font-size: 14px;
      font-family: var(--font-family);
      color: var(--input-text);
      margin-bottom: 4px;
    }
    #${SELECTORS.ROOT} .opm-input-field.opm-light {
      border: var(--input-light-border);
      background-color: var(--input-light-bg);
      color: var(--input-light-text);
    }
    #${SELECTORS.ROOT} .opm-input-field.opm-dark {
      border: var(--input-dark-border);
      background-color: var(--input-dark-bg);
      color: var(--input-dark-text);
    }
    #${SELECTORS.ROOT} .opm-textarea-field.opm-light {
      border: var(--input-light-border);
      background-color: var(--input-light-bg);
      color: var(--input-light-text);
      min-height: 120px;
      resize: vertical;
    }
    #${SELECTORS.ROOT} .opm-textarea-field.opm-dark {
      border: var(--input-dark-border);
      background-color: var(--input-dark-bg);
      color: var(--input-dark-text);
      min-height: 120px;
      resize: vertical;
    }
    /* Button styling */
    #${SELECTORS.ROOT} .opm-button {
      padding: 10px;
      width: 100%;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      transition: background-color var(--transition-speed) ease;
      color: #fff;
    }
    #${SELECTORS.ROOT} .opm-button.opm-light {
      background-color: var(--primary);
    }
    #${SELECTORS.ROOT} .opm-button.opm-dark {
      background-color: var(--hover-primary);
    }
    #${SELECTORS.ROOT} .opm-button:hover {
      opacity: 0.9;
    }
    /* Icon button styling */
    #${SELECTORS.ROOT} .opm-icon-button {
      width: 28px;
      height: 28px;
      padding: 6px;
      background-color: transparent;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background-color var(--transition-speed) ease;
    }
    #${SELECTORS.ROOT} .opm-icon-button:hover {
      background-color: rgba(0, 0, 0, 0.1);
    }
    
    /* Make bottom menu icons white-ish in dark mode only */
    /* COMMENT: Force white-ish appearance for bottom menu icons when in dark mode */
    #${SELECTORS.ROOT}.opm-dark .opm-bottom-menu .opm-icon-button img {
      /* COMMENT: Use a high-contrast invert with no saturation; keep light mode untouched */
      filter: invert(100%) saturate(0%) brightness(115%) contrast(100%) !important;
    }
    /* Focus style for search input only (avoid styling tag inputs inside forms) */
    #${SELECTORS.ROOT} #${SELECTORS.PROMPT_LIST} .opm-search-input:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 2px rgba(90, 103, 216, 0.3);
      outline: none;
    }
    /* Keyboard navigation styling */
    #${SELECTORS.ROOT} .opm-prompt-list-item.opm-keyboard-selected {
      background-color: var(--dark-bg);
      transform: translateY(-2px);
    }
    #${SELECTORS.ROOT} .opm-prompt-list-item.opm-light.opm-keyboard-selected {
      background-color: #e2e8f0;
      transform: translateY(-2px);
    }
    #${SELECTORS.ROOT} .opm-prompt-list-item.opm-dark.opm-keyboard-selected {
      background-color: #2d3748;
      transform: translateY(-2px);
    }
    #${SELECTORS.ROOT}:not(.opm-edit-mode-active) .opm-edit-only {
      display: none !important;
    }
    #${SELECTORS.ROOT}.opm-edit-mode-active .opm-edit-only {
      display: flex;
    }
    #${SELECTORS.ROOT}:not(.opm-edit-mode-active) .opm-drag-handle {
      cursor: default !important;
    }
    /* Ensure prompt list stays visible during keyboard navigation */
    #${SELECTORS.ROOT} .opm-prompt-list.opm-visible:focus-within {
      display: block;
      opacity: 1;
      transform: translateY(0);
    }
    /* Tags input and pills */
    #${SELECTORS.ROOT} .opm-tag-row {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-wrap: nowrap; /* COMMENT: keep on one line */
      overflow-x: auto;  /* COMMENT: scroll horizontally instead of wrapping */
      min-height: 32px;
      padding: 4px 6px;
      border-radius: 6px;
      position: relative; /* COMMENT: allow suggestions to be positioned absolutely */
    }
    #${SELECTORS.ROOT} .opm-tag-row.opm-light { border: var(--input-light-border); background-color: var(--input-light-bg); }
    #${SELECTORS.ROOT} .opm-tag-row.opm-dark { border: var(--input-dark-border); background-color: var(--input-dark-bg); }
    #${SELECTORS.ROOT} .opm-tags-container { display: flex; gap: 2px; flex-wrap: nowrap; align-items: center; }
    /* Settings tag management: allow wrapping to multiple lines */
    #${SELECTORS.ROOT} .opm-tags-mgmt-container {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
    }
    #${SELECTORS.ROOT} .opm-tag-input {
      flex: 0 0 auto; /* COMMENT: do not grow so row stays one line */
      min-width: 120px;
      border: none;
      outline: none;
      background: transparent;
      color: inherit;
      font-size: 13px;
      padding: 2px 4px;
    }
    #${SELECTORS.ROOT} .opm-tag-pill {
      display: inline-flex;
      align-items: center;
      padding: 1px 6px;
      border-radius: 999px;
      font-size: 12px;
      background-color: ${THEME_COLORS.primary}22;
      color: inherit;
      white-space: nowrap;
      line-height: 1;
      flex: 0 0 auto;
    }
    #${SELECTORS.ROOT} .opm-tag-pill.opm-light { border: 1px solid var(--light-border); }
    #${SELECTORS.ROOT} .opm-tag-pill.opm-dark { border: 1px solid var(--dark-border); }
    #${SELECTORS.ROOT} .opm-tag-remove {
      margin-left: 6px;
      border: none;
      background: transparent;
      color: inherit;
      cursor: pointer;
      font-size: 14px;
      line-height: 1;
      padding: 0 2px;
    }

    /* Tag suggestions dropdown */
    #${SELECTORS.ROOT} .opm-tag-suggestions {
      /* positioning and z-index are set inline by JS to avoid stacking/overflow issues */
      max-height: 160px;
      overflow-y: auto;
      border-radius: 6px;
      box-shadow: var(--light-shadow);
      padding: 4px;
    }
    #${SELECTORS.ROOT} .opm-tag-suggestions.opm-light { background-color: var(--light-bg); border: 1px solid var(--light-border); }
    #${SELECTORS.ROOT} .opm-tag-suggestions.opm-dark { background-color: var(--dark-bg); border: 1px solid var(--dark-border); box-shadow: var(--dark-shadow); }

    #${SELECTORS.ROOT} .opm-tag-suggestion-item {
      padding: 6px 8px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      margin: 2px 0;
    }
    #${SELECTORS.ROOT} .opm-tag-suggestion-item:hover,
    #${SELECTORS.ROOT} .opm-tag-suggestion-item.active {
      background-color: ${THEME_COLORS.primary}22;
    }

    /* Remove focus border/shadow on inputs inside create/edit forms only */
    #${SELECTORS.ROOT} .opm-form-container .opm-input-field.opm-light:focus,
    #${SELECTORS.ROOT} .opm-form-container .opm-textarea-field.opm-light:focus {
      border: var(--input-light-border);
      box-shadow: none;
      outline: none;
    }
    #${SELECTORS.ROOT} .opm-form-container .opm-input-field.opm-dark:focus,
    #${SELECTORS.ROOT} .opm-form-container .opm-textarea-field.opm-dark:focus {
      border: var(--input-dark-border);
      box-shadow: none;
      outline: none;
    }
    #${SELECTORS.ROOT} .opm-form-container .opm-tag-input:focus {
      border: none;
      box-shadow: none;
      outline: none;
    }
    /* Onboarding animation */
    @keyframes opm-onboarding-bounce {
      0%, 100% { transform: translateX(-50%) translateY(0); }
      50% { transform: translateX(-50%) translateY(-5px); }
    }
    /* Responsive styles for onboarding popup */
    @media (max-width: 768px) {
      #${SELECTORS.ROOT} #${SELECTORS.ONBOARDING_POPUP} {
        font-size: 12px;
        padding: 6px 10px;
      }
    }
    /* Hot corner styling */
    #${SELECTORS.ROOT} #${SELECTORS.HOT_CORNER_INDICATOR} {
      opacity: 0.7;
      transition: opacity 0.3s ease, border-width 0.3s ease, border-color 0.3s ease;
    }
    #${SELECTORS.ROOT} #${SELECTORS.HOT_CORNER_CONTAINER}:hover #${SELECTORS.HOT_CORNER_INDICATOR} {
      opacity: 1;
    }
  `;
  document.head.appendChild(styleEl);
};

// COMMENT: Preserve existing bootstrap call in content.js; we do not auto-invoke here to avoid double insertion.
window.injectGlobalStyles = injectGlobalStyles;


