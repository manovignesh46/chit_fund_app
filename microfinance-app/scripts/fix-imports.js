#!/usr/bin/env node

/**
 * Script to replace @/ path aliases with relative paths
 * 
 * This script:
 * 1. Finds all TypeScript files in the project
 * 2. For each file, replaces @/lib and @/app imports with relative paths
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Project root directory
const projectRoot = path.resolve(__dirname, '..');

// Function to find all TypeScript files
function findTypeScriptFiles() {
  const result = execSync('find . -type f -name "*.ts" -o -name "*.tsx"', {
    cwd: projectRoot,
    encoding: 'utf8'
  });
  
  return result.split('\n').filter(Boolean);
}

// Function to calculate relative path
function calculateRelativePath(fromFile, toDir) {
  const fromDir = path.dirname(fromFile);
  const relativePath = path.relative(fromDir, toDir);
  
  // If the relative path doesn't start with '.', add './'
  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
}

// Function to process a file
function processFile(filePath) {
  const fullPath = path.join(projectRoot, filePath);
  
  // Read the file content
  let content = fs.readFileSync(fullPath, 'utf8');
  
  // Original content for comparison
  const originalContent = content;
  
  // Replace @/lib with relative path to lib
  const libDir = path.join(projectRoot, 'lib');
  const relativeLibPath = calculateRelativePath(fullPath, libDir);
  content = content.replace(/@\/lib\//g, `${relativeLibPath}/`);
  
  // Replace @/app with relative path to app
  const appDir = path.join(projectRoot, 'app');
  const relativeAppPath = calculateRelativePath(fullPath, appDir);
  content = content.replace(/@\/app\//g, `${relativeAppPath}/`);
  
  // Replace @/components with relative path to components
  const componentsDir = path.join(projectRoot, 'components');
  const relativeComponentsPath = calculateRelativePath(fullPath, componentsDir);
  content = content.replace(/@\/components\//g, `${relativeComponentsPath}/`);
  
  // If content has changed, write it back to the file
  if (content !== originalContent) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`Updated imports in ${filePath}`);
    return true;
  }
  
  return false;
}

// Main function
function main() {
  console.log('Finding TypeScript files...');
  const files = findTypeScriptFiles();
  console.log(`Found ${files.length} TypeScript files`);
  
  let updatedCount = 0;
  
  console.log('Processing files...');
  for (const file of files) {
    try {
      const updated = processFile(file);
      if (updated) {
        updatedCount++;
      }
    } catch (error) {
      console.error(`Error processing ${file}:`, error.message);
    }
  }
  
  console.log(`Done! Updated imports in ${updatedCount} files`);
}

main();
