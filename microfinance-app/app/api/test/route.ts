import { NextResponse } from 'next/server';
import { apiCache } from '@/lib/cache';

export const dynamic = 'force-dynamic'; // Ensure the route is not statically optimized


// Use ISR with a 5-minute revalidation period
export const revalidate = 300; // 5 minutes
export async function GET() {
  console.log('Test API route called');
  try {
    return NextResponse.json({ message: 'API is working!' });
  } catch (error) {
    console.error('Error in test API:', error);
    return NextResponse.json(
      { error: 'Test API failed' },
      { status: 500 }
    );
  }
}
