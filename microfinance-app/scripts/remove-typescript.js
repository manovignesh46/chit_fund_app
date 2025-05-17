#!/usr/bin/env node

/**
 * Script to completely remove TypeScript from the build process
 * 
 * This script:
 * 1. Renames all .tsx files to .jsx
 * 2. Renames all .ts files to .js
 * 3. Removes TypeScript-specific code from the files
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Project root directory
const projectRoot = process.cwd();

console.log('Removing TypeScript from the build process...');

// Function to find all TypeScript files
function findTypeScriptFiles() {
  try {
    const tsxFiles = execSync('find . -type f -name "*.tsx" | grep -v "node_modules"', {
      cwd: projectRoot,
      encoding: 'utf8'
    }).split('\n').filter(Boolean);
    
    const tsFiles = execSync('find . -type f -name "*.ts" | grep -v "node_modules" | grep -v "d.ts"', {
      cwd: projectRoot,
      encoding: 'utf8'
    }).split('\n').filter(Boolean);
    
    return { tsxFiles, tsFiles };
  } catch (error) {
    console.error('Error finding TypeScript files:', error.message);
    return { tsxFiles: [], tsFiles: [] };
  }
}

// Function to process a file
function processFile(filePath, isJsx) {
  const fullPath = path.join(projectRoot, filePath);
  
  try {
    // Read the file content
    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Remove TypeScript-specific code
    content = content
      // Remove type annotations
      .replace(/:\s*[A-Za-z0-9_<>[\]{}|&()'",\s.]+(?=[,)=;])/g, '')
      // Remove interface declarations
      .replace(/interface\s+[A-Za-z0-9_]+\s*\{[^}]*\}/g, '')
      // Remove type declarations
      .replace(/type\s+[A-Za-z0-9_]+\s*=\s*[^;]+;/g, '')
      // Remove generic type parameters
      .replace(/<[A-Za-z0-9_<>[\]{}|&()'",\s.]+>/g, '')
      // Remove import type statements
      .replace(/import\s+type\s+[^;]+;/g, '')
      // Remove export type statements
      .replace(/export\s+type\s+[^;]+;/g, '')
      // Remove as Type casting
      .replace(/\s+as\s+[A-Za-z0-9_<>[\]{}|&()'",\s.]+/g, '');
    
    // Write the content to a new file with .jsx or .js extension
    const newPath = isJsx ? fullPath.replace('.tsx', '.jsx') : fullPath.replace('.ts', '.js');
    fs.writeFileSync(newPath, content, 'utf8');
    
    // Remove the original file
    fs.unlinkSync(fullPath);
    
    console.log(`Processed ${filePath} -> ${isJsx ? path.basename(newPath) : path.basename(newPath)}`);
    return true;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return false;
  }
}

// Main function
function main() {
  console.log('Finding TypeScript files...');
  const { tsxFiles, tsFiles } = findTypeScriptFiles();
  console.log(`Found ${tsxFiles.length} .tsx files and ${tsFiles.length} .ts files`);
  
  let processedCount = 0;
  
  console.log('Processing .tsx files...');
  for (const file of tsxFiles) {
    try {
      const processed = processFile(file, true);
      if (processed) {
        processedCount++;
      }
    } catch (error) {
      console.error(`Error processing ${file}:`, error.message);
    }
  }
  
  console.log('Processing .ts files...');
  for (const file of tsFiles) {
    try {
      const processed = processFile(file, false);
      if (processed) {
        processedCount++;
      }
    } catch (error) {
      console.error(`Error processing ${file}:`, error.message);
    }
  }
  
  console.log(`Done! Processed ${processedCount} files`);
  
  // Remove tsconfig.json
  try {
    fs.unlinkSync(path.join(projectRoot, 'tsconfig.json'));
    console.log('Removed tsconfig.json');
  } catch (error) {
    console.error('Error removing tsconfig.json:', error.message);
  }
}

// Only run this script if explicitly requested
if (process.env.REMOVE_TYPESCRIPT === '1') {
  main();
} else {
  console.log('Skipping TypeScript removal (REMOVE_TYPESCRIPT environment variable not set to 1)');
}
