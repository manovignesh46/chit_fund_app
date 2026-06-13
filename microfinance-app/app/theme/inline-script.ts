import { THEME_DARK_CLASS, THEME_DATA_ATTRIBUTE, THEME_STORAGE_KEY } from './config';

/**
 * Inline script run before paint to avoid a flash of the wrong theme.
 * Logic must stay in sync with resolve.ts + storage.ts.
 */
export const THEME_INIT_SCRIPT = `
(function() {
  try {
    var stored = localStorage.getItem('${THEME_STORAGE_KEY}');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = stored === 'dark' || ((stored === 'system' || !stored) && prefersDark);
    var root = document.documentElement;
    if (dark) {
      root.classList.add('${THEME_DARK_CLASS}');
      root.setAttribute('${THEME_DATA_ATTRIBUTE}', 'dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('${THEME_DARK_CLASS}');
      root.setAttribute('${THEME_DATA_ATTRIBUTE}', 'light');
      root.style.colorScheme = 'light';
    }
  } catch (e) {}
})();
`.trim();
