import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import archiver from 'archiver';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Helper function to check if a command exists
async function commandExists(command: string): Promise<boolean> {
  try {
    await execAsync(`which ${command}`);
    return true;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get database URL from environment
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return NextResponse.json(
        { error: 'Database URL not configured' },
        { status: 500 }
      );
    }

    // Parse database URL
    const url = new URL(dbUrl);
    const database = url.pathname.replace(/^\//, '');
    const host = url.hostname;
    const user = url.username;
    const password = url.password;
    
    // Create timestamp for filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${database}-backup-${timestamp}.sql`;
    
    // Create temporary directory for backup
    const tempDir = path.join(process.cwd(), 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    
    const filepath = path.join(tempDir, filename);
    
    // Determine database type and create backup command
    let dumpCmd: string;
    let backupMethod: string;

    if (url.protocol.startsWith('postgres')) {
      const port = url.port || '5432';
      
      // Check if pg_dump is available locally
      const hasPgDump = await commandExists('pg_dump');
      
      if (hasPgDump) {
        // Use local pg_dump
        dumpCmd = `PGPASSWORD='${password}' pg_dump -h ${host} -p ${port} -U ${user} -d ${database} -f "${filepath}"`;
        backupMethod = 'local pg_dump';
      } else {
        // Use Docker with PostgreSQL
        dumpCmd = `docker run --rm -e PGPASSWORD='${password}' postgres:17 pg_dump -h ${host} -p ${port} -U ${user} -d ${database} -F p > "${filepath}"`;
        backupMethod = 'Docker pg_dump';
      }
    } else if (url.protocol.startsWith('mysql')) {
      const port = url.port || '3306';
      dumpCmd = `mysqldump -h ${host} -P ${port} -u ${user} ${password ? `-p${password}` : ''} ${database} > "${filepath}"`;
      backupMethod = 'mysqldump';
    } else {
      return NextResponse.json(
        { error: 'Unsupported database type' },
        { status: 400 }
      );
    }

    // Execute backup command
    console.log(`Starting database backup using ${backupMethod}...`);
    try {
      await execAsync(dumpCmd);
      console.log(`Database backup completed using ${backupMethod}`);
    } catch (error) {
      console.error(`Database backup failed with ${backupMethod}:`, error);
      
      // For PostgreSQL, try Docker approach as fallback if local pg_dump failed
      if (url.protocol.startsWith('postgres') && backupMethod === 'local pg_dump') {
        console.log('Trying Docker fallback...');
        const port = url.port || '5432';
        const dockerCmd = `docker run --rm -e PGPASSWORD='${password}' postgres:17 pg_dump -h ${host} -p ${port} -U ${user} -d ${database} -F p > "${filepath}"`;
        try {
          await execAsync(dockerCmd);
          console.log('Database backup completed using Docker fallback');
        } catch (dockerError) {
          throw new Error(`Both local pg_dump and Docker backup methods failed. Local error: ${error instanceof Error ? error.message : 'Unknown'}. Docker error: ${dockerError instanceof Error ? dockerError.message : 'Unknown'}`);
        }
      } else {
        throw error;
      }
    }
    
    // Check if backup file was created
    try {
      await fs.access(filepath);
    } catch (error) {
      return NextResponse.json(
        { error: 'Backup file was not created successfully' },
        { status: 500 }
      );
    }

    // Create zip file
    const zipFilename = `${database}-backup-${timestamp}.zip`;
    const zipFilepath = path.join(tempDir, zipFilename);
    
    await new Promise<void>((resolve, reject) => {
      const output = require('fs').createWriteStream(zipFilepath);
      const archive = archiver('zip', { zlib: { level: 9 } });
      
      output.on('close', () => {
        console.log(`ZIP file created: ${archive.pointer()} total bytes`);
        resolve();
      });
      
      archive.on('error', (err) => {
        reject(err);
      });
      
      archive.pipe(output);
      archive.file(filepath, { name: filename });
      archive.finalize();
    });

    // Read the zip file
    const zipBuffer = await fs.readFile(zipFilepath);
    
    // Clean up temporary files
    try {
      await fs.unlink(filepath);
      await fs.unlink(zipFilepath);
    } catch (error) {
      console.warn('Failed to clean up temporary files:', error);
    }

    // Return the zip file as download
    return new NextResponse(zipBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFilename}"`,
        'Content-Length': zipBuffer.length.toString(),
      },
    });

  } catch (error) {
    console.error('Database backup failed:', error);
    
    // Clean up any temporary files that might have been created
    try {
      const tempDir = path.join(process.cwd(), 'temp');
      const files = await fs.readdir(tempDir);
      const currentTime = Date.now();
      
      // Clean up files older than 1 hour
      for (const file of files) {
        const filePath = path.join(tempDir, file);
        const stats = await fs.stat(filePath);
        if (currentTime - stats.mtime.getTime() > 3600000) {
          await fs.unlink(filePath);
        }
      }
    } catch (cleanupError) {
      console.warn('Failed to clean up temporary files:', cleanupError);
    }
    
    return NextResponse.json(
      { 
        error: 'Database backup failed', 
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}