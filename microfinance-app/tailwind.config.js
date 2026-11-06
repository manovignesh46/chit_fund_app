const plugin = require('tailwindcss/plugin');
const themeExtension = require('./tailwind.theme');

module.exports = {
  ...themeExtension,
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    ...themeExtension.theme,
    extend: {
      ...themeExtension.theme?.extend,
      // Plain `border` follows the theme (it was hard-coded gray-200, which is why
      // so many pages pair it with a hand-written dark: border class).
      borderColor: {
        DEFAULT: 'hsl(var(--border))',
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
    // `sidebar-collapsed:` applies while the desktop sidebar is collapsed to icons
    // (<html data-sidebar="collapsed">, set before first paint by app/theme/inline-script.ts).
    plugin(({ addVariant }) => {
      addVariant('sidebar-collapsed', 'html[data-sidebar="collapsed"] &');
    }),
  ],
};
