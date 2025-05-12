import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { compare } from 'bcrypt';
import { sign } from 'jsonwebtoken';
import { apiCache } from '@/lib/cache';


// Use ISR with a 5-minute revalidation period
export const revalidate = 300; // 5 minutes
export async function POST(request: NextRequest) {
  try {
    console.log('Login request received');

    // Check environment variables
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not set in environment variables');
    }

    if (!process.env.ADMIN_EMAIL) {
      console.error('ADMIN_EMAIL is not set in environment variables');
    }

    if (!process.env.ADMIN_PASSWORD) {
      console.error('ADMIN_PASSWORD is not set in environment variables');
    }

    // Parse request body
    let body;
    try {
      body = await request.json();
      console.log('Request body parsed successfully');
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      );
    }

    const { email, password } = body;
    console.log(`Login attempt for email: ${email}`);

    // Validate required fields
    if (!email || !password) {
      console.log('Missing email or password');
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find the user by email
    let user;
    try {
      user = await prisma.user.findUnique({
        where: { email },
      });
      console.log(`User lookup result: ${user ? 'User found' : 'User not found'}`);
    } catch (dbError: any) {
      console.error('Database error during user lookup:', dbError);
      return NextResponse.json(
        { error: `Database error: ${dbError.message}` },
        { status: 500 }
      );
    }

    // Check if user exists
    if (!user) {
      console.log(`No user found with email: ${email}`);
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Check if the user is an admin
    if (user.role !== 'admin') {
      console.log(`User ${email} is not an admin (role: ${user.role})`);
      return NextResponse.json(
        { error: 'Access denied. Only administrators can log in.' },
        { status: 403 }
      );
    }

    // Verify password
    let passwordMatch;
    try {
      passwordMatch = await compare(password, user.password);
      console.log(`Password verification result: ${passwordMatch ? 'Match' : 'No match'}`);
    } catch (passwordError) {
      console.error('Error during password verification:', passwordError);
      return NextResponse.json(
        { error: 'Error verifying password' },
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
      console.error('JWT_SECRET is not set in the .env file');
      throw new Error('JWT_SECRET must be set in the .env file');
    }

    // Create JWT token
    let token;
    try {
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
    } catch (tokenError) {
      console.error('Error creating JWT token:', tokenError);
      return NextResponse.json(
        { error: 'Error creating authentication token' },
        { status: 500 }
      );
    }

    // Create a response with user data
    const response = NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });

    // Set the token in a cookie
    try {
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
    } catch (cookieError) {
      console.error('Error setting auth token cookie:', cookieError);
      return NextResponse.json(
        { error: 'Error setting authentication cookie' },
        { status: 500 }
      );
    }

    console.log('Login successful for user:', user.email);
    return response;
  } catch (error: any) {
    console.error('Login error:', error);
    // Return more detailed error information
    return NextResponse.json(
      {
        error: 'An error occurred during login',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
