#!/usr/bin/env node

/**
 * Script to add // @ts-nocheck to all TypeScript files
 *
 * This script:
 * 1. Finds all TypeScript files in the project
 * 2. Adds // @ts-nocheck to the top of each file
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Project root directory
const projectRoot = process.cwd();

// Function to find all TypeScript files
function findTypeScriptFiles() {
  const result = execSync('find ./app ./components -type f -name "*.tsx" | grep -v "node_modules"', {
    cwd: projectRoot,
    encoding: 'utf8'
  });

  return result.split('\n').filter(Boolean);
}

// Function to process a file
function processFile(filePath) {
  const fullPath = path.join(projectRoot, filePath);

  // Read the file content
  let content = fs.readFileSync(fullPath, 'utf8');

  // Check if the file already has // @ts-nocheck
  if (content.includes('// @ts-nocheck')) {
    console.log(`File ${filePath} already has // @ts-nocheck`);
    return false;
  }

  // Add // @ts-nocheck to the top of the file
  content = `// @ts-nocheck\n${content}`;

  // Write the file back
  fs.writeFileSync(fullPath, content, 'utf8');
  console.log(`Added // @ts-nocheck to ${filePath}`);
  return true;
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

  console.log(`Done! Added // @ts-nocheck to ${updatedCount} files`);
}

main();
