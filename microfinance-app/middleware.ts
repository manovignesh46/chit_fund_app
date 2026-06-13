import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// List of paths that don't require authentication
const publicPaths = ['/login', '/api/user', '/api/debug-login', '/api/health'];

// Rate limiting map (simple in-memory, consider Redis for production)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Simple rate limiter (100 requests per minute for small team)
function rateLimit(ip: string, maxRequests = 100, windowMs = 60000): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (record.count >= maxRequests) {
    return false;
  }

  record.count++;
  return true;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Get client IP for rate limiting
  const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
  
  // Apply rate limiting (except for static assets)
  if (!pathname.startsWith('/_next') && !pathname.startsWith('/public')) {
    if (!rateLimit(ip)) {
      return new NextResponse('Too Many Requests', { status: 429 });
    }
  }

  // Security headers for all responses
  const response = NextResponse.next();
  
  // Add security headers
  response.headers.set('X-DNS-Prefetch-Control', 'off');
  response.headers.set('X-Download-Options', 'noopen');
  response.headers.set('X-Permitted-Cross-Domain-Policies', 'none');

  // Validate origin for API requests
  if (pathname.startsWith('/api') && request.method !== 'GET') {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');
    
    // For non-GET API requests, verify same-origin
    if (origin && !origin.includes(host || '')) {
      return new NextResponse('Forbidden - Invalid Origin', { status: 403 });
    }
  }

  // Allow static files and public paths
  if (pathname.startsWith('/_next') || 
      pathname.startsWith('/public') || 
      pathname === '/favicon.ico' ||
      publicPaths.some(path => pathname.startsWith(path))) {
    return response;
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

    // Check token expiration
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return NextResponse.redirect(new URL('/login?error=session_expired', request.url));
    }

    // Allow primary admin and partner accounts
    if (payload.role !== 'admin' && payload.role !== 'partner') {
      return NextResponse.redirect(new URL('/login?error=access_denied', request.url));
    }

    // Allow the request to proceed
    return response;
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
