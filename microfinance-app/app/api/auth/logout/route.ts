import { NextResponse } from 'next/server';
import { apiCache } from '@/lib/cache';


// Use ISR with a 5-minute revalidation period
export const revalidate = 300; // 5 minutes
export async function POST() {
  try {
    // Create a response
    const response = NextResponse.json({ success: true });

    // Clear the auth token cookie
    response.cookies.set({
      name: 'auth_token',
      value: '',
      expires: new Date(0),
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'An error occurred during logout' },
      { status: 500 }
    );
  }
}
