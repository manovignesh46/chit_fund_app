const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dbType = process.env.DATABASE_TYPE || 'mysql';
const envPath = path.join(__dirname, '../.env');
const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
const schemaMysql = path.join(__dirname, '../prisma/schema.mysql.prisma');
const schemaPostgres = path.join(__dirname, '../prisma/schema.postgres.prisma');

let dbUrl;
let schemaSource;

if (dbType === 'postgres') {
  dbUrl = process.env.DATABASE_URL_POSTGRES;
  schemaSource = schemaPostgres;
} else {
  dbUrl = process.env.DATABASE_URL_MYSQL;
  schemaSource = schemaMysql;
}

// Update .env DATABASE_URL
let envContent = fs.readFileSync(envPath, 'utf8');
if (envContent.match(/DATABASE_URL=.*/)) {
  envContent = envContent.replace(/DATABASE_URL=.*/g, `DATABASE_URL="${dbUrl}"`);
} else {
  envContent = `DATABASE_URL="${dbUrl}"
` + envContent;
}
fs.writeFileSync(envPath, envContent);

// Copy correct schema
fs.copyFileSync(schemaSource, schemaPath);

console.log(`Switched to ${dbType} database.`);
