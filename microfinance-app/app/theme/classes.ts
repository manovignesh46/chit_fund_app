/**
 * Reusable Tailwind class strings for dual-theme (light = original, dark = themed).
 * Prefer these over ad-hoc color classes in components.
 */
export const themeText = {
  primary: 'text-gray-900 dark:text-theme-primary',
  secondary: 'text-gray-700 dark:text-theme-secondary',
  muted: 'text-gray-500 dark:text-theme-muted',
  // Neutral heading — blue reserved for interactive elements only
  heading: 'text-gray-900 dark:text-theme-heading',
  pageTitle: 'text-2xl sm:text-3xl font-bold text-gray-900 dark:text-theme-heading',
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
  danger: 'btn-danger',
} as const;

export const themeFilter = {
  chip: 'filter-chip',
  active: 'filter-chip-active-blue',
  // Kept for backward compat — both resolve to blue
  activeBlue: 'filter-chip-active-blue',
  activeGreen: 'filter-chip-active-blue',
} as const;

export const themePagination = {
  nav: 'pagination-nav-btn',
  page: 'pagination-page',
  pageActive: 'pagination-page-active',
  info: 'pagination-info',
} as const;
