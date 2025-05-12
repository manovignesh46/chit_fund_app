// Script to check if the application is running properly
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Checking application status...');

// 1. Check if the Prisma client is properly configured
console.log('\n=== Checking Prisma Client ===\n');
try {
  const prismaClientPath = path.join(process.cwd(), 'lib', 'prisma.ts');
  const prismaClient = fs.readFileSync(prismaClientPath, 'utf8');

  // Check for syntax errors
  if (prismaClient.includes('};};')) {
    console.error('Syntax error in Prisma client: Extra closing brace');

    // Fix the syntax error
    const fixedPrismaClient = prismaClient.replace('};};', '};');
    fs.writeFileSync(prismaClientPath, fixedPrismaClient);
    console.log('Fixed syntax error in Prisma client');
  } else {
    console.log('Prisma client syntax looks good');
  }
} catch (error) {
  console.error('Error checking Prisma client:', error.message);
}

// 2. Check if the database is accessible
console.log('\n=== Checking Database Connection ===\n');
try {
  execSync('node scripts/test-connection.js', { stdio: 'inherit' });
} catch (error) {
  console.error('Error checking database connection:', error.message);
}

// 3. Check if the API routes are properly configured
console.log('\n=== Checking API Routes ===\n');
try {
  // Check dashboard API route
  const dashboardApiPath = path.join(process.cwd(), 'app', 'api', 'dashboard', 'route.ts');
  if (fs.existsSync(dashboardApiPath)) {
    console.log('Dashboard API route exists');
  } else {
    console.error('Dashboard API route not found');
  }

  // Check health API route
  const healthApiPath = path.join(process.cwd(), 'app', 'api', 'health', 'route.ts');
  if (fs.existsSync(healthApiPath)) {
    console.log('Health API route exists');
  } else {
    console.error('Health API route not found');
  }
} catch (error) {
  console.error('Error checking API routes:', error.message);
}

// 4. Check if the optimization scripts are available
console.log('\n=== Checking Optimization Scripts ===\n');
try {
  const scripts = [
    'optimize-connection.js',
    'optimize-db.js',
    'optimize-api.js',
    'optimize-app.js',
    'analyze-performance.js',
  ];

  for (const script of scripts) {
    const scriptPath = path.join(process.cwd(), 'scripts', script);
    if (fs.existsSync(scriptPath)) {
      console.log(`${script} exists`);
    } else {
      console.error(`${script} not found`);
    }
  }
} catch (error) {
  console.error('Error checking optimization scripts:', error.message);
}

console.log('\n=== Application Check Complete ===\n');
console.log('If all checks passed, the application should be running properly.');
console.log('If there were any errors, please fix them and restart the server:');
console.log('npm run dev');
console.log('\nFor more information on optimizing performance, see PERFORMANCE.md');
