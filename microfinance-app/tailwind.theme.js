/** Tailwind theme extension — colors driven by CSS variables in styles/theme/variables.css */
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        /* Surface tokens */
        surface: {
          DEFAULT: 'var(--color-surface)',
          sidebar: 'var(--color-surface-sidebar)',
          card: 'var(--color-surface-card)',
          elevated: 'var(--color-surface-elevated)',
          hover: 'var(--color-surface-hover)',
          border: 'var(--color-surface-border)',
        },
        /* Text tokens */
        theme: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
          heading: 'var(--color-text-heading)',
        },
        /* Brand accent */
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)',
          light: 'var(--color-primary-light)',
          border: 'var(--color-primary-border)',
        },
        /* Semantic status */
        success: {
          DEFAULT: 'var(--color-success)',
          light: 'var(--color-success-light)',
          border: 'var(--color-success-border)',
        },
        danger: {
          DEFAULT: 'var(--color-danger)',
          light: 'var(--color-danger-light)',
          border: 'var(--color-danger-border)',
        },
        warning: {
          DEFAULT: 'var(--color-warning)',
          light: 'var(--color-warning-light)',
          border: 'var(--color-warning-border)',
        },
      },
    },
  },
};
