# Email Recovery System Documentation

## Overview

The Email Recovery System ensures that scheduled emails (monthly and weekly financial reports) are sent even if the application server was down during the scheduled time. When the server starts up, it automatically checks for missed emails and sends recovery emails for any missed periods.

## Features

- **Automatic Detection**: Detects missed monthly and weekly emails on server startup
- **Recovery Emails**: Sends clearly marked recovery emails for missed periods
- **Email Logging**: Tracks all sent emails in the database for audit purposes
- **Configurable**: Can be enabled/disabled via environment variables
- **Manual Triggers**: Provides API endpoints for manual recovery operations
- **Error Handling**: Logs failed email attempts for troubleshooting

## Database Schema

### EmailLog Table
```sql
CREATE TABLE EmailLog (
  id INT PRIMARY KEY AUTO_INCREMENT,
  emailType VARCHAR(255) NOT NULL,     -- "monthly" or "weekly"
  period VARCHAR(255) NOT NULL,        -- "2024-01" for monthly, "2024-W01" for weekly
  sentDate DATETIME NOT NULL,
  status VARCHAR(255) DEFAULT "sent",  -- "sent", "failed", "recovered"
  recipients TEXT NOT NULL,            -- JSON array of recipient emails
  fileName VARCHAR(255),               -- Name of the attached file
  isRecovery BOOLEAN DEFAULT false,    -- True if this was a recovery email
  errorMessage TEXT,                   -- Error message if failed
  createdAt DATETIME DEFAULT NOW(),
  updatedAt DATETIME DEFAULT NOW(),
  
  UNIQUE KEY unique_email_period (emailType, period),
  INDEX idx_email_type_date (emailType, sentDate)
);
```

## Configuration

### Environment Variables

Add these to your `.env` file:

```env
# Email Recovery Configuration
EMAIL_RECOVERY_ENABLED=true
# Set to false to disable automatic recovery of missed emails on server startup
```

### Existing Email Configuration
The system uses existing email configuration:
- `AUTO_MONTHLY_EMAIL_ENABLED`
- `AUTO_MONTHLY_EMAIL_DAY`
- `AUTO_MONTHLY_EMAIL_HOUR`
- `AUTO_WEEKLY_EMAIL_ENABLED`
- `AUTO_WEEKLY_EMAIL_DAY`
- `AUTO_WEEKLY_EMAIL_HOUR`
- `DEFAULT_EMAIL_RECIPIENTS`

## How It Works

### 1. Email Logging
Every time a scheduled email is sent (or fails), it's logged in the `EmailLog` table with:
- Email type (monthly/weekly)
- Period identifier
- Send status
- Recipients
- File name
- Whether it's a recovery email

### 2. Missed Email Detection
On server startup, the system:
1. Calculates expected email send dates based on configuration
2. Queries the database for actual sent emails
3. Identifies gaps (missed emails)
4. Only considers dates in the past (with 1-hour buffer)

### 3. Recovery Process
For each missed email:
1. Generates the appropriate report for that period
2. Sends email with "[RECOVERY]" prefix
3. Uses special recovery email template
4. Logs the recovery attempt

### 4. Period Formats
- **Monthly**: `YYYY-MM` (e.g., "2024-01" for January 2024)
- **Weekly**: `YYYY-WNN` (e.g., "2024-W01" for week 1 of 2024)

## API Endpoints

### GET /api/email-recovery

Query parameters:
- `action=check-missed`: Check for missed emails
- `action=logs&limit=50&type=monthly`: Get email logs
- `action=status`: Get system status

### POST /api/email-recovery

Actions:
- `check-and-send`: Manually trigger missed email check
- `recover-monthly`: Send recovery email for specific monthly period
- `recover-weekly`: Send recovery email for specific weekly period

## File Structure

```
lib/
├── emailRecovery.ts          # Main recovery logic
├── init.ts                   # Updated to include recovery check
└── scheduler.ts              # Existing scheduler (unchanged)

app/api/
├── scheduled/
│   ├── email/
│   │   ├── route.ts          # Updated with logging
│   │   └── recovery/
│   │       └── route.ts      # Monthly recovery endpoint
│   └── weekly-email/
│       ├── route.ts          # Updated with logging
│       └── recovery/
│           └── route.ts      # Weekly recovery endpoint
└── email-recovery/
    └── route.ts              # Management API
```

## Recovery Email Templates

Recovery emails are clearly marked:
- Subject: `[RECOVERY] Monthly/Weekly Financial Report - Period`
- Special header with recovery icon (🔄)
- Explanation that this is a recovery email
- Highlighted note about the covered period

## Testing

Run the test script to verify functionality:
```bash
node test-email-recovery.js
```

## Monitoring

### Check System Status
```bash
curl -X GET "http://localhost:3002/api/email-recovery?action=status"
```

### Check for Missed Emails
```bash
curl -X GET "http://localhost:3002/api/email-recovery?action=check-missed"
```

### View Email Logs
```bash
curl -X GET "http://localhost:3002/api/email-recovery?action=logs&limit=20"
```

### Manual Recovery
```bash
curl -X POST "http://localhost:3002/api/email-recovery" \
  -H "Content-Type: application/json" \
  -d '{"action": "check-and-send"}'
```

## Error Handling

- Failed email attempts are logged with error messages
- Recovery process continues even if individual emails fail
- Comprehensive logging for troubleshooting
- Graceful degradation if database is unavailable

## Security

- Recovery endpoints require authentication
- Internal API key validation for scheduled tasks
- No sensitive data exposed in logs
- Rate limiting through delays between recovery emails

## Maintenance

### Regular Tasks
1. Monitor email logs for failed sends
2. Check recovery system status after server restarts
3. Verify email configuration periodically
4. Clean up old email logs if needed

### Troubleshooting
1. Check server logs for recovery system messages
2. Verify database connectivity
3. Confirm email configuration
4. Test manual recovery for specific periods

## Future Enhancements

Potential improvements:
- Web dashboard for email log management
- Retry mechanism for failed emails
- Email delivery confirmation tracking
- Advanced scheduling options
- Notification alerts for missed emails
