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

// Prepare backup directory and filename
timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.resolve(__dirname, '../../backups');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}
const filename = `prisma-backup-${timestamp}.sql`;
const filepath = path.join(backupDir, filename);

let dumpCmd;
if (url.protocol.startsWith('mysql')) {
  const host = url.hostname;
  const port = url.port || '3306';
  const user = url.username;
  const password = url.password;
  const database = url.pathname.substring(1);
  dumpCmd = `mysqldump -h ${host} -P ${port} -u ${user} ` +
            (password ? `-p${password} ` : '') +
            `${database} > "${filepath}"`;
} else if (url.protocol.startsWith('postgres')) {
  const host = url.hostname;
  const port = url.port || '5432';
  const user = url.username;
  const password = url.password;
  const database = url.pathname.substring(1);
  // Use PGPASSWORD env for pg_dump
  dumpCmd = `PGPASSWORD='${password}' pg_dump -h ${host} -p ${port} -U ${user} -d ${database} -F p > "${filepath}"`;
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
