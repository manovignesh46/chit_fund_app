import { THEME_DARK_CLASS, THEME_DATA_ATTRIBUTE } from './config';
import type { ResolvedTheme, ThemePreference } from './types';

export function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'system') return getSystemTheme();
  return preference;
}

/** Sync resolved theme to the document root (Tailwind class + data attribute). */
export function applyThemeToDocument(resolved: ResolvedTheme): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  root.classList.toggle(THEME_DARK_CLASS, resolved === 'dark');
  root.setAttribute(THEME_DATA_ATTRIBUTE, resolved);
  root.style.colorScheme = resolved;
}
