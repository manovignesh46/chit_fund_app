// scripts/cleanup-prisma.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Starting Prisma cleanup for deployment...');

// Define paths
const nodeModulesPath = path.join(process.cwd(), 'node_modules');
const prismaClientPath = path.join(nodeModulesPath, '.prisma', 'client');
const prismaEnginesPath = path.join(nodeModulesPath, '@prisma', 'engines');

// Check if we're running on Vercel
const isVercel = process.env.VERCEL === '1';
if (isVercel) {
  console.log('Detected Vercel environment. Performing aggressive cleanup...');
}

// Function to get all engine files
function getEngineFiles(directory, pattern) {
  if (!fs.existsSync(directory)) {
    console.log(`Directory does not exist: ${directory}`);
    return [];
  }

  try {
    return fs.readdirSync(directory)
      .filter(file => file.match(pattern));
  } catch (error) {
    console.error(`Error reading directory ${directory}:`, error);
    return [];
  }
}

// Function to keep only necessary engine files
function cleanupEngines(directory, pattern, keepPatterns) {
  const files = getEngineFiles(directory, pattern);

  console.log(`Found ${files.length} engine files in ${directory}`);

  let keptCount = 0;
  let removedCount = 0;

  files.forEach(file => {
    const filePath = path.join(directory, file);

    // Check if we should keep this file
    const shouldKeep = keepPatterns.some(keepPattern => file.match(keepPattern));

    if (shouldKeep) {
      console.log(`Keeping engine file: ${file}`);
      keptCount++;
    } else {
      try {
        fs.unlinkSync(filePath);
        console.log(`Removed engine file: ${file}`);
        removedCount++;
      } catch (error) {
        console.error(`Error removing file ${filePath}:`, error);
      }
    }
  });

  console.log(`Kept ${keptCount} engine files and removed ${removedCount} engine files.`);
}

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

// Patterns for engines to keep (based on your binary targets)
const keepPatterns = [
  /rhel-openssl-1\.0\.x/,
  /rhel-openssl-1\.1\.x/,
  /rhel-openssl-3\.0\.x/,
  /debian-openssl-1\.0\.x/,
  /debian-openssl-1\.1\.x/,
  /debian-openssl-3\.0\.x/,
  /linux-musl/
];

// Clean up query engine files
if (fs.existsSync(prismaClientPath)) {
  cleanupEngines(prismaClientPath, /libquery_engine-/, keepPatterns);
}

// Clean up Prisma engines directory
if (fs.existsSync(prismaEnginesPath)) {
  // Clean up query engine
  const queryEnginePath = path.join(prismaEnginesPath, 'query-engine');
  if (fs.existsSync(queryEnginePath)) {
    cleanupEngines(queryEnginePath, /query-engine-/, keepPatterns);
  }

  // Clean up migration engine
  const migrationEnginePath = path.join(prismaEnginesPath, 'migration-engine');
  if (fs.existsSync(migrationEnginePath)) {
    cleanupEngines(migrationEnginePath, /migration-engine-/, keepPatterns);
  }

  // Clean up introspection engine
  const introspectionEnginePath = path.join(prismaEnginesPath, 'introspection-engine');
  if (fs.existsSync(introspectionEnginePath)) {
    cleanupEngines(introspectionEnginePath, /introspection-engine-/, keepPatterns);
  }

  // Clean up prisma-fmt
  const prismaFmtPath = path.join(prismaEnginesPath, 'prisma-fmt');
  if (fs.existsSync(prismaFmtPath)) {
    cleanupEngines(prismaFmtPath, /prisma-fmt-/, keepPatterns);
  }
}

// Additional aggressive cleanup for Vercel deployment
if (isVercel) {
  console.log('Performing additional cleanup to reduce function size...');

  // Remove development dependencies
  const devDependenciesToRemove = [
    '@types',
    'typescript',
    'ts-node',
    'eslint',
    'prettier',
    '@next/bundle-analyzer'
  ];

  devDependenciesToRemove.forEach(dep => {
    const depPath = path.join(nodeModulesPath, dep);
    if (fs.existsSync(depPath)) {
      removeDirectory(depPath);
    }
  });

  // Remove source maps and type definitions
  removeFilesByPattern(nodeModulesPath, /\.map$/);
  removeFilesByPattern(nodeModulesPath, /\.d\.ts$/);

  // Remove test files and directories
  removeFilesByPattern(nodeModulesPath, /test/);
  removeFilesByPattern(nodeModulesPath, /tests/);
  removeFilesByPattern(nodeModulesPath, /__tests__/);

  // Remove documentation
  removeFilesByPattern(nodeModulesPath, /\.md$/);
  removeFilesByPattern(nodeModulesPath, /docs/);

  // Remove unnecessary Prisma files
  const prismaPath = path.join(nodeModulesPath, 'prisma');
  if (fs.existsSync(prismaPath)) {
    // Keep only the essential files
    const filesToKeep = ['package.json', 'index.js', 'index.d.ts'];

    fs.readdirSync(prismaPath).forEach(file => {
      if (!filesToKeep.includes(file)) {
        const filePath = path.join(prismaPath, file);

        if (fs.lstatSync(filePath).isDirectory()) {
          removeDirectory(filePath);
        } else {
          fs.unlinkSync(filePath);
        }
      }
    });
  }
}

console.log('Prisma cleanup completed!');
