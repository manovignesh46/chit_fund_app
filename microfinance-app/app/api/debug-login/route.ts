import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sign } from 'jsonwebtoken';

// IMPORTANT: This is a temporary debugging route and should be removed in production
// This route is only for development/debugging purposes

export async function GET(request: NextRequest) {
  try {
    console.log('Debug login route accessed');
    
    // Check if we're in development mode
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEBUG_LOGIN !== 'true') {
      console.log('Debug login route disabled in production');
      return NextResponse.json(
        { error: 'This route is disabled in production' },
        { status: 403 }
      );
    }
    
    // Log environment variable status (without exposing values)
    console.log('Environment check:', {
      DATABASE_URL_SET: !!process.env.DATABASE_URL,
      JWT_SECRET_SET: !!process.env.JWT_SECRET,
      ADMIN_EMAIL_SET: !!process.env.ADMIN_EMAIL,
      ADMIN_PASSWORD_SET: !!process.env.ADMIN_PASSWORD,
      NODE_ENV: process.env.NODE_ENV,
    });
    
    // Try to connect to the database
    let user;
    try {
      console.log('Attempting to find admin user');
      user = await prisma.user.findFirst({
        where: { role: 'admin' },
      });
      console.log(`Database query completed. Admin user found: ${!!user}`);
    } catch (dbError: any) {
      console.error('Database error during user lookup:', {
        message: dbError.message,
        code: dbError.code,
        meta: dbError.meta,
      });
      
      return NextResponse.json(
        { 
          error: 'Database connection error',
          details: dbError.message,
          prismaVersion: require('@prisma/client').Prisma.prismaVersion.client
        },
        { status: 500 }
      );
    }
    
    // Check if we found an admin user
    if (!user) {
      console.log('No admin user found in the database');
      return NextResponse.json(
        { error: 'No admin user found in the database' },
        { status: 404 }
      );
    }
    
    // Get JWT secret from environment variable
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('JWT_SECRET environment variable is not set');
      return NextResponse.json(
        { error: 'JWT_SECRET must be set in the environment variables' },
        { status: 500 }
      );
    }
    
    // Create JWT token
    let token;
    try {
      console.log('Creating debug JWT token');
      token = sign(
        {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        jwtSecret,
        { expiresIn: '1h' } // Short expiration for security
      );
      console.log('Debug JWT token created successfully');
    } catch (tokenError: any) {
      console.error('Error creating JWT token:', tokenError.message);
      return NextResponse.json(
        { error: 'Failed to create authentication token' },
        { status: 500 }
      );
    }
    
    // Create a response with user data
    const response = NextResponse.json({
      message: 'Debug login successful',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      // Include instructions for manual cookie setting
      cookieInstructions: 'Copy the token below and use browser devtools to set a cookie named "auth_token" with this value'
    });
    
    // Set the token in a cookie
    try {
      response.cookies.set({
        name: 'auth_token',
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60, // 1 hour
        path: '/',
        sameSite: 'strict',
      });
      console.log('Debug auth token cookie set successfully');
    } catch (cookieError: any) {
      console.error('Error setting auth token cookie:', cookieError.message);
      // Continue without setting cookie - we'll return the token in the response
    }
    
    // Also include the token in the response for manual setting if needed
    return response;
  } catch (error: any) {
    console.error('Debug login error:', error);
    return NextResponse.json(
      { 
        error: 'An error occurred during debug login',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
