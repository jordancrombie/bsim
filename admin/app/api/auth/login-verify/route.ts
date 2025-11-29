import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuthentication } from '@/lib/passkey';
import { createToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { credential, email } = body;

    const result = await verifyAdminAuthentication(credential, email);

    if (!result.verified || !result.admin) {
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      );
    }

    // Create JWT token
    const token = await createToken({
      userId: result.admin.id,
      email: result.admin.email,
      role: result.admin.role,
    });

    // Set cookie
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
        id: result.admin.id,
        email: result.admin.email,
        firstName: result.admin.firstName,
        lastName: result.admin.lastName,
        role: result.admin.role,
      },
    });
  } catch (error) {
    console.error('Failed to verify login:', error);
    return NextResponse.json(
      { error: 'Failed to verify login' },
      { status: 500 }
    );
  }
}
