// scripts/cleanup-prisma.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Starting Prisma cleanup for deployment...');

// Define paths
const prismaClientPath = path.join(process.cwd(), 'node_modules', '.prisma', 'client');
const prismaEnginesPath = path.join(process.cwd(), 'node_modules', '@prisma', 'engines');

// Check if we're running on Vercel
const isVercel = process.env.VERCEL === '1';
if (isVercel) {
  console.log('Detected Vercel environment. Cleaning up Prisma engines...');
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

console.log('Prisma cleanup completed!');
