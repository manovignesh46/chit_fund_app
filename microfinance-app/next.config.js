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
      allowedOrigins: ['localhost:3000', 'localhost:3003', '47e5-2401-4900-608c-31f0-208f-2cde-9a71-a9db.ngrok-free.app'],
    },
  },
  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Prevent clickjacking attacks
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          // Prevent MIME type sniffing
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // Enable XSS protection
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          // Referrer policy - only send origin for same-origin requests
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // Permissions policy - disable unnecessary browser features
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          // Strict Transport Security (HTTPS only)
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          // Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Next.js requires unsafe-eval and unsafe-inline
              "style-src 'self' 'unsafe-inline'", // Allow inline styles for React
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              "connect-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
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
module.exports = withBundleAnalyzer(nextConfig);