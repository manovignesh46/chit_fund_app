#!/usr/bin/env node

/**
 * Script to fix React imports to use TypeScript types
 * 
 * This script:
 * 1. Finds all TypeScript files in the project
 * 2. For each file, ensures React is imported correctly
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Project root directory
const projectRoot = process.cwd();

// Function to find all TypeScript files
function findTypeScriptFiles() {
  const result = execSync('find . -type f -name "*.ts" -o -name "*.tsx" | grep -v "node_modules"', {
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
  
  // Original content for comparison
  const originalContent = content;
  
  // Fix import { useEffect, useState } from '@types/react';
  content = content.replace(/import\s+\{\s*([^}]+)\s*\}\s+from\s+['"]react['"]/g, (match, imports) => {
    // Check if React is already imported
    if (content.includes("import React")) {
      // If React is already imported, don't change anything
      return match;
    } else {
      // If React is not imported, add it
      return `import React, { ${imports} } from '@types/react'`;
    }
  });
  
  // If content has changed, write it back to the file
  if (content !== originalContent) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`Updated React imports in ${filePath}`);
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
  
  console.log(`Done! Updated React imports in ${updatedCount} files`);
}

main();
