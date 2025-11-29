import { NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/auth';

export async function GET() {
  try {
    const admin = await getCurrentAdmin();

    if (!admin) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    return NextResponse.json({ admin });
  } catch (error) {
    console.error('Failed to get current admin:', error);
    return NextResponse.json(
      { error: 'Failed to get current admin' },
      { status: 500 }
    );
  }
}
