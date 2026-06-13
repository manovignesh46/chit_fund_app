// Types
export type { ThemePreference, ResolvedTheme, ThemeContextValue } from './types';

// Config constants
export {
  THEME_STORAGE_KEY,
  THEME_DATA_ATTRIBUTE,
  THEME_DARK_CLASS,
  THEME_PREFERENCES,
  THEME_OPTION_META,
} from './config';

// Pure utilities (safe for tests / non-React code)
export {
  getSystemTheme,
  resolveTheme,
  applyThemeToDocument,
} from './resolve';
export {
  isThemePreference,
  readStoredPreference,
  writeStoredPreference,
} from './storage';

// Tailwind class helpers
export { themeText, themeSurface, themeBtn, themeFilter, themePagination } from './classes';

// React API
export { ThemeProvider } from './ThemeProvider';
export { useTheme } from './useTheme';
export { default as ThemeScript } from './ThemeScript';
export { default as ThemePicker } from './ThemePicker';
