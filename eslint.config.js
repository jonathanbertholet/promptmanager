import globals from 'globals';
import js from '@eslint/js';

// COMMENT: Globals available to content scripts after the injection bundle loads
const contentScriptGlobals = {
  ...globals.browser,
  ...globals.webextensions,
  chrome: 'readonly',
  PromptUIManager: 'readonly',
  InputBoxHandler: 'readonly',
  PromptStorageManager: 'readonly',
  PanelRouter: 'readonly',
  PanelView: 'readonly',
  TagService: 'readonly',
  TagUI: 'readonly',
  PromptUI: 'readonly',
  ScrollVisibilityManager: 'readonly',
  injectGlobalStyles: 'readonly',
  SELECTORS: 'readonly',
  THEME_COLORS: 'readonly',
  UI_STYLES: 'readonly',
  PROMPT_CLOSE_DELAY: 'readonly',
  IMPORT_SUCCESS_RESET_MS: 'readonly',
  createEl: 'readonly',
  getMode: 'readonly',
  getIconFilter: 'readonly',
  showEl: 'readonly',
  hideEl: 'readonly',
  isDarkMode: 'readonly',
};

const baseRules = {
  indent: ['error', 2],
  quotes: ['error', 'single'],
  semi: ['error', 'always'],
  'no-unused-vars': 'off',
  'no-console': 'off',
  'no-empty': ['error', { allowEmptyCatch: true }],
};

const classicScriptRules = {
  ...baseRules,
  // COMMENT: Classic scripts intentionally assign classes/constants onto shared globals
  'no-redeclare': ['error', { builtinGlobals: false }],
};

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.webextensions,
        chrome: 'readonly',
      },
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: baseRules,
  },
  {
    files: ['src/content.js', 'src/content.shared.js'],
    languageOptions: {
      globals: contentScriptGlobals,
      ecmaVersion: 2022,
      sourceType: 'script',
    },
    rules: classicScriptRules,
  },
  {
    files: ['src/utils/promptInsertUtils.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        module: 'writable',
      },
      ecmaVersion: 2022,
      sourceType: 'script',
    },
    rules: classicScriptRules,
  },
  {
    files: ['src/content.styles.js', 'src/handlers/inputBoxHandler.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.webextensions,
        chrome: 'readonly',
        PromptUIManager: 'readonly',
        PromptInsertUtils: 'readonly',
      },
      ecmaVersion: 2022,
      sourceType: 'script',
    },
    rules: classicScriptRules,
  },
  {
    ignores: [
      'node_modules/**',
      'tests/**',
      'src/icons/**',
    ],
  },
];
