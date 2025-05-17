#!/usr/bin/env node

/**
 * Pre-build script to ensure TypeScript and type definitions are installed
 * This script is run before the Next.js build to ensure TypeScript is available
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Running pre-build script to ensure TypeScript is installed...');

// Check if we're running on Vercel
const isVercel = process.env.VERCEL === '1';
console.log(`Running on Vercel: ${isVercel ? 'Yes' : 'No'}`);

// Install TypeScript and type definitions
try {
  console.log('Installing TypeScript and type definitions...');
  execSync('npm install --save-dev typescript@latest @types/react@latest @types/react-dom@latest @types/node@latest', {
    stdio: 'inherit'
  });
  console.log('TypeScript and type definitions installed successfully.');
} catch (error) {
  console.error('Error installing TypeScript and type definitions:', error.message);
  process.exit(1);
}

// Create a next-env.d.ts file if it doesn't exist
const nextEnvPath = path.join(process.cwd(), 'next-env.d.ts');
if (!fs.existsSync(nextEnvPath)) {
  console.log('Creating next-env.d.ts file...');
  const nextEnvContent = `/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
`;
  fs.writeFileSync(nextEnvPath, nextEnvContent);
  console.log('next-env.d.ts file created successfully.');
}

// Create a custom type declaration file for React
const reactTypesPath = path.join(process.cwd(), 'react-types.d.ts');
console.log('Creating custom React type declaration file...');
const reactTypesContent = `// Custom type declarations for React
declare module 'react' {
  export * from '@types/react';
}

declare module 'react-dom' {
  export * from '@types/react-dom';
}
`;
fs.writeFileSync(reactTypesPath, reactTypesContent);
console.log('Custom React type declaration file created successfully.');

// Update tsconfig.json to include the custom type declaration file
const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
if (fs.existsSync(tsconfigPath)) {
  console.log('Updating tsconfig.json to include custom type declaration file...');
  const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
  
  // Add the custom type declaration file to the include array
  if (!tsconfig.include) {
    tsconfig.include = [];
  }
  
  if (!tsconfig.include.includes('react-types.d.ts')) {
    tsconfig.include.push('react-types.d.ts');
  }
  
  fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2));
  console.log('tsconfig.json updated successfully.');
}

console.log('Pre-build script completed successfully.');
