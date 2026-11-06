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
  // Safelist classes used in dynamic template literals (JIT won't detect them otherwise)
  safelist: [
    'lg:w-16',
    'lg:w-64',
  ],
  plugins: [require('tailwindcss-animate')],
};
