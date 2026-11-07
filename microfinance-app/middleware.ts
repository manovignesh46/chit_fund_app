import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import type { JWTPayload } from 'jose';

// List of paths that don't require authentication
const publicPaths = ['/login', '/api/user', '/api/debug-login', '/api/health'];

// Rate limiting (simple in-memory, per server instance; consider Redis for production)
const MINUTE = 60000;
const USER_LIMIT = 600; // per signed-in user per minute
const IP_LIMIT = 100; // per IP per minute, for anything without a valid session
const MAX_BUCKETS = 5000;
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// /api/user actions that check a password or create an account. These are always counted
// per IP, even when the caller has a valid session, so holding one session cannot buy a
// higher rate for guessing someone else's password.
const credentialActions = new Set(['login', 'partner-login', 'register', 'change-password']);

// Drop expired windows once the map gets large. If it is still large (many distinct keys
// inside one minute, e.g. spoofed X-Forwarded-For values), also drop the oldest entries so
// memory stays bounded. Each sweep at least halves the map, so the cost is amortised.
function pruneBuckets(now: number) {
  for (const [key, record] of rateLimitMap) {
    if (now > record.resetTime) rateLimitMap.delete(key);
  }
  let excess = rateLimitMap.size - MAX_BUCKETS / 2;
  for (const key of rateLimitMap.keys()) {
    if (excess-- <= 0) break;
    rateLimitMap.delete(key);
  }
}

function rateLimit(key: string, maxRequests: number, windowMs = MINUTE): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetTime) {
    if (!record && rateLimitMap.size >= MAX_BUCKETS) pruneBuckets(now);
    // Delete before set so the key moves to the end of the Map's insertion order,
    // which keeps "oldest first" accurate for pruneBuckets.
    rateLimitMap.delete(key);
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (record.count >= maxRequests) {
    return false;
  }

  record.count++;
  return true;
}

type AuthResult =
  | { status: 'ok'; payload: JWTPayload }
  | { status: 'none' | 'no-secret' | 'expired' | 'forbidden' }
  | { status: 'invalid'; error: unknown };

// Verify the auth_token cookie once; the result feeds both the rate limiter and the
// auth/role checks below. Only a token whose signature verifies counts as a session.
async function checkAuth(request: NextRequest): Promise<AuthResult> {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return { status: 'none' };

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) return { status: 'no-secret' };

  try {
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(token, secret);

    // Check token expiration
    if (payload.exp && payload.exp * 1000 < Date.now()) return { status: 'expired' };

    // Allow primary admin and partner accounts
    if (payload.role !== 'admin' && payload.role !== 'partner') return { status: 'forbidden' };

    return { status: 'ok', payload };
  } catch (error) {
    return { status: 'invalid', error };
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isStatic = pathname.startsWith('/_next') || pathname.startsWith('/public');

  const auth: AuthResult = isStatic ? { status: 'none' } : await checkAuth(request);

  // Get client IP for rate limiting
  const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';

  // Apply rate limiting (except for static assets)
  if (!isStatic) {
    const isAuthEntry = pathname.startsWith('/login') || pathname.startsWith('/api/user');
    const isCredentialAction = pathname.startsWith('/api/user') &&
      credentialActions.has(request.nextUrl.searchParams.get('action') || '');

    let allowed: boolean;
    if (auth.status === 'ok' && !pathname.startsWith('/login') && !isCredentialAction) {
      // Key on the actual signed-in user (actorId, as getActorUserId in lib/auth.ts).
      // `id` is the data owner, which partner logins share with the primary admin.
      const userId = auth.payload.actorId ?? auth.payload.id;
      allowed = rateLimit(`user:${userId}`, USER_LIMIT);
    } else if (isAuthEntry) {
      // Login page and anonymous/credential /api/user calls get their own per-IP bucket, so
      // stale tabs polling without a session cannot use up the office's login allowance.
      allowed = rateLimit(`auth:${ip}`, IP_LIMIT);
    } else {
      allowed = rateLimit(`ip:${ip}`, IP_LIMIT);
    }

    if (!allowed) {
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
  if (isStatic ||
      pathname === '/favicon.ico' ||
      pathname === '/manifest.json' ||
      pathname.startsWith('/icons/') ||
      publicPaths.some(path => pathname.startsWith(path))) {
    return response;
  }

  switch (auth.status) {
    case 'ok':
      // Allow the request to proceed
      return response;
    case 'none':
      // If there's no token, redirect to login
      return NextResponse.redirect(new URL('/login', request.url));
    case 'no-secret':
      console.error('JWT_SECRET not set in environment');
      return NextResponse.redirect(new URL('/login', request.url));
    case 'expired':
      return NextResponse.redirect(new URL('/login?error=session_expired', request.url));
    case 'forbidden':
      return NextResponse.redirect(new URL('/login?error=access_denied', request.url));
    case 'invalid':
      console.error('Token verification failed:', auth.error);
      return NextResponse.redirect(new URL('/login?error=session_expired', request.url));
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/|public).*)',
  ],
};
