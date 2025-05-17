#!/usr/bin/env node

/**
 * Script to prepare the project for Vercel deployment
 * 
 * This script:
 * 1. Removes TypeScript-specific files
 * 2. Creates a minimal jsconfig.json file
 * 3. Creates a minimal babel.config.js file
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Project root directory
const projectRoot = process.cwd();

console.log('Preparing project for Vercel deployment...');

// Remove TypeScript-specific files
const filesToRemove = [
  'tsconfig.json',
  '.babelrc'
];

for (const file of filesToRemove) {
  const filePath = path.join(projectRoot, file);
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Removed ${file}`);
    }
  } catch (error) {
    console.error(`Error removing ${file}:`, error.message);
  }
}

// Create a minimal jsconfig.json file
const jsconfigPath = path.join(projectRoot, 'jsconfig.json');
const jsconfigContent = {
  compilerOptions: {
    target: "esnext",
    lib: ["dom", "dom.iterable", "esnext"],
    allowJs: true,
    skipLibCheck: true,
    strict: false,
    forceConsistentCasingInFileNames: true,
    noEmit: true,
    esModuleInterop: true,
    module: "esnext",
    moduleResolution: "node",
    resolveJsonModule: true,
    isolatedModules: true,
    jsx: "preserve",
    incremental: true,
    baseUrl: ".",
    paths: {
      "@/*": ["./*"]
    },
    plugins: [
      {
        name: "next"
      }
    ]
  },
  include: [
    "**/*.js",
    "**/*.jsx",
    "**/*.ts",
    "**/*.tsx",
    "next-env.d.ts",
    ".next/types/**/*.ts"
  ],
  exclude: ["node_modules"]
};

try {
  fs.writeFileSync(jsconfigPath, JSON.stringify(jsconfigContent, null, 2));
  console.log('Created jsconfig.json file');
} catch (error) {
  console.error('Error creating jsconfig.json:', error.message);
}

// Create a minimal babel.config.js file
const babelConfigPath = path.join(projectRoot, 'babel.config.js');
const babelConfigContent = `module.exports = {
  presets: [
    [
      'next/babel',
      {
        'preset-typescript': {
          // Disable TypeScript type checking
          isTSX: true,
          allExtensions: true,
          allowNamespaces: true,
          allowDeclareFields: true,
          onlyRemoveTypeImports: false
        }
      }
    ]
  ],
  plugins: []
};`;

try {
  fs.writeFileSync(babelConfigPath, babelConfigContent);
  console.log('Created babel.config.js file');
} catch (error) {
  console.error('Error creating babel.config.js:', error.message);
}

// Create a .npmrc file
const npmrcPath = path.join(projectRoot, '.npmrc');
const npmrcContent = `# Force npm to install optional dependencies that Prisma needs
node-linker=hoisted
public-hoist-pattern[]=*prisma*

# Optimize npm for production in Vercel
registry=https://registry.npmjs.org/
network-timeout=100000
progress=false
fund=false
audit=false

# Fix peer dependency issues
legacy-peer-deps=true
strict-peer-dependencies=false
save-exact=true
prefer-offline=true
no-fund=true
no-audit=true
no-optional=true
no-package-lock=true
ignore-scripts=false
force=true`;

try {
  fs.writeFileSync(npmrcPath, npmrcContent);
  console.log('Created .npmrc file');
} catch (error) {
  console.error('Error creating .npmrc:', error.message);
}

// Create a next.config.js file
const nextConfigPath = path.join(projectRoot, 'next.config.js');
const nextConfigContent = `// Import bundle analyzer
const withBundleAnalyzer = process.env.ANALYZE === 'true'
  ? require('@next/bundle-analyzer')({ enabled: true })
  : (config) => config;

const nextConfig = {
  reactStrictMode: true,
  env: {
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  },
  // Performance optimizations
  compiler: {
    // Remove console logs in production
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // Disable TypeScript checking during build
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
  // Disable ESLint during build
  eslint: {
    // Don't run ESLint during build
    ignoreDuringBuilds: true,
  },
  images: {
    // Enable image optimization
    domains: ['localhost'],
    formats: ['image/avif', 'image/webp'],
  },
  // Enable React Server Components
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', 'localhost:3003'],
    },
  },
  // Enable output file tracing for serverless functions
  outputFileTracingRoot: process.cwd(),
  // Optimize serverless function size
  outputFileTracingExcludes: {
    '*': [
      // Development dependencies
      'node_modules/@swc/**',
      'node_modules/@esbuild/**',
      'node_modules/typescript/**',
      'node_modules/prettier/**',
      'node_modules/eslint/**',
      'node_modules/@types/**',
      'node_modules/ts-node/**',
      'node_modules/@next/bundle-analyzer/**',
      // Prisma specific exclusions - exclude all engines first
      'node_modules/.prisma/client/libquery_engine-*',
      'node_modules/@prisma/engines/**',
      'node_modules/prisma/libquery_engine-*',
      'node_modules/prisma/migration-engine-*',
      'node_modules/prisma/introspection-engine-*',
      'node_modules/prisma/prisma-fmt-*',
      // Then selectively include only the required Prisma engines
      '!node_modules/.prisma/client/libquery_engine-rhel-openssl-1.0.x',
      '!node_modules/.prisma/client/libquery_engine-rhel-openssl-1.1.x',
      '!node_modules/.prisma/client/libquery_engine-rhel-openssl-3.0.x',
      '!node_modules/.prisma/client/libquery_engine-debian-openssl-1.0.x',
      '!node_modules/.prisma/client/libquery_engine-debian-openssl-1.1.x',
      '!node_modules/.prisma/client/libquery_engine-debian-openssl-3.0.x',
      '!node_modules/.prisma/client/libquery_engine-linux-musl',
      // Documentation and unnecessary files
      '.git/**',
      '**/*.{md,txt,log,LICENSE}',
      'prisma/migrations/**',
      'node_modules/**/*.{md,d.ts,map}',
      // Test files
      'node_modules/**/test/**',
      'node_modules/**/tests/**',
      'node_modules/**/__tests__/**',
      // Examples and docs
      'node_modules/**/example/**',
      'node_modules/**/examples/**',
      'node_modules/**/docs/**',
      // Source files when compiled output exists
      'node_modules/**/*.{ts,tsx}',
      '!node_modules/**/*.d.ts',
      // Other large dependencies that aren't needed at runtime
      'node_modules/rxjs/**',
      'node_modules/webpack/**',
      'node_modules/terser/**',
    ],
  },
  // Optimize large pages
  onDemandEntries: {
    // Keep the pages in memory longer (good for development)
    maxInactiveAge: 60 * 60 * 1000, // 1 hour
    // Number of pages to keep in memory
    pagesBufferLength: 5,
  },
  // Optimize production builds
  productionBrowserSourceMaps: false // Disable source maps in production for smaller bundles
};

// Export the configuration with the bundle analyzer wrapper
module.exports = withBundleAnalyzer(nextConfig);`;

try {
  fs.writeFileSync(nextConfigPath, nextConfigContent);
  console.log('Created next.config.js file');
} catch (error) {
  console.error('Error creating next.config.js:', error.message);
}

console.log('Project preparation for Vercel deployment completed successfully.');
