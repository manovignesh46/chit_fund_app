import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { compare } from 'bcrypt';
import { sign } from 'jsonwebtoken';
import { apiCache } from '@/lib/cache';


// Use ISR with a 5-minute revalidation period
export const revalidate = 300; // 5 minutes
export async function POST(request: NextRequest) {
  // Log the start of the login process
  console.log('Login request received:', {
    timestamp: new Date().toISOString(),
    headers: {
      contentType: request.headers.get('content-type'),
      userAgent: request.headers.get('user-agent')?.substring(0, 100),
    },
    environment: process.env.NODE_ENV || 'unknown',
  });

  try {
    // Log environment variable status (without exposing values)
    console.log('Environment check:', {
      DATABASE_URL_SET: !!process.env.DATABASE_URL,
      JWT_SECRET_SET: !!process.env.JWT_SECRET,
      ADMIN_EMAIL_SET: !!process.env.ADMIN_EMAIL,
      ADMIN_PASSWORD_SET: !!process.env.ADMIN_PASSWORD,
    });

    let body;
    try {
      body = await request.json();
      console.log('Request body parsed successfully');
    } catch (parseError: any) {
      console.error('Error parsing request body:', parseError.message);
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      );
    }

    const { email, password } = body;

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find the user by email
    let user;
    try {
      console.log(`Attempting to find user with email: ${email}`);
      user = await prisma.user.findUnique({
        where: { email },
      });
      console.log(`Database query completed. User found: ${!!user}`);
    } catch (dbError: any) {
      console.error('Database error during user lookup:', {
        message: dbError.message,
        code: dbError.code,
        meta: dbError.meta,
      });

      // Check for specific Prisma errors
      if (dbError.name === 'PrismaClientInitializationError') {
        console.error('Prisma client initialization failed. Check DATABASE_URL and database connectivity.');
        return NextResponse.json(
          { error: 'Database connection error' },
          { status: 500 }
        );
      }

      throw dbError; // Let the main catch block handle other database errors
    }

    // Check if user exists
    if (!user) {
      console.log(`No user found with email: ${email}`);
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    console.log(`User found: ID=${user.id}, Role=${user.role}`); // Log user details without exposing sensitive data

    // Check if the user is an admin
    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied. Only administrators can log in.' },
        { status: 403 }
      );
    }

    // Verify password
    let passwordMatch;
    try {
      console.log('Attempting to verify password');
      passwordMatch = await compare(password, user.password);
      console.log(`Password verification result: ${passwordMatch ? 'Success' : 'Failed'}`);
    } catch (passwordError: any) {
      console.error('Error during password verification:', {
        message: passwordError.message,
        name: passwordError.name,
      });
      return NextResponse.json(
        { error: 'Authentication error' },
        { status: 500 }
      );
    }

    if (!passwordMatch) {
      console.log('Password does not match');
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Get JWT secret from environment variable
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('JWT_SECRET environment variable is not set');
      throw new Error('JWT_SECRET must be set in the .env file');
    }

    // Create JWT token
    let token;
    try {
      console.log('Attempting to create JWT token');
      token = sign(
        {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        jwtSecret,
        { expiresIn: '1d' }
      );
      console.log('JWT token created successfully');
    } catch (tokenError: any) {
      console.error('Error creating JWT token:', {
        message: tokenError.message,
        name: tokenError.name,
      });
      return NextResponse.json(
        { error: 'Authentication token generation failed' },
        { status: 500 }
      );
    }

    // Create a response with user data
    console.log('Creating response with user data');
    const response = NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });

    // Set the token in a cookie
    try {
      console.log('Setting auth token cookie');
      response.cookies.set({
        name: 'auth_token',
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24, // 1 day
        path: '/',
        sameSite: 'strict',
      });
      console.log('Auth token cookie set successfully');
    } catch (cookieError: any) {
      console.error('Error setting auth token cookie:', {
        message: cookieError.message,
        name: cookieError.name,
      });

      // Try with a simpler cookie configuration as fallback
      try {
        console.log('Attempting to set cookie with simplified configuration');
        response.cookies.set({
          name: 'auth_token',
          value: token,
          maxAge: 86400, // 1 day in seconds
          path: '/',
        });
        console.log('Simplified auth token cookie set successfully');
      } catch (simpleCookieError: any) {
        console.error('Error setting simplified cookie:', simpleCookieError.message);
        // Continue without setting cookie - the frontend will need to handle this case
      }
    }

    console.log('Login successful for user:', user.email);
    return response;
  } catch (error: any) {
    // Create a detailed error log with context
    const errorDetails = {
      timestamp: new Date().toISOString(),
      message: error.message || 'Unknown error',
      stack: error.stack,
      name: error.name,
      code: error.code, // For database errors
      meta: error.meta, // For Prisma errors
      // Include environment info (but not sensitive values)
      env: {
        NODE_ENV: process.env.NODE_ENV,
        DATABASE_URL_SET: !!process.env.DATABASE_URL,
        JWT_SECRET_SET: !!process.env.JWT_SECRET,
        ADMIN_EMAIL_SET: !!process.env.ADMIN_EMAIL,
      }
    };

    // Log the detailed error information
    console.error('Login error details:', JSON.stringify(errorDetails, null, 2));

    // Determine a more specific error message for the client
    let clientErrorMessage = 'An error occurred during login';
    let statusCode = 500;

    if (error.message?.includes('JWT_SECRET')) {
      clientErrorMessage = 'Authentication configuration error';
      console.error('JWT_SECRET missing or invalid');
    } else if (error.name === 'PrismaClientInitializationError' ||
               error.name === 'PrismaClientKnownRequestError' ||
               error.message?.includes('database') ||
               error.message?.includes('ECONNREFUSED')) {
      clientErrorMessage = 'Database connection error';
      console.error('Database connection issue:', error.message);
    } else if (error.name === 'JsonWebTokenError') {
      clientErrorMessage = 'Token generation error';
      console.error('JWT error:', error.message);
    } else if (error.name === 'SyntaxError' && error.message?.includes('JSON')) {
      clientErrorMessage = 'Invalid request format';
      statusCode = 400;
      console.error('JSON parsing error:', error.message);
    }

    // Return a safe but more informative error to the client
    return NextResponse.json(
      {
        error: clientErrorMessage,
        requestId: Date.now().toString(36) + Math.random().toString(36).substr(2) // For tracking in logs
      },
      { status: statusCode }
    );
  }
}
