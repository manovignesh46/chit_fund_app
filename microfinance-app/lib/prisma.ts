import { PrismaClient } from '@prisma/client';

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
// Learn more: https://pris.ly/d/help/next-js-best-practices

// Add prisma to the NodeJS global type
interface CustomNodeJsGlobal {
  prisma: PrismaClient;
}

// Prevent multiple instances of Prisma Client in development
declare const global: CustomNodeJsGlobal & typeof globalThis;

// Initialize Prisma Client with connection pooling for better performance in serverless environments
const prisma = global.prisma || new PrismaClient({
  log: ['error', 'warn'],
  // Add connection pooling configuration
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// Set the Prisma Client instance on the global object
if (process.env.NODE_ENV !== 'production') global.prisma = prisma;

export default prisma;
