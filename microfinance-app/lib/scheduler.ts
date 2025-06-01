import cron from 'node-cron';

// Global variables to store the scheduled tasks
// Use type 'any' for cron.ScheduledTask to avoid type errors
let monthlyEmailTask: any = null;
let weeklyEmailTask: any = null;
let dbBackupTask: any = null;

// Function to start the monthly email scheduler
export function startMonthlyEmailScheduler() {
  try {
    // Check if automatic emails are enabled
    const isEnabled = process.env.AUTO_MONTHLY_EMAIL_ENABLED === 'true';
    if (!isEnabled) {
      console.log('Automatic monthly emails are disabled');
      return;
    }

    // Get configuration from environment variables
    const day = parseInt(process.env.AUTO_MONTHLY_EMAIL_DAY || '1', 10);
    const hour = parseInt(process.env.AUTO_MONTHLY_EMAIL_HOUR || '9', 10);
    const timezone = process.env.AUTO_MONTHLY_EMAIL_TIMEZONE || 'Asia/Kolkata';

    // Validate configuration
    if (day < 1 || day > 28) {
      console.error('Invalid AUTO_MONTHLY_EMAIL_DAY. Must be between 1 and 28.');
      return;
    }

    if (hour < 0 || hour > 23) {
      console.error('Invalid AUTO_MONTHLY_EMAIL_HOUR. Must be between 0 and 23.');
      return;
    }

    // Stop existing task if running
    if (monthlyEmailTask) {
      monthlyEmailTask.stop();
      monthlyEmailTask = null;
    }

    // Create cron expression: minute hour day-of-month month day-of-week
    // We'll run at minute 0 of the specified hour on the specified day of every month
    const cronExpression = `0 ${hour} ${day} * *`;

    console.log(`Setting up monthly email scheduler:`);
    console.log(`- Schedule: ${cronExpression} (${timezone})`);
    console.log(`- Will run on day ${day} of each month at ${hour}:00`);

    // Create and start the scheduled task
    monthlyEmailTask = cron.schedule(cronExpression, async () => {
      console.log('Running scheduled monthly email task...');
      await sendScheduledMonthlyEmail();
    }, {
      timezone: timezone
    });

    console.log('Monthly email scheduler started successfully');

  } catch (error) {
    console.error('Error starting monthly email scheduler:', error);
  }
}

// Function to start the weekly email scheduler
export function startWeeklyEmailScheduler() {
  try {
    // Check if automatic weekly emails are enabled
    const isEnabled = process.env.AUTO_WEEKLY_EMAIL_ENABLED === 'true';
    if (!isEnabled) {
      console.log('Automatic weekly emails are disabled');
      return;
    }

    // Get configuration from environment variables
    const dayOfWeek = parseInt(process.env.AUTO_WEEKLY_EMAIL_DAY || '0', 10); // 0 = Sunday
    const hour = parseInt(process.env.AUTO_WEEKLY_EMAIL_HOUR || '18', 10);
    const timezone = process.env.AUTO_WEEKLY_EMAIL_TIMEZONE || 'Asia/Kolkata';

    // Validate configuration
    if (dayOfWeek < 0 || dayOfWeek > 6) {
      console.error('Invalid AUTO_WEEKLY_EMAIL_DAY. Must be between 0 (Sunday) and 6 (Saturday).');
      return;
    }

    if (hour < 0 || hour > 23) {
      console.error('Invalid AUTO_WEEKLY_EMAIL_HOUR. Must be between 0 and 23.');
      return;
    }

    // Stop existing task if running
    if (weeklyEmailTask) {
      weeklyEmailTask.stop();
      weeklyEmailTask = null;
    }

    // Create cron expression: minute hour day-of-month month day-of-week
    // We'll run at minute 0 of the specified hour on the specified day of every week
    const cronExpression = `0 ${hour} * * ${dayOfWeek}`;

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    console.log(`Setting up weekly email scheduler:`);
    console.log(`- Schedule: ${cronExpression} (${timezone})`);
    console.log(`- Will run every ${dayNames[dayOfWeek]} at ${hour}:00`);

    // Create and start the scheduled task
    weeklyEmailTask = cron.schedule(cronExpression, async () => {
      console.log('Running scheduled weekly email task...');
      await sendScheduledWeeklyEmail();
    }, {
      timezone: timezone
    });

    console.log('Weekly email scheduler started successfully');

  } catch (error) {
    console.error('Error starting weekly email scheduler:', error);
  }
}

