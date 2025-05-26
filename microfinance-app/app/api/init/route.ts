import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '../../../lib/auth';
import { initializeApp } from '../../../lib/init';
import { getSchedulerStatus } from '../../../lib/scheduler';

// GET endpoint to check initialization status
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

    return NextResponse.json({
      initialized: true,
      schedulers: status,
      message: 'Application initialization status'
    });

  } catch (error) {
    console.error('Error checking initialization status:', error);
    return NextResponse.json(
      { error: 'Failed to check initialization status' },
      { status: 500 }
    );
  }
}

// POST endpoint to force initialization
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

    console.log('Force initializing application...');
    initializeApp();

    // Wait a moment for initialization to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    const status = getSchedulerStatus();

    return NextResponse.json({
      success: true,
      message: 'Application initialized successfully',
      schedulers: status
    });

  } catch (error) {
    console.error('Error forcing initialization:', error);
    return NextResponse.json(
      { error: `Failed to initialize application: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
