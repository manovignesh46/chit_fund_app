#!/usr/bin/env node

/**
 * Script to add JSX namespace to TypeScript files
 *
 * This script:
 * 1. Finds all TypeScript files in the project
 * 2. For each file, adds JSX namespace if it contains JSX elements
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Project root directory
const projectRoot = process.cwd();

// Function to find all TypeScript files
function findTypeScriptFiles() {
  try {
    const result = execSync('find . -type f -name "*.tsx" | grep -v "node_modules"', {
      cwd: projectRoot,
      encoding: 'utf8'
    });

    return result.split('\n').filter(Boolean);
  } catch (error) {
    console.error('Error finding TypeScript files:', error.message);
    return [];
  }
}

// Function to process a file
function processFile(filePath) {
  const fullPath = path.join(projectRoot, filePath);

  try {
    // Read the file content
    let content = fs.readFileSync(fullPath, 'utf8');

    // Check if the file contains JSX elements
    if (content.includes('<div') || content.includes('<span') || content.includes('<button')) {
      // Original content for comparison
      const originalContent = content;

      // Add JSX namespace if it doesn't already exist
      if (!content.includes('declare namespace JSX')) {
        // Create a separate file for JSX namespace
        const jsxNamespaceFile = path.join(projectRoot, 'jsx-namespace.d.ts');
        if (!fs.existsSync(jsxNamespaceFile)) {
          const jsxNamespaceContent = `
// Add JSX namespace for TypeScript
declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}
`;
          fs.writeFileSync(jsxNamespaceFile, jsxNamespaceContent);
          console.log('Created jsx-namespace.d.ts file');

          // Update tsconfig.json to include the JSX namespace file
          const tsconfigPath = path.join(projectRoot, 'tsconfig.json');
          if (fs.existsSync(tsconfigPath)) {
            const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
            if (!tsconfig.include.includes('jsx-namespace.d.ts')) {
              tsconfig.include.push('jsx-namespace.d.ts');
              fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2));
              console.log('Updated tsconfig.json to include jsx-namespace.d.ts');
            }
          }
        }
      }

      // Return true to indicate that we processed this file
      console.log(`Processed ${filePath}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return false;
  }
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

  console.log(`Done! Added JSX namespace to ${updatedCount} files`);
}

main();
