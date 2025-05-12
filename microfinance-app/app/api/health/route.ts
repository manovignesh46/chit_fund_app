import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Health check endpoint
export async function GET() {
  try {
    // Try to connect to the database
    const dbStatus = await checkDatabase();
    
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: dbStatus,
    });
  } catch (error) {
    console.error('Health check failed:', error);
    
    return NextResponse.json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Function to check database connection
async function checkDatabase() {
  try {
    // Try to query the database
    const userCount = await prisma.user.count();
    
    return {
      status: 'connected',
      userCount,
    };
  } catch (error) {
    console.error('Database connection error:', error);
    
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
