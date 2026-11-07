/**
 * Tailwind theme extension. Every colour reads a token from styles/theme/variables.css.
 * Tokens are HSL channels, so opacity modifiers work (`bg-primary/90`).
 *
 * shadcn names: background, foreground, card, popover, primary, secondary, muted,
 * accent, destructive, border, input, ring, sidebar.
 * App additions: success, warning, info, elevated, field, subtle, overlay, chart.
 */
const token = (name) => `hsl(var(--${name}) / <alpha-value>)`;

module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        border: token('border'),
        input: token('input'),
        field: token('field'),
        ring: token('ring'),
        background: token('background'),
        foreground: token('foreground'),
        elevated: token('elevated'),
        overlay: token('overlay'),
        card: { DEFAULT: token('card'), foreground: token('card-foreground') },
        popover: { DEFAULT: token('popover'), foreground: token('popover-foreground') },
        muted: { DEFAULT: token('muted'), foreground: token('muted-foreground') },
        subtle: { foreground: token('subtle-foreground') },
        accent: { DEFAULT: token('accent'), foreground: token('accent-foreground') },
        secondary: { DEFAULT: token('secondary'), foreground: token('secondary-foreground') },
        primary: {
          DEFAULT: token('primary'),
          foreground: token('primary-foreground'),
          hover: token('primary-hover'),
          text: token('primary-text'),
          subtle: token('primary-subtle'),
          border: token('primary-border'),
        },
        destructive: {
          DEFAULT: token('destructive'),
          foreground: token('destructive-foreground'),
          text: token('destructive-text'),
          subtle: token('destructive-subtle'),
          border: token('destructive-border'),
        },
        success: {
          DEFAULT: token('success'),
          foreground: token('success-foreground'),
          text: token('success-text'),
          subtle: token('success-subtle'),
          border: token('success-border'),
        },
        warning: {
          DEFAULT: token('warning'),
          foreground: token('warning-foreground'),
          text: token('warning-text'),
          subtle: token('warning-subtle'),
          border: token('warning-border'),
        },
        info: {
          text: token('info-text'),
          subtle: token('info-subtle'),
          border: token('info-border'),
        },
        chart: {
          1: token('chart-1'),
          2: token('chart-2'),
          3: token('chart-3'),
          4: token('chart-4'),
          5: token('chart-5'),
          6: token('chart-6'),
        },
        sidebar: {
          DEFAULT: token('sidebar-background'),
          foreground: token('sidebar-foreground'),
          primary: token('sidebar-primary'),
          'primary-foreground': token('sidebar-primary-foreground'),
          accent: token('sidebar-accent'),
          'accent-foreground': token('sidebar-accent-foreground'),
          border: token('sidebar-border'),
          ring: token('sidebar-ring'),
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
      },
      keyframes: {
        'progress-indeterminate': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(250%)' },
        },
      },
      animation: {
        'progress-indeterminate': 'progress-indeterminate 1.1s ease-in-out infinite',
      },
    },
  },
};
