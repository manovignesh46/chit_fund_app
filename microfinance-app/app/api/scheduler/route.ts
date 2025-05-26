import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '../../../lib/auth';
import {
  startMonthlyEmailScheduler,
  startWeeklyEmailScheduler,
  startAllSchedulers,
  stopMonthlyEmailScheduler,
  stopWeeklyEmailScheduler,
  stopAllSchedulers,
  getSchedulerStatus,
  triggerMonthlyEmailNow,
  triggerWeeklyEmailNow,
  getNextRunTime
} from '../../../lib/scheduler';

// GET endpoint to check scheduler status
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

    const status = getSchedulerStatus();
    const nextRun = getNextRunTime();

    return NextResponse.json({
      ...status,
      nextRun
    });

  } catch (error) {
    console.error('Error checking scheduler status:', error);
    return NextResponse.json(
      { error: 'Failed to check scheduler status' },
      { status: 500 }
    );
  }
}

// POST endpoint to control scheduler
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

    // Parse request body
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'start':
        startAllSchedulers();
        return NextResponse.json({
          success: true,
          message: 'All email schedulers started'
        });

      case 'start-monthly':
        startMonthlyEmailScheduler();
        return NextResponse.json({
          success: true,
          message: 'Monthly email scheduler started'
        });

      case 'start-weekly':
        startWeeklyEmailScheduler();
        return NextResponse.json({
          success: true,
          message: 'Weekly email scheduler started'
        });

      case 'stop':
        stopAllSchedulers();
        return NextResponse.json({
          success: true,
          message: 'All email schedulers stopped'
        });

      case 'stop-monthly':
        stopMonthlyEmailScheduler();
        return NextResponse.json({
          success: true,
          message: 'Monthly email scheduler stopped'
        });

      case 'stop-weekly':
        stopWeeklyEmailScheduler();
        return NextResponse.json({
          success: true,
          message: 'Weekly email scheduler stopped'
        });

      case 'trigger-monthly':
        await triggerMonthlyEmailNow();
        return NextResponse.json({
          success: true,
          message: 'Monthly email triggered manually'
        });

      case 'trigger-weekly':
        await triggerWeeklyEmailNow();
        return NextResponse.json({
          success: true,
          message: 'Weekly email triggered manually'
        });

      case 'status':
        const status = getSchedulerStatus();
        const nextRun = getNextRunTime();
        return NextResponse.json({
          ...status,
          nextRun
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: start, stop, start-monthly, start-weekly, stop-monthly, stop-weekly, trigger-monthly, trigger-weekly, or status' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error controlling scheduler:', error);
    return NextResponse.json(
      { error: `Failed to control scheduler: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
