/**
 * Reusable Tailwind class strings for dual-theme (light = original, dark = themed).
 * Prefer these over ad-hoc gray/dark pairs in components.
 */
export const themeText = {
  primary: 'text-gray-900 dark:text-theme-primary',
  secondary: 'text-gray-700 dark:text-theme-secondary',
  muted: 'text-gray-500 dark:text-theme-muted',
  heading: 'text-blue-700 dark:text-theme-heading',
  pageTitle: 'text-2xl sm:text-3xl font-bold text-blue-700 dark:text-theme-heading',
} as const;

export const themeSurface = {
  card: 'themed-card',
  input: 'themed-input',
  page: 'page-container',
  elevated: 'bg-gray-50 dark:bg-surface-elevated',
  hover: 'hover:bg-gray-50 dark:hover:bg-surface-hover',
  border: 'border-gray-200 dark:border-surface-border',
} as const;

export const themeBtn = {
  neutral: 'btn-neutral',
  secondary: 'btn-secondary',
  primary: 'btn-primary',
} as const;

export const themeFilter = {
  chip: 'filter-chip',
  activeBlue: 'filter-chip-active-blue',
  activeGreen: 'filter-chip-active-green',
} as const;

export const themePagination = {
  nav: 'pagination-nav-btn',
  page: 'pagination-page',
  pageActive: 'pagination-page-active',
  info: 'pagination-info',
} as const;
