import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Debug endpoint to check environment variables and database connection
// IMPORTANT: Remove this endpoint after debugging is complete
export async function GET(request: NextRequest) {
  try {
    // Check environment variables (mask sensitive values)
    const envVars = {
      NODE_ENV: process.env.NODE_ENV || 'not set',
      DATABASE_URL: process.env.DATABASE_URL ? 'set (value hidden)' : 'not set',
      JWT_SECRET: process.env.JWT_SECRET ? 'set (value hidden)' : 'not set',
      ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'not set',
      ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ? 'set (value hidden)' : 'not set',
    };

    // Check database connection
    let dbStatus = 'unknown';
    let userCount = 0;
    let adminExists = false;
    let error = null;

    try {
      // Try to query the database
      const users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          role: true,
        },
        take: 5,
      });
      
      dbStatus = 'connected';
      userCount = users.length;
      
      // Check if admin user exists
      adminExists = users.some(user => 
        user.email === process.env.ADMIN_EMAIL && user.role === 'admin'
      );
    } catch (dbError: any) {
      dbStatus = 'error';
      error = dbError.message;
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      environmentVariables: envVars,
      database: {
        status: dbStatus,
        userCount,
        adminExists,
        error,
      },
    });
  } catch (error: any) {
    console.error('Debug endpoint error:', error);
    
    return NextResponse.json(
      {
        status: 'error',
        message: error.message || 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
