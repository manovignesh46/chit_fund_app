# Database Export Feature Documentation

## Overview
The database export feature allows users to create a complete backup of all database tables directly from the transactions page. When clicked, it generates a SQL dump file, compresses it into a ZIP archive, and downloads it to the user's device.

## How It Works

### Frontend (Transaction Page)
- A purple "Export DB" button is located alongside the existing Export and Email buttons
- When clicked, it triggers the `handleDatabaseExport` function
- Shows loading state ("Exporting...") while the backup is being created
- Downloads the ZIP file automatically when ready
- Shows success/error messages via alerts

### Backend API (`/api/db-backup`)
The API endpoint handles the complete backup process:

1. **Database Connection**: Reads the `DATABASE_URL` from environment variables
2. **Backup Creation**: 
   - For PostgreSQL: Uses `pg_dump` (local) or Docker container as fallback
   - For MySQL: Uses `mysqldump`
3. **File Processing**:
   - Creates a temporary SQL dump file
   - Compresses it into a ZIP archive using the `archiver` library
   - Cleans up temporary files after processing
4. **Download**: Returns the ZIP file as a downloadable response

### File Naming Convention
Files are named with timestamps to avoid conflicts:
- SQL dump: `{database-name}-backup-{timestamp}.sql`
- ZIP file: `{database-name}-backup-{timestamp}.zip`

Example: `microfinance-backup-2025-09-30T14-23-45-123Z.zip`

## Dependencies
- `archiver` - For creating ZIP files (already installed)
- `pg_dump` or Docker with PostgreSQL image - For PostgreSQL backups
- `mysqldump` - For MySQL backups

## Error Handling
- Checks for database URL configuration
- Validates database type support
- Handles backup command failures with fallback methods
- Cleans up temporary files on errors
- Provides detailed error messages for troubleshooting

## Security Considerations
- Database credentials are passed securely through environment variables
- Temporary files are cleaned up after processing
- Old temporary files (>1 hour) are automatically cleaned up
- Access is controlled through the existing authentication system

## File Structure
```
microfinance-app/
├── app/
│   ├── api/
│   │   └── db-backup/
│   │       └── route.ts          # API endpoint
│   └── transactions/
│       └── page.tsx              # Updated with Export DB button
├── temp/                         # Temporary directory (auto-created)
└── test-db-backup.js            # Test script
```

## Usage
1. Navigate to the Transactions page
2. Click the "Export DB" button (purple button with download icon)
3. Wait for the backup to complete (button shows "Exporting...")
4. The ZIP file will automatically download to your default download folder
5. Extract the ZIP to access the SQL dump file

## Troubleshooting

### Common Issues
1. **"Database URL not configured"**: Ensure `DATABASE_URL` is set in `.env`
2. **"pg_dump command not found"**: Install PostgreSQL client tools or ensure Docker is available
3. **"Permission denied"**: Check database user permissions
4. **Large database timeouts**: Consider increasing server timeouts for very large databases

### Manual Backup Alternative
If the web interface fails, you can still use the original script:
```bash
cd scripts/
node db-backup.js
```

## Future Enhancements
- Progress indicator for large databases
- Selective table backup options
- Backup scheduling functionality
- Integration with cloud storage services
- Toast notifications instead of alerts