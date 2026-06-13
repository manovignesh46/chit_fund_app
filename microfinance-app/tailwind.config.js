const themeExtension = require('./tailwind.theme');

module.exports = {
  ...themeExtension,
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './styles/**/*.{css}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  plugins: [],
};
