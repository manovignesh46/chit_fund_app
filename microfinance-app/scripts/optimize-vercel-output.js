// scripts/optimize-vercel-output.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Starting Vercel output optimization...');

// Check if we're running on Vercel
const isVercel = process.env.VERCEL === '1';
if (!isVercel) {
  console.log('Not running on Vercel, skipping optimization.');
  process.exit(0);
}

// Define paths
const outputDir = path.join(process.cwd(), '.next');
const serverDir = path.join(outputDir, 'server');
const cacheDir = path.join(outputDir, 'cache');

// Function to recursively remove directories
function removeDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return;
  }

  try {
    const files = fs.readdirSync(dirPath);
    
    for (const file of files) {
      const curPath = path.join(dirPath, file);
      
      if (fs.lstatSync(curPath).isDirectory()) {
        // Recursive call
        removeDirectory(curPath);
      } else {
        // Delete file
        fs.unlinkSync(curPath);
      }
    }
    
    // Delete the now-empty directory
    fs.rmdirSync(dirPath);
    console.log(`Removed directory: ${dirPath}`);
  } catch (error) {
    console.error(`Error removing directory ${dirPath}:`, error);
  }
}

// Function to remove files by pattern
function removeFilesByPattern(directory, pattern) {
  if (!fs.existsSync(directory)) {
    return;
  }

  try {
    const files = fs.readdirSync(directory);
    let removedCount = 0;
    
    for (const file of files) {
      if (file.match(pattern)) {
        const filePath = path.join(directory, file);
        
        try {
          if (fs.lstatSync(filePath).isDirectory()) {
            removeDirectory(filePath);
          } else {
            fs.unlinkSync(filePath);
          }
          removedCount++;
        } catch (error) {
          console.error(`Error removing ${filePath}:`, error);
        }
      }
    }
    
    console.log(`Removed ${removedCount} items matching ${pattern} from ${directory}`);
  } catch (error) {
    console.error(`Error processing directory ${directory}:`, error);
  }
}

// Function to recursively remove files by pattern
function recursiveRemoveFilesByPattern(directory, pattern) {
  if (!fs.existsSync(directory)) {
    return;
  }

  try {
    const files = fs.readdirSync(directory);
    let removedCount = 0;
    
    for (const file of files) {
      const filePath = path.join(directory, file);
      
      if (fs.lstatSync(filePath).isDirectory()) {
        // Recursive call
        recursiveRemoveFilesByPattern(filePath, pattern);
      } else if (file.match(pattern)) {
        // Delete file
        fs.unlinkSync(filePath);
        removedCount++;
      }
    }
    
    console.log(`Removed ${removedCount} items matching ${pattern} from ${directory} and subdirectories`);
  } catch (error) {
    console.error(`Error processing directory ${directory}:`, error);
  }
}

// Optimize the Next.js output
if (fs.existsSync(outputDir)) {
  console.log('Optimizing Next.js output directory...');
  
  // Remove cache directory
  if (fs.existsSync(cacheDir)) {
    removeDirectory(cacheDir);
  }
  
  // Remove source maps
  recursiveRemoveFilesByPattern(outputDir, /\.map$/);
  
  // Remove unnecessary files from server directory
  if (fs.existsSync(serverDir)) {
    // Remove development-only files
    removeFilesByPattern(serverDir, /\.development\./);
    
    // Remove chunks that are not used in production
    const chunksDir = path.join(serverDir, 'chunks');
    if (fs.existsSync(chunksDir)) {
      removeFilesByPattern(chunksDir, /webpack-runtime/);
      removeFilesByPattern(chunksDir, /webpack-api-runtime/);
    }
    
    // Remove unnecessary pages
    const pagesDir = path.join(serverDir, 'pages');
    if (fs.existsSync(pagesDir)) {
      removeFilesByPattern(pagesDir, /\/_error/);
      removeFilesByPattern(pagesDir, /\/_app/);
      removeFilesByPattern(pagesDir, /\/_document/);
    }
  }
  
  console.log('Next.js output optimization completed!');
} else {
  console.error(`Next.js output directory not found at ${outputDir}`);
}
