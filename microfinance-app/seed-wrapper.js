#!/usr/bin/env node

// This is a simple wrapper script to run the seed.ts file
// It uses ts-node/register to compile the TypeScript on-the-fly
require('ts-node/register');
require('./prisma/seed.ts');
