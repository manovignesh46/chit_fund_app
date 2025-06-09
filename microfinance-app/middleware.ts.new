import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// List of paths that don't require authentication
const publicPaths = ['/login', '/api/user', '/api/debug-login'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static files and public paths
  if (pathname.startsWith('/_next') || 
      pathname.startsWith('/public') || 
      pathname === '/favicon.ico' ||
      publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Get the token from cookies
  const token = request.cookies.get('auth_token')?.value;

  // If there's no token, redirect to login
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    // Get JWT secret from environment variable
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('JWT_SECRET not set in environment');
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Verify the token
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(token, secret);

    // Check if the user is an admin
    if (payload.role !== 'admin') {
      return NextResponse.redirect(new URL('/login?error=access_denied', request.url));
    }

    // Allow the request to proceed
    return NextResponse.next();
  } catch (error) {
    console.error('Token verification failed:', error);
    return NextResponse.redirect(new URL('/login?error=session_expired', request.url));
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
