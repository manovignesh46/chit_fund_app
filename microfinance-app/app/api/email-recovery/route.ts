import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '../../../lib/auth';
import {
  checkAndSendMissedEmails,
  findMissedMonthlyEmails,
  findMissedWeeklyEmails,
  getEmailLogs,
  sendRecoveryMonthlyEmail,
  sendRecoveryWeeklyEmail
} from '../../../lib/emailRecovery';

// GET endpoint to check missed emails and email logs
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const userId = await getCurrentUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    switch (action) {
      case 'check-missed':
        const missedMonthly = await findMissedMonthlyEmails();
        const missedWeekly = await findMissedWeeklyEmails();
        
        return NextResponse.json({
          missedMonthly,
          missedWeekly,
          totalMissed: missedMonthly.length + missedWeekly.length
        });

      case 'logs':
        const limit = parseInt(url.searchParams.get('limit') || '50');
        const emailType = url.searchParams.get('type') as 'monthly' | 'weekly' | undefined;
        const logs = await getEmailLogs(emailType, limit);
        
        return NextResponse.json({
          logs,
          count: logs.length
        });

      case 'status':
        const recoveryEnabled = process.env.EMAIL_RECOVERY_ENABLED !== 'false';
        const monthlyEnabled = process.env.AUTO_MONTHLY_EMAIL_ENABLED === 'true';
        const weeklyEnabled = process.env.AUTO_WEEKLY_EMAIL_ENABLED === 'true';
        
        return NextResponse.json({
          recoveryEnabled,
          monthlyEnabled,
          weeklyEnabled,
          configuration: {
            monthlyDay: process.env.AUTO_MONTHLY_EMAIL_DAY || '1',
            monthlyHour: process.env.AUTO_MONTHLY_EMAIL_HOUR || '9',
            weeklyDay: process.env.AUTO_WEEKLY_EMAIL_DAY || '0',
            weeklyHour: process.env.AUTO_WEEKLY_EMAIL_HOUR || '18',
            timezone: process.env.AUTO_MONTHLY_EMAIL_TIMEZONE || 'Asia/Kolkata'
          }
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: check-missed, logs, or status' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error in email recovery GET:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

// POST endpoint to trigger recovery actions
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const userId = await getCurrentUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, period } = body;

    switch (action) {
      case 'check-and-send':
        await checkAndSendMissedEmails();
        return NextResponse.json({
          success: true,
          message: 'Missed email check and recovery completed'
        });

      case 'recover-monthly':
        if (!period) {
          return NextResponse.json(
            { error: 'Period is required for monthly recovery' },
            { status: 400 }
          );
        }
        
        const monthlySuccess = await sendRecoveryMonthlyEmail(period);
        return NextResponse.json({
          success: monthlySuccess,
          message: monthlySuccess 
            ? `Monthly recovery email sent for ${period}` 
            : `Failed to send monthly recovery email for ${period}`
        });

      case 'recover-weekly':
        if (!period) {
          return NextResponse.json(
            { error: 'Period is required for weekly recovery' },
            { status: 400 }
          );
        }
        
        const weeklySuccess = await sendRecoveryWeeklyEmail(period);
        return NextResponse.json({
          success: weeklySuccess,
          message: weeklySuccess 
            ? `Weekly recovery email sent for ${period}` 
            : `Failed to send weekly recovery email for ${period}`
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: check-and-send, recover-monthly, or recover-weekly' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error in email recovery POST:', error);
    return NextResponse.json(
      { error: 'Failed to process recovery request' },
      { status: 500 }
    );
  }
}
