import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRegistration } from '@/lib/passkey';
import { createToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { credential, adminId } = body;

    if (!adminId) {
      return NextResponse.json(
        { error: 'Admin ID is required' },
        { status: 400 }
      );
    }

    const result = await verifyAdminRegistration(adminId, credential);

    if (!result.verified) {
      return NextResponse.json(
        { error: 'Registration verification failed' },
        { status: 400 }
      );
    }

    // Get the admin user
    const admin = await prisma.adminUser.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      return NextResponse.json(
        { error: 'Admin not found' },
        { status: 404 }
      );
    }

    // Create JWT token and set cookie
    const token = await createToken({
      userId: admin.id,
      email: admin.email,
      role: admin.role,
    });

    const cookieStore = await cookies();
    cookieStore.set('admin_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return NextResponse.json({
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        firstName: admin.firstName,
        lastName: admin.lastName,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error('Failed to verify registration:', error);
    return NextResponse.json(
      { error: 'Failed to verify registration' },
      { status: 500 }
    );
  }
}