// Function to start the monthly DB backup scheduler
export function startMonthlyDbBackupScheduler() {
  try {
    const isEnabled = process.env.AUTO_MONTHLY_DB_BACKUP_ENABLED === 'true';
    if (!isEnabled) {
      console.log('Automatic monthly DB backups are disabled');
      return;
    }
    const day = parseInt(process.env.AUTO_MONTHLY_DB_BACKUP_DAY || '1', 10);
    const hour = parseInt(process.env.AUTO_MONTHLY_DB_BACKUP_HOUR || '2', 10);
    const timezone = process.env.AUTO_MONTHLY_DB_BACKUP_TIMEZONE || 'Asia/Kolkata';
    if (day < 1 || day > 28) {
      console.error('Invalid AUTO_MONTHLY_DB_BACKUP_DAY. Must be between 1 and 28.');
      return;
    }
    if (hour < 0 || hour > 23) {
      console.error('Invalid AUTO_MONTHLY_DB_BACKUP_HOUR. Must be between 0 and 23.');
      return;
    }
    if (dbBackupTask) {
      dbBackupTask.stop();
      dbBackupTask = null;
    }
    const cronExpression = `0 ${hour} ${day} * *`;
    console.log(`Setting up monthly DB backup scheduler:`);
    console.log(`- Schedule: ${cronExpression} (${timezone})`);
    dbBackupTask = cron.schedule(cronExpression, async () => {
      console.log('Running scheduled monthly DB backup task...');
      await sendScheduledMonthlyDbBackup();
    }, {
      timezone: timezone
    });
    console.log('Monthly DB backup scheduler started successfully');
  } catch (error) {
    console.error('Error starting monthly DB backup scheduler:', error);
  }
}

// Function to stop the monthly email scheduler
export function stopMonthlyEmailScheduler() {
  if (monthlyEmailTask) {
    monthlyEmailTask.stop();
    monthlyEmailTask = null;
    console.log('Monthly email scheduler stopped');
  }
}

// Function to stop the weekly email scheduler
export function stopWeeklyEmailScheduler() {
  if (weeklyEmailTask) {
    weeklyEmailTask.stop();
    weeklyEmailTask = null;
    console.log('Weekly email scheduler stopped');
  }
}

// Function to stop the monthly DB backup scheduler
export function stopMonthlyDbBackupScheduler() {
  if (dbBackupTask) {
    dbBackupTask.stop();
    dbBackupTask = null;
    console.log('Monthly DB backup scheduler stopped');
  }
}

// Function to start all schedulers
export function startAllSchedulers() {
  startMonthlyEmailScheduler();
  startWeeklyEmailScheduler();
  startMonthlyDbBackupScheduler();
}

// Function to stop all schedulers
export function stopAllSchedulers() {
  stopMonthlyEmailScheduler();
  stopWeeklyEmailScheduler();
  stopMonthlyDbBackupScheduler();
}

// Function to get scheduler status
export function getSchedulerStatus() {
  const monthlyEnabled = process.env.AUTO_MONTHLY_EMAIL_ENABLED === 'true';
  const weeklyEnabled = process.env.AUTO_WEEKLY_EMAIL_ENABLED === 'true';
  const monthlyRunning = monthlyEmailTask !== null;
  const weeklyRunning = weeklyEmailTask !== null;
  const dbBackupEnabled = process.env.AUTO_MONTHLY_DB_BACKUP_ENABLED === 'true';
  const dbBackupRunning = dbBackupTask !== null;

  return {
    monthly: {
      enabled: monthlyEnabled,
      running: monthlyRunning,
      configuration: {
        day: parseInt(process.env.AUTO_MONTHLY_EMAIL_DAY || '1', 10),
        hour: parseInt(process.env.AUTO_MONTHLY_EMAIL_HOUR || '9', 10),
        timezone: process.env.AUTO_MONTHLY_EMAIL_TIMEZONE || 'Asia/Kolkata'
      }
    },
    weekly: {
      enabled: weeklyEnabled,
      running: weeklyRunning,
      configuration: {
        dayOfWeek: parseInt(process.env.AUTO_WEEKLY_EMAIL_DAY || '0', 10),
        hour: parseInt(process.env.AUTO_WEEKLY_EMAIL_HOUR || '18', 10),
        timezone: process.env.AUTO_WEEKLY_EMAIL_TIMEZONE || 'Asia/Kolkata'
      }
    },
    dbBackup: {
      enabled: dbBackupEnabled,
      running: dbBackupRunning,
      configuration: {
        day: parseInt(process.env.AUTO_MONTHLY_DB_BACKUP_DAY || '1', 10),
        hour: parseInt(process.env.AUTO_MONTHLY_DB_BACKUP_HOUR || '2', 10),
        timezone: process.env.AUTO_MONTHLY_DB_BACKUP_TIMEZONE || 'Asia/Kolkata'
      }
    }
  };
}

