import { NextRequest } from 'next/server';
import { verify } from 'jsonwebtoken';

// Interface for decoded JWT token
export interface DecodedToken {
  id: number;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

/**
 * Get the current user ID from the JWT token in the request cookies
 * @param request The Next.js request object
 * @returns The user ID or null if not authenticated
 */
export function getCurrentUserId(request: NextRequest): number | null {
  try {
    // Get the token from cookies
    const token = request.cookies.get('auth_token')?.value;

    if (!token) {
      return null;
    }

    // Get JWT secret from environment variable
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET must be set in the .env file');
    }

    // Verify the token
    const decoded = verify(token, jwtSecret) as DecodedToken;

    // Return the user ID
    return decoded.id;
  } catch (error) {
    console.error('Error getting current user ID:', error);
    return null;
  }
}

/**
 * Check if the current user is the owner of a resource
 * @param request The Next.js request object
 * @param createdById The ID of the user who created the resource
 * @returns True if the current user is the owner, false otherwise
 */
export function isResourceOwner(request: NextRequest, createdById: number): boolean {
  const currentUserId = getCurrentUserId(request);
  
  if (!currentUserId) {
    return false;
  }
  
  return currentUserId === createdById;
}

/**
 * Check if the current user is an admin
 * @param request The Next.js request object
 * @returns True if the current user is an admin, false otherwise
 */
export function isAdmin(request: NextRequest): boolean {
  try {
    // Get the token from cookies
    const token = request.cookies.get('auth_token')?.value;

    if (!token) {
      return false;
    }

    // Get JWT secret from environment variable
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET must be set in the .env file');
    }

    // Verify the token
    const decoded = verify(token, jwtSecret) as DecodedToken;

    // Check if the user is an admin
    return decoded.role === 'admin';
  } catch (error) {
    console.error('Error checking if user is admin:', error);
    return false;
  }
}
