import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const adminCount = await prisma.adminUser.count();

    return NextResponse.json({
      needsSetup: adminCount === 0,
      adminCount,
    });
  } catch (error) {
    console.error('Failed to check setup status:', error);
    return NextResponse.json(
      { error: 'Failed to check setup status' },
      { status: 500 }
    );
  }
}
