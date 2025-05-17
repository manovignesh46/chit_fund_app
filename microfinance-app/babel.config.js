module.exports = {
  presets: [
    [
      'next/babel',
      {
        'preset-typescript': {
          // Disable TypeScript type checking
          isTSX: true,
          allExtensions: true,
          allowNamespaces: true,
          allowDeclareFields: true,
          onlyRemoveTypeImports: false
        }
      }
    ]
  ],
  plugins: []
};