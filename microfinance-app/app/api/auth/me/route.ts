import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verify } from 'jsonwebtoken';
import { apiCache } from '@/lib/cache';


// Use ISR with a 5-minute revalidation period
export const revalidate = 300; // 5 minutes
export async function GET(request: NextRequest) {
  try {
    // Get the token from cookies
    const token = request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get JWT secret from environment variable
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET must be set in the .env file');
    }

    // Verify the token
    const decoded = verify(token, jwtSecret) as {
      id: number;
      email: string;
      role: string;
    };

    // Get the user from the database
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Return the user data
    return NextResponse.json(user);
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 401 }
    );
  }
}
