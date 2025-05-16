import { NextRequest } from 'next/server';
import { verify } from 'jsonwebtoken';
import { cookies } from 'next/headers';

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
 * @param request The Next.js request object (optional in App Router)
 * @returns The user ID or null if not authenticated
 */
export async function getCurrentUserId(request?: NextRequest): Promise<number | null> {
  try {
    let token: string | undefined;

    // In App Router, we can use the cookies() function from next/headers
    // This is the preferred method in Next.js 15+
    const cookieStore = await cookies();
    token = cookieStore.get('auth_token')?.value;

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
 * @param request The Next.js request object (optional in App Router)
 * @param createdById The ID of the user who created the resource
 * @returns True if the current user is the owner, false otherwise
 */
export async function isResourceOwner(request: NextRequest | undefined, createdById: number): Promise<boolean> {
  const currentUserId = await getCurrentUserId(request);

  if (!currentUserId) {
    return false;
  }

  return currentUserId === createdById;
}

/**
 * Check if the current user is an admin
 * @param request The Next.js request object (optional in App Router)
 * @returns True if the current user is an admin, false otherwise
 */
export async function isAdmin(request?: NextRequest): Promise<boolean> {
  try {
    let token: string | undefined;

    // In App Router, we can use the cookies() function from next/headers
    const cookieStore = await cookies();
    token = cookieStore.get('auth_token')?.value;

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
