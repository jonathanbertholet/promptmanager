/**
 * Theme — follows system by default; nav toggle sets light/dark override.
 */
import { opdIcon } from './opd-icons.js';

const OVERRIDE_KEY = 'opd-theme-override';
const LEGACY_KEY = 'opd-theme';

let listenersWired = false;

/**
 * Migrate old three-way preference to override model.
 */
function migrateLegacyStorage() {
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy === 'light' || legacy === 'dark') {
      localStorage.setItem(OVERRIDE_KEY, legacy);
    }
    if (legacy) localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* private mode */
  }
}

/**
 * @returns {'light' | 'dark' | null}
 */
export function getThemeOverride() {
  try {
    const v = localStorage.getItem(OVERRIDE_KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * @returns {'light' | 'dark'}
 */
export function getEffectiveTheme() {
  const override = getThemeOverride();
  if (override) return override;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * @param {'light' | 'dark'} theme
 */
export function setThemeOverride(theme) {
  try {
    localStorage.setItem(OVERRIDE_KEY, theme);
  } catch {
    /* ignore */
  }
  applyTheme(getEffectiveTheme());
  syncThemeToggleButtons();
}

/** Flip between light and dark (user override). */
export function toggleThemeOverride() {
  setThemeOverride(getEffectiveTheme() === 'dark' ? 'light' : 'dark');
}

/**
 * @param {'light' | 'dark'} effective
 */
export function applyTheme(effective) {
  document.documentElement.dataset.opdTheme = effective;
  document.body.classList.toggle('opd-theme-dark', effective === 'dark');
}

/**
 * Icon reflects current appearance; click switches to the other mode.
 * @param {'light' | 'dark'} effective
 */
function themeButtonState(effective) {
  if (effective === 'dark') {
    return { icon: 'light_mode', label: 'Switch to light theme' };
  }
  return { icon: 'dark_mode', label: 'Switch to dark theme' };
}

/** Update nav theme toggle after preference or system change. */
export function syncThemeToggleButtons() {
  const effective = getEffectiveTheme();
  const { icon, label } = themeButtonState(effective);
  document.querySelectorAll('[data-opd-theme-toggle]').forEach((btn) => {
    const iconSlot = btn.querySelector('.opd-nav-drawer-btn-icon');
    if (iconSlot) {
      iconSlot.innerHTML = opdIcon(icon);
    } else {
      btn.innerHTML = opdIcon(icon);
    }
    btn.setAttribute('aria-label', label);
    btn.setAttribute('title', label);
  });
}

/** Inline script in <head> — keep in sync with getEffectiveTheme(). */
export function themeBootstrapScript() {
  return `(function(){try{var o=localStorage.getItem('opd-theme-override'),m=matchMedia('(prefers-color-scheme:dark)').matches,e=o==='dark'||(o!=='light'&&m);document.documentElement.dataset.opdTheme=e?'dark':'light';if(e)document.body.classList.add('opd-theme-dark');}catch(x){}})();`;
}

export function initTheme() {
  migrateLegacyStorage();
  applyTheme(getEffectiveTheme());
  syncThemeToggleButtons();

  if (!listenersWired) {
    listenersWired = true;
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (!getThemeOverride()) applyTheme(getEffectiveTheme());
      syncThemeToggleButtons();
    });
    // Nav mounts the button after this module loads — delegate clicks on document
    document.addEventListener('click', (e) => {
      if (!e.target.closest('[data-opd-theme-toggle]')) return;
      e.preventDefault();
      toggleThemeOverride();
    });
  }
}

initTheme();
