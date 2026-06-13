const themeExtension = require('./tailwind.theme');

module.exports = {
  ...themeExtension,
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './styles/**/*.{css}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  // Keep default border color consistent with v2 behaviour (gray-200 / #e5e7eb)
  // so existing `border` classes don't suddenly switch to currentColor in v3.
  theme: {
    ...themeExtension.theme,
    extend: {
      ...themeExtension.theme?.extend,
      borderColor: {
        DEFAULT: '#e5e7eb',
      },
    },
  },
  // Safelist classes used in dynamic template literals (JIT won't detect them otherwise)
  safelist: [
    'lg:w-16',
    'lg:w-64',
  ],
  plugins: [],
};
