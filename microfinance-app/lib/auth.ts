import { NextRequest } from 'next/server';
import { verify } from 'jsonwebtoken';
import { cookies } from 'next/headers';

export interface DecodedToken {
  id: number;
  actorId?: number;
  partnerId?: number | null;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

async function getTokenPayload(request?: NextRequest): Promise<DecodedToken | null> {
  try {
    let token: string | undefined;

    if (request) {
      token = request.cookies.get('auth_token')?.value;
    }

    if (!token) {
      const cookieStore = await cookies();
      token = cookieStore.get('auth_token')?.value;
    }

    if (!token) {
      return null;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET must be set in the .env file');
    }

    return verify(token, jwtSecret) as DecodedToken;
  } catch (error) {
    console.error('Error decoding auth token:', error);
    return null;
  }
}

/**
 * Returns the business data owner ID (used for all existing data queries).
 * For partner accounts this is the primary admin; for primary admins it is themselves.
 */
export async function getCurrentUserId(request?: NextRequest): Promise<number | null> {
  const payload = await getTokenPayload(request);
  return payload?.id ?? null;
}

/**
 * Returns the actual logged-in user ID (for audit trails and notifications).
 */
export async function getActorUserId(request?: NextRequest): Promise<number | null> {
  const payload = await getTokenPayload(request);
  if (!payload) return null;
  return payload.actorId ?? payload.id;
}

/**
 * Returns the partner ID linked to the logged-in user, if any.
 */
export async function getLinkedPartnerId(request?: NextRequest): Promise<number | null> {
  const payload = await getTokenPayload(request);
  if (!payload?.partnerId) return null;
  return payload.partnerId;
}

export async function isResourceOwner(request: NextRequest | undefined, createdById: number): Promise<boolean> {
  const currentUserId = await getCurrentUserId(request);

  if (!currentUserId) {
    return false;
  }

  return currentUserId === createdById;
}

export async function isAdmin(request?: NextRequest): Promise<boolean> {
  try {
    const payload = await getTokenPayload(request);
    if (!payload) return false;
    return payload.role === 'admin' || payload.role === 'partner';
  } catch (error) {
    console.error('Error checking if user is admin:', error);
    return false;
  }
}

export async function isPrimaryAdmin(request?: NextRequest): Promise<boolean> {
  const actorId = await getActorUserId(request);
  if (!actorId) return false;

  const { default: prisma } = await import('./prisma');
  const user = await prisma.user.findUnique({
    where: { id: actorId },
    select: { dataOwnerId: true, role: true },
  });

  return !!user && user.role === 'admin' && !user.dataOwnerId;
}
