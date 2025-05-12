// Script to analyze application performance
const fs = require('fs');
const path = require('path');

// Configuration
const appDir = process.cwd();
const clientComponentsDir = path.join(appDir, 'app');
const excludeDirs = ['node_modules', '.next', 'public', 'styles'];

// Performance metrics
const metrics = {
  totalClientComponents: 0,
  totalServerComponents: 0,
  largeComponents: [],
  heavyImports: {},
  apiRoutes: 0,
  apiRoutesWithCaching: 0,
};

// Helper function to check if a file is a React component
function isReactComponent(filePath) {
  return /\.(jsx|tsx)$/.test(filePath) &&
         !filePath.includes('.d.ts') &&
         !filePath.includes('test') &&
         !filePath.includes('__tests__');
}

// Helper function to check if a file is an API route
function isApiRoute(filePath) {
  return filePath.includes('/api/') && filePath.includes('route.ts');
}

// Helper function to check if a component has the 'use client' directive
function hasUseClientDirective(content) {
  return content.trim().startsWith("'use client'") || content.trim().startsWith('"use client"');
}

// Helper function to check if an API route has caching
function hasCaching(content) {
  return content.includes('revalidate') ||
         content.includes('cache') ||
         content.includes('apiCache');
}

// Helper function to get file size in KB
function getFileSizeInKB(filePath) {
  const stats = fs.statSync(filePath);
  return Math.round(stats.size / 1024);
}

// Helper function to analyze imports
function analyzeImports(content) {
  const importRegex = /import\s+(?:{[^}]*}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g;
  const imports = {};
  let match;

  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    if (!importPath.startsWith('.')) {
      imports[importPath] = (imports[importPath] || 0) + 1;
    }
  }

  return imports;
}

// Function to analyze a file
function analyzeFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const fileSize = getFileSizeInKB(filePath);

    if (isReactComponent(filePath)) {
      if (hasUseClientDirective(content)) {
        metrics.totalClientComponents++;
      } else {
        metrics.totalServerComponents++;
      }

      if (fileSize > 10) { // Components larger than 10KB
        metrics.largeComponents.push({
          path: filePath.replace(appDir, ''),
          size: fileSize,
        });
      }

      // Analyze imports
      const imports = analyzeImports(content);
      Object.keys(imports).forEach(importPath => {
        metrics.heavyImports[importPath] = (metrics.heavyImports[importPath] || 0) + 1;
      });
    }

    if (isApiRoute(filePath)) {
      metrics.apiRoutes++;
      if (hasCaching(content)) {
        metrics.apiRoutesWithCaching++;
      }
    }
  } catch (error) {
    console.error(`Error analyzing file ${filePath}:`, error.message);
  }
}

// Function to recursively scan directories
function scanDirectory(dir) {
  try {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);

      // Skip excluded directories
      if (excludeDirs.some(excludeDir => filePath.includes(excludeDir))) {
        continue;
      }

      const stats = fs.statSync(filePath);

      if (stats.isDirectory()) {
        scanDirectory(filePath);
      } else {
        analyzeFile(filePath);
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dir}:`, error.message);
  }
}

// Main function
function main() {
  console.log('Analyzing application performance...');

  // Scan the application directory
  scanDirectory(appDir);

  // Sort large components by size
  metrics.largeComponents.sort((a, b) => b.size - a.size);

  // Convert heavy imports to sorted array
  const sortedImports = Object.entries(metrics.heavyImports)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10); // Top 10 imports

  // Print results
  console.log('\n=== Performance Analysis Results ===\n');
  console.log(`Total Client Components: ${metrics.totalClientComponents}`);
  console.log(`Total Server Components: ${metrics.totalServerComponents}`);
  console.log(`API Routes: ${metrics.apiRoutes}`);
  console.log(`API Routes with Caching: ${metrics.apiRoutesWithCaching}`);

  console.log('\nTop 5 Largest Components:');
  metrics.largeComponents.slice(0, 5).forEach((component, index) => {
    console.log(`${index + 1}. ${component.path} (${component.size}KB)`);
  });

  console.log('\nTop 10 Most Used External Packages:');
  sortedImports.forEach(([importPath, count], index) => {
    console.log(`${index + 1}. ${importPath} (${count} imports)`);
  });

  console.log('\nRecommendations:');
  if (metrics.totalClientComponents > metrics.totalServerComponents) {
    console.log('- Consider converting more components to server components to reduce client-side JavaScript');
  }

  if (metrics.apiRoutes > metrics.apiRoutesWithCaching) {
    console.log('- Add caching to more API routes to improve performance');
  }

  if (metrics.largeComponents.length > 0) {
    console.log('- Split large components into smaller ones or use code splitting');
  }

  console.log('\nAnalysis complete!');
}

main();
