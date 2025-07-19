/**
 * Node.js script to run the transaction balance migration
 * Usage: node scripts/run-balance-migration.js
 */

const { spawn } = require('child_process');
const path = require('path');

async function runMigration() {
  console.log('🚀 Starting transaction balance migration...\n');

  // Use ts-node to run the TypeScript migration script
  const scriptPath = path.join(__dirname, 'migrate-transaction-balances.ts');
  
  const child = spawn('npx', ['ts-node', scriptPath], {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });

  child.on('close', (code) => {
    if (code === 0) {
      console.log('\n✅ Migration completed successfully!');
      console.log('\nNext steps:');
      console.log('1. Verify the migration results by checking your transaction data');
      console.log('2. Test creating new transactions to ensure balance calculation works');
      console.log('3. Check the transaction exports to see the new balance columns');
    } else {
      console.error(`\n❌ Migration failed with exit code ${code}`);
      process.exit(1);
    }
  });

  child.on('error', (error) => {
    console.error('Failed to start migration script:', error);
    process.exit(1);
  });
}

runMigration();
