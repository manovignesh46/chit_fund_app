// Script to ensure TypeScript and type definitions are properly installed
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Ensuring TypeScript and type definitions are properly installed...');

// Check if TypeScript is installed
const typescriptPath = path.join(process.cwd(), 'node_modules', 'typescript');
const typesReactPath = path.join(process.cwd(), 'node_modules', '@types', 'react');
const typesReactDomPath = path.join(process.cwd(), 'node_modules', '@types', 'react-dom');
const typesNodePath = path.join(process.cwd(), 'node_modules', '@types', 'node');

let needsInstall = false;

if (!fs.existsSync(typescriptPath)) {
  console.log('TypeScript is not installed. Will install it.');
  needsInstall = true;
}

if (!fs.existsSync(typesReactPath)) {
  console.log('@types/react is not installed. Will install it.');
  needsInstall = true;
}

if (!fs.existsSync(typesReactDomPath)) {
  console.log('@types/react-dom is not installed. Will install it.');
  needsInstall = true;
}

if (!fs.existsSync(typesNodePath)) {
  console.log('@types/node is not installed. Will install it.');
  needsInstall = true;
}

// Install TypeScript and type definitions if needed
if (needsInstall) {
  console.log('Installing TypeScript and type definitions...');
  try {
    execSync('npm install --save-dev typescript @types/react @types/react-dom @types/node', { stdio: 'inherit' });
    console.log('TypeScript and type definitions installed successfully.');
  } catch (error) {
    console.error('Error installing TypeScript and type definitions:', error.message);
    process.exit(1);
  }
} else {
  console.log('TypeScript and type definitions are already installed.');
}

// Check if next-env.d.ts exists
const nextEnvPath = path.join(process.cwd(), 'next-env.d.ts');
if (!fs.existsSync(nextEnvPath)) {
  console.log('next-env.d.ts does not exist. Creating it...');
  try {
    const nextEnvContent = `/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
`;
    fs.writeFileSync(nextEnvPath, nextEnvContent);
    console.log('next-env.d.ts created successfully.');
  } catch (error) {
    console.error('Error creating next-env.d.ts:', error.message);
  }
} else {
  console.log('next-env.d.ts already exists.');
}

console.log('TypeScript setup completed successfully!');
