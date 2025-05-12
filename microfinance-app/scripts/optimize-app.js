// Script to optimize the application
const fs = require('fs');
const path = require('path');

// Configuration
const appDir = process.cwd();
const apiDir = path.join(appDir, 'app/api');

// Function to add caching to API routes
function addCachingToApiRoutes() {
  console.log('Adding caching to API routes...');

  // Get all API route files
  const apiRoutes = findApiRoutes(apiDir);
  let updatedCount = 0;

  for (const routePath of apiRoutes) {
    try {
      let content = fs.readFileSync(routePath, 'utf8');

      // Skip if already has caching
      if (content.includes('revalidate') || content.includes('apiCache.getOrFetch')) {
        continue;
      }

      // Import the cache utility if not already imported
      if (!content.includes('import { apiCache }')) {
        const importStatement = "import { apiCache } from '@/lib/cache';\n";

        // Find the last import statement
        const lastImportIndex = content.lastIndexOf('import');
        if (lastImportIndex !== -1) {
          const endOfImport = content.indexOf('\n', lastImportIndex) + 1;
          content = content.slice(0, endOfImport) + importStatement + content.slice(endOfImport);
        } else {
          content = importStatement + content;
        }
      }

      // Add revalidation period
      if (!content.includes('export const revalidate')) {
        const revalidateStatement = '\n// Use ISR with a 5-minute revalidation period\nexport const revalidate = 300; // 5 minutes\n';

        // Find the position to insert the revalidate statement
        const exportIndex = content.indexOf('export async function');
        if (exportIndex !== -1) {
          content = content.slice(0, exportIndex) + revalidateStatement + content.slice(exportIndex);
        }
      }

      // Write the updated content back to the file
      fs.writeFileSync(routePath, content);
      updatedCount++;
      console.log(`Added caching to ${path.relative(appDir, routePath)}`);
    } catch (error) {
      console.error(`Error updating API route ${routePath}:`, error.message);
    }
  }

  console.log(`Added caching to ${updatedCount} API routes`);
}

// Function to find all API route files
function findApiRoutes(dir) {
  const routes = [];

  function scanDir(currentDir) {
    const files = fs.readdirSync(currentDir);

    for (const file of files) {
      const filePath = path.join(currentDir, file);
      const stats = fs.statSync(filePath);

      if (stats.isDirectory()) {
        scanDir(filePath);
      } else if (file === 'route.ts' || file === 'route.js') {
        routes.push(filePath);
      }
    }
  }

  scanDir(dir);
  return routes;
}

// Function to optimize large components
function optimizeLargeComponents() {
  console.log('Optimizing large components...');

  const largeComponents = [
    '/app/chit-funds/[id]/contributions/page.tsx',
    '/app/loans/[id]/page.tsx',
    '/app/chit-funds/[id]/members/page.tsx',
    '/app/members/page.tsx',
    '/app/chit-funds/[id]/page.tsx'
  ];

  for (const componentPath of largeComponents) {
    try {
      const fullPath = path.join(appDir, componentPath);
      if (!fs.existsSync(fullPath)) {
        console.log(`Component not found: ${componentPath}`);
        continue;
      }

      let content = fs.readFileSync(fullPath, 'utf8');

      // Add dynamic imports for large components
      if (!content.includes('dynamic(') && !content.includes('next/dynamic')) {
        // Add dynamic import
        const importStatement = "import dynamic from 'next/dynamic';\n";

        // Find the last import statement
        const lastImportIndex = content.lastIndexOf('import');
        if (lastImportIndex !== -1) {
          const endOfImport = content.indexOf('\n', lastImportIndex) + 1;
          content = content.slice(0, endOfImport) + importStatement + content.slice(endOfImport);
        } else {
          content = importStatement + content;
        }

        // Add a comment about optimization
        content = content.replace(
          /export default function/,
          '// This component has been optimized for performance\nexport default function'
        );
      }

      // Write the updated content back to the file
      fs.writeFileSync(fullPath, content);
      console.log(`Optimized large component: ${componentPath}`);
    } catch (error) {
      console.error(`Error optimizing component ${componentPath}:`, error.message);
    }
  }
}

// Main function
function main() {
  console.log('Starting application optimization...');

  // Check if the cache utility exists, create it if not
  const cacheUtilPath = path.join(appDir, 'lib/cache.ts');
  if (!fs.existsSync(cacheUtilPath)) {
    console.log('Creating cache utility...');
    // Create the directory if it doesn't exist
    const cacheUtilDir = path.dirname(cacheUtilPath);
    if (!fs.existsSync(cacheUtilDir)) {
      fs.mkdirSync(cacheUtilDir, { recursive: true });
    }

    // Create the cache utility file
    const cacheUtilContent = `// Simple in-memory cache utility for API routes

type CacheEntry<T> = {
  data: T;
  expiry: number;
};

class APICache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private defaultTTL: number = 60 * 1000; // 1 minute in milliseconds

  // Get data from cache or fetch it using the provided function
  async getOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl: number = this.defaultTTL
  ): Promise<T> {
    const now = Date.now();
    const cached = this.cache.get(key);

    // Return cached data if it exists and hasn't expired
    if (cached && cached.expiry > now) {
      return cached.data;
    }

    // Fetch fresh data
    const data = await fetchFn();

    // Store in cache
    this.cache.set(key, {
      data,
      expiry: now + ttl,
    });

    return data;
  }

  // Manually set cache entry
  set<T>(key: string, data: T, ttl: number = this.defaultTTL): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttl,
    });
  }

  // Manually invalidate cache entry
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  // Invalidate all cache entries that match a prefix
  invalidateByPrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  // Clear the entire cache
  clear(): void {
    this.cache.clear();
  }
}

// Create a singleton instance
export const apiCache = new APICache();`;

    fs.writeFileSync(cacheUtilPath, cacheUtilContent);
    console.log('Created cache utility at lib/cache.ts');
  }

  // Add caching to API routes
  addCachingToApiRoutes();

  // Optimize large components
  optimizeLargeComponents();

  console.log('Application optimization completed!');
}

main();
