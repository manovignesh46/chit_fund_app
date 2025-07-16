#!/usr/bin/env node

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('Error: DATABASE_URL not set in .env');
  process.exit(1);
}

const { URL } = require('url');
const url = new URL(dbUrl);
// Extract database name for filename
const database = url.pathname.replace(/^\//, '');

// Prepare backup directory and filename
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.resolve(__dirname, '../../backups');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}
const filename = `${database}-backup-${timestamp}.sql`;
const filepath = path.join(backupDir, filename);

// Extract common connection parameters
const host = url.hostname;
const user = url.username;
const password = url.password;
// Determine protocol and set default port
let port;
let dumpCmd;
if (url.protocol.startsWith('mysql')) {
  port = url.port || '3306';
  // Build mysqldump command
  dumpCmd = `mysqldump -h ${host} -P ${port} -u ${user} ` +
            (password ? `-p${password} ` : '') +
            `${database} > "${filepath}"`;
} else if (url.protocol.startsWith('postgres')) {
  port = url.port || '5432';
  // Use Dockerized pg_dump (postgres:17) to match server version
  dumpCmd = `docker run --rm -e PGPASSWORD='${password}' postgres:17 pg_dump -h ${host} -p ${port} -U ${user} -d ${database} -F p` +
            ` > "${filepath}"`;
} else {
  console.error(`Unsupported protocol: ${url.protocol}`);
  process.exit(1);
}

console.log('Starting database backup...');
exec(dumpCmd, (error, stdout, stderr) => {
  if (error) {
    console.error('Backup failed:', stderr || error);
    process.exit(1);
  }
  console.log(`Backup successful: ${filepath}`);
});
