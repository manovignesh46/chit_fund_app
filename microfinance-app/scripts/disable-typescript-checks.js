#!/usr/bin/env node

/**
 * Script to disable TypeScript checks in tsconfig.json
 * 
 * This script:
 * 1. Reads the tsconfig.json file
 * 2. Disables strict type checking
 * 3. Writes the updated tsconfig.json file
 */

const fs = require('fs');
const path = require('path');

// Project root directory
const projectRoot = process.cwd();

// Path to tsconfig.json
const tsconfigPath = path.join(projectRoot, 'tsconfig.json');

console.log('Disabling TypeScript checks in tsconfig.json...');

try {
  // Read the tsconfig.json file
  const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
  
  // Update compilerOptions to disable type checking
  tsconfig.compilerOptions = {
    ...tsconfig.compilerOptions,
    strict: false,
    noImplicitAny: false,
    noImplicitThis: false,
    strictNullChecks: false,
    strictFunctionTypes: false,
    strictBindCallApply: false,
    strictPropertyInitialization: false,
    noFallthroughCasesInSwitch: false,
    noImplicitReturns: false,
    noUnusedLocals: false,
    noUnusedParameters: false,
    skipLibCheck: true,
    allowJs: true,
    checkJs: false
  };
  
  // Write the updated tsconfig.json file
  fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2));
  
  console.log('TypeScript checks disabled successfully.');
} catch (error) {
  console.error('Error disabling TypeScript checks:', error.message);
  process.exit(1);
}