// Function to manually trigger the monthly email (for testing)
export async function triggerMonthlyEmailNow() {
  console.log('Manually triggering monthly email...');
  await sendScheduledMonthlyEmail();
}

// Function to manually trigger the weekly email (for testing)
export async function triggerWeeklyEmailNow() {
  console.log('Manually triggering weekly email...');
  await sendScheduledWeeklyEmail();
}

// Function to manually trigger the monthly DB backup (for testing)
export async function triggerMonthlyDbBackupNow() {
  console.log('Manually triggering monthly DB backup...');
  await sendScheduledMonthlyDbBackup();
}

// Internal function to send the scheduled monthly email
async function sendScheduledMonthlyEmail() {
  try {
    const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL || 'http://localhost:3001';
    const internalKey = process.env.INTERNAL_API_KEY || 'default-internal-key';

    console.log('Sending scheduled monthly email...');

    const response = await fetch(`${baseUrl}/api/scheduled/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${internalKey}`
      }
    });

    if (response.ok) {
      const result = await response.json();
      console.log('Monthly email sent successfully:', result);
    } else {
      const error = await response.text();
      console.error('Failed to send monthly email:', error);
    }

  } catch (error) {
    console.error('Error in scheduled monthly email:', error);
  }
}

// Internal function to send the scheduled weekly email
async function sendScheduledWeeklyEmail() {
  try {
    const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL || 'http://localhost:3001';
    const internalKey = process.env.INTERNAL_API_KEY || 'default-internal-key';

    console.log('Sending scheduled weekly email...');

    const response = await fetch(`${baseUrl}/api/scheduled/weekly-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${internalKey}`
      }
    });

    if (response.ok) {
      const result = await response.json();
      console.log('Weekly email sent successfully:', result);
    } else {
      const error = await response.text();
      console.error('Failed to send weekly email:', error);
    }

  } catch (error) {
    console.error('Error in scheduled weekly email:', error);
  }
}

// Internal function to send the scheduled monthly DB backup
async function sendScheduledMonthlyDbBackup() {
  try {
    const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL || 'http://localhost:3001';
    const internalKey = process.env.INTERNAL_API_KEY || 'default-internal-key';

    console.log('Sending scheduled monthly DB backup...');

    const response = await fetch(`${baseUrl}/api/scheduled/db-backup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${internalKey}`
      }
    });

    if (response.ok) {
      const result = await response.json();
      console.log('Monthly DB backup sent successfully:', result);
    } else {
      const error = await response.text();
      console.error('Failed to send monthly DB backup:', error);
    }

  } catch (error) {
    console.error('Error in scheduled monthly DB backup:', error);
  }
}

// Function to calculate next run time
export function getNextRunTime(): string {
  try {
    const day = parseInt(process.env.AUTO_MONTHLY_EMAIL_DAY || '1', 10);
    const hour = parseInt(process.env.AUTO_MONTHLY_EMAIL_HOUR || '9', 10);
    const timezone = process.env.AUTO_MONTHLY_EMAIL_TIMEZONE || 'Asia/Kolkata';

    const now = new Date();
    let nextRun = new Date(now.getFullYear(), now.getMonth(), day, hour, 0, 0);

    // If the scheduled time for this month has already passed, schedule for next month
    if (nextRun <= now) {
      nextRun = new Date(now.getFullYear(), now.getMonth() + 1, day, hour, 0, 0);
    }

    return nextRun.toLocaleString('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });

  } catch (error) {
    return 'Unable to calculate next run time';
  }
}

// --- IMMEDIATE DB BACKUP TRIGGER ON STARTUP ---
if (process.env.START_BACKUP_DB === 'true') {
  (async () => {
    try {
      console.log('[START_BACKUP_DB] Triggering immediate monthly DB backup...');
      await sendScheduledMonthlyDbBackup();
      console.log('[START_BACKUP_DB] Immediate DB backup completed.');
    } catch (err) {
      console.error('[START_BACKUP_DB] Immediate DB backup failed:', err);
    }
    // Prevent repeat by unsetting the env var in memory (does not persist across restarts)
    process.env.START_BACKUP_DB = 'false';
  })();
}
