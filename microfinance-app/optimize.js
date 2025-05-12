// Main optimization script
const { execSync } = require('child_process');
const path = require('path');

console.log('Starting comprehensive optimization...');

// 1. Optimize database connection
console.log('\n=== Optimizing Database Connection ===\n');
try {
  execSync('node scripts/optimize-connection.js', { stdio: 'inherit' });
} catch (error) {
  console.error('Error optimizing database connection:', error.message);
  process.exit(1);
}

// 2. Optimize database
console.log('\n=== Optimizing Database ===\n');
try {
  execSync('node scripts/optimize-db.js', { stdio: 'inherit' });
} catch (error) {
  console.error('Error optimizing database:', error.message);
  process.exit(1);
}

// 3. Optimize API routes
console.log('\n=== Optimizing API Routes ===\n');
try {
  execSync('node scripts/optimize-api.js', { stdio: 'inherit' });
} catch (error) {
  console.error('Error optimizing API routes:', error.message);
  process.exit(1);
}

// 4. Optimize application
console.log('\n=== Optimizing Application ===\n');
try {
  execSync('node scripts/optimize-app.js', { stdio: 'inherit' });
} catch (error) {
  console.error('Error optimizing application:', error.message);
  process.exit(1);
}

// 5. Analyze performance
console.log('\n=== Analyzing Performance ===\n');
try {
  execSync('node scripts/analyze-performance.js', { stdio: 'inherit' });
} catch (error) {
  console.error('Error analyzing performance:', error.message);
  process.exit(1);
}

console.log('\n=== Optimization Complete ===\n');
console.log('The application has been optimized for better performance.');
console.log('Please restart the server to apply all optimizations:');
console.log('npm run dev');
console.log('\nFor more information on the optimizations, see PERFORMANCE.md');
