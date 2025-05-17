#!/usr/bin/env node

/**
 * Script to restore TypeScript after the build process
 * 
 * This script:
 * 1. Renames tsconfig.json.bak to tsconfig.json
 * 2. Removes jsconfig.json
 */

const fs = require('fs');
const path = require('path');

// Project root directory
const projectRoot = process.cwd();

console.log('Restoring TypeScript after the build process...');

// Rename tsconfig.json.bak to tsconfig.json
const tsconfigPath = path.join(projectRoot, 'tsconfig.json');
const tsconfigBackupPath = path.join(projectRoot, 'tsconfig.json.bak');

try {
  if (fs.existsSync(tsconfigBackupPath)) {
    fs.renameSync(tsconfigBackupPath, tsconfigPath);
    console.log('Renamed tsconfig.json.bak to tsconfig.json');
  } else {
    console.log('tsconfig.json.bak not found, skipping rename');
  }
} catch (error) {
  console.error('Error renaming tsconfig.json.bak:', error.message);
}

// Remove jsconfig.json
const jsconfigPath = path.join(projectRoot, 'jsconfig.json');

try {
  if (fs.existsSync(jsconfigPath)) {
    fs.unlinkSync(jsconfigPath);
    console.log('Removed jsconfig.json');
  } else {
    console.log('jsconfig.json not found, skipping removal');
  }
} catch (error) {
  console.error('Error removing jsconfig.json:', error.message);
}

console.log('TypeScript restoration completed successfully.');
