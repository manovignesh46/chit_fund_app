import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// List of paths that don't require authentication
const publicPaths = ['/login', '/api/auth/login'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if the path is public
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Skip API routes except those that need protection
  if (pathname.startsWith('/api') &&
      !pathname.startsWith('/api/dashboard') &&
      !pathname.startsWith('/api/chit-funds') &&
      !pathname.startsWith('/api/loans') &&
      !pathname.startsWith('/api/members')) {
    return NextResponse.next();
  }

  // Get the token from cookies
  const token = request.cookies.get('auth_token')?.value;

  // If there's no token, redirect to login
  if (!token) {
    const url = new URL('/login', request.url);
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }

  try {
    // Verify the token using jose (Edge compatible)
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key');
    const { payload } = await jwtVerify(token, secret);

    // Check if the user is an admin
    if (payload.role !== 'admin') {
      const url = new URL('/login', request.url);
      url.searchParams.set('from', pathname);
      url.searchParams.set('error', 'access_denied');
      return NextResponse.redirect(url);
    }

    // Continue to the protected route
    return NextResponse.next();
  } catch (error) {
    // If token verification fails, redirect to login
    const url = new URL('/login', request.url);
    url.searchParams.set('from', pathname);
    url.searchParams.set('error', 'session_expired');
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
