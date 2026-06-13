/** Tailwind theme extension — colors driven by CSS variables in styles/theme/variables.css */
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: 'var(--color-surface)',
          sidebar: 'var(--color-surface-sidebar)',
          card: 'var(--color-surface-card)',
          elevated: 'var(--color-surface-elevated)',
          hover: 'var(--color-surface-hover)',
          border: 'var(--color-surface-border)',
        },
        theme: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
          heading: 'var(--color-text-heading)',
        },
      },
    },
  },
};
