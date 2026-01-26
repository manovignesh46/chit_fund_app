/**
 * Security utilities for API routes
 */

import { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// Verify JWT token from request
export async function verifyToken(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  
  if (!token) {
    return null;
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

// Verify same-origin for API requests
export function verifySameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  
  // Allow requests without origin header (same-origin, direct requests)
  if (!origin) {
    return true;
  }
  
  // Verify origin matches host
  return origin.includes(host || '');
}

// Input sanitization
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return '';
  
  // Remove potential XSS vectors
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .trim();
}

// Validate email format
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate password strength
export function isStrongPassword(password: string): boolean {
  // At least 8 characters, one uppercase, one lowercase, one number
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password)
  );
}

// SQL injection prevention (for raw queries - Prisma handles this mostly)
export function escapeSQLString(str: string): string {
  return str.replace(/'/g, "''");
}

// Generate secure random token
export function generateSecureToken(length: number = 32): string {
  const crypto = require('crypto');
  return crypto.randomBytes(length).toString('hex');
}

// Rate limiting helper for API routes
const apiRateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function checkApiRateLimit(
  identifier: string,
  maxRequests: number = 50,
  windowMs: number = 60000
): { allowed: boolean; remainingRequests?: number } {
  const now = Date.now();
  const record = apiRateLimitMap.get(identifier);

  if (!record || now > record.resetTime) {
    apiRateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remainingRequests: maxRequests - 1 };
  }

  if (record.count >= maxRequests) {
    return { allowed: false };
  }

  record.count++;
  return { allowed: true, remainingRequests: maxRequests - record.count };
}

// CSRF token validation (if using custom implementation)
export function validateCSRFToken(token: string, sessionToken: string): boolean {
  // Implement CSRF validation logic
  // For Next.js, this is usually handled by SameSite cookies
  return true; // Placeholder
}

// Security headers helper
export function getSecurityHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };
}

// Validate request method
export function validateMethod(request: NextRequest, allowedMethods: string[]): boolean {
  return allowedMethods.includes(request.method);
}

// Log security events
export function logSecurityEvent(event: {
  type: 'unauthorized_access' | 'rate_limit' | 'invalid_token' | 'suspicious_activity';
  ip?: string;
  path?: string;
  details?: string;
}) {
  const timestamp = new Date().toISOString();
  console.warn(`[SECURITY] ${timestamp} - ${event.type}`, event);
  
  // In production, send to logging service (e.g., Sentry, LogRocket)
  // or store in database for audit trail
}
