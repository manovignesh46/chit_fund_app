import {
  SIDEBAR_DATA_ATTRIBUTE,
  SIDEBAR_STORAGE_KEY,
  THEME_COLOR_DARK,
  THEME_COLOR_LIGHT,
  THEME_DARK_CLASS,
  THEME_DATA_ATTRIBUTE,
  THEME_STORAGE_KEY,
} from './config';

/**
 * Inline script run before paint to avoid a flash of the wrong theme or the wrong
 * sidebar width. Logic must stay in sync with resolve.ts + storage.ts and
 * components/kit/app-shell/sidebar-state.ts.
 */
export const THEME_INIT_SCRIPT = `
(function() {
  var root = document.documentElement;
  var dark = false;
  try {
    var stored = localStorage.getItem('${THEME_STORAGE_KEY}');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    dark = stored === 'dark' || ((stored === 'system' || !stored) && prefersDark);
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
  try {
    var sidebar = localStorage.getItem('${SIDEBAR_STORAGE_KEY}');
    root.setAttribute('${SIDEBAR_DATA_ATTRIBUTE}', sidebar === 'collapsed' ? 'collapsed' : 'expanded');
  } catch (e) {
    root.setAttribute('${SIDEBAR_DATA_ATTRIBUTE}', 'expanded');
  }
  try {
    var color = dark ? '${THEME_COLOR_DARK}' : '${THEME_COLOR_LIGHT}';
    var setColor = function() {
      var metas = document.querySelectorAll('meta[name="theme-color"]');
      for (var i = 0; i < metas.length; i++) metas[i].setAttribute('content', color);
      return metas.length > 0;
    };
    if (!setColor()) document.addEventListener('DOMContentLoaded', setColor, { once: true });
  } catch (e) {}
})();
`.trim();
