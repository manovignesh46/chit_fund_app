import type { ThemePreference } from './types';

/** localStorage key for persisted theme preference */
export const THEME_STORAGE_KEY = 'am-fincorp-theme';

/** Applied on <html> for CSS selectors and debugging */
export const THEME_DATA_ATTRIBUTE = 'data-theme';

/** Tailwind darkMode class toggled on <html> */
export const THEME_DARK_CLASS = 'dark';

export const THEME_PREFERENCES: ThemePreference[] = ['light', 'dark', 'system'];

export const THEME_OPTION_META: Record<
  ThemePreference,
  { label: string; description: string }
> = {
  light: {
    label: 'Light',
    description: 'Bright backgrounds with dark text',
  },
  dark: {
    label: 'Dark',
    description: 'Dark backgrounds with light text',
  },
  system: {
    label: 'System',
    description: 'Follow your device appearance setting',
  },
};
