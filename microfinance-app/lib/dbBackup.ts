import { exec } from 'child_process';
import { createWriteStream, unlink } from 'fs';
import { pipeline } from 'stream';
import { promisify } from 'util';
import archiver from 'archiver';
import path from 'path';
import { URL } from 'url';

const pipelineAsync = promisify(pipeline);

export interface DbBackupResult {
  zipPath: string;
  fileName: string;
}

function parseMySQLUrl(urlStr: string) {
  try {
    const url = new URL(urlStr);
    if (url.protocol !== 'mysql:') throw new Error('Invalid protocol');

    return {
      host: url.hostname,
      port: url.port || '3306',
      database: url.pathname.replace('/', ''),
      user: url.username,
      password: url.password,
    };
  } catch (err) {
    throw new Error('Invalid DATABASE_URL format');
  }
}

/**
 * Dumps the MySQL database and compresses it as a .zip file.
 * Returns the path to the zip file and the file name.
 */
export async function createCompressedMySQLDump(): Promise<DbBackupResult> {
  const { DATABASE_URL } = process.env;
  if (!DATABASE_URL) throw new Error('DATABASE_URL is not set in .env');

  const { host, port, database, user, password } = parseMySQLUrl(DATABASE_URL);

  const timestamp = Date.now();
  const dumpFile = `/tmp/db-backup-${timestamp}.sql`;
  const zipFile = `/tmp/db-backup-${timestamp}.zip`;
  const fileName = `db-backup-${new Date().toISOString().slice(0, 7)}.sql.zip`;

  const cmd = `mysqldump -h${host} -P${port} -u${user} -p${password} ${database} > ${dumpFile}`;

  console.log("cmd -->", cmd)

  await new Promise((resolve, reject) => {
    exec(cmd, (err) => {
      if (err) reject(err);
      else resolve(null);
    });
  });

  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(zipFile);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    archive.file(dumpFile, { name: path.basename(dumpFile) });
    archive.finalize();
  });

  unlink(dumpFile, () => {});

  return { zipPath: zipFile, fileName };
}
