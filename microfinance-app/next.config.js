// Import bundle analyzer
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
      'node_modules/@swc/core-linux-x64-gnu',
      'node_modules/@swc/core-linux-x64-musl',
      'node_modules/@esbuild/linux-x64',
      'node_modules/typescript',
      'node_modules/prettier',
      'node_modules/eslint',
      'node_modules/@types/**',
      'node_modules/ts-node/**',
      // Prisma specific exclusions
      'node_modules/.prisma/client/libquery_engine-*',
      'node_modules/@prisma/engines/**',
      'node_modules/prisma/libquery_engine-*',
      'node_modules/prisma/migration-engine-*',
      'node_modules/prisma/introspection-engine-*',
      'node_modules/prisma/prisma-fmt-*',
      // Keep only the required Prisma engines
      '!node_modules/.prisma/client/libquery_engine-rhel-*',
      '!node_modules/.prisma/client/libquery_engine-debian-*',
      '!node_modules/.prisma/client/libquery_engine-linux-*',
      // Other exclusions
      '.git/**',
      '**/*.{md,txt,log,LICENSE}',
      'prisma/migrations/**',
      'node_modules/**/*.{md,d.ts,map}',
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
module.exports = withBundleAnalyzer(nextConfig);