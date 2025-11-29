import { NextRequest, NextResponse } from 'next/server';
import { generateAdminRegistrationOptions } from '@/lib/passkey';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, firstName, lastName } = body;

    // Check if this is a setup request (first admin) or authenticated request
    const session = await getSession();
    const adminCount = await prisma.adminUser.count();

    // If no admins exist, allow setup
    if (adminCount === 0) {
      if (!email || !firstName || !lastName) {
        return NextResponse.json(
          { error: 'Email, firstName, and lastName are required for setup' },
          { status: 400 }
        );
      }

      // Create the first admin user
      const admin = await prisma.adminUser.create({
        data: {
          email,
          firstName,
          lastName,
          role: 'SUPER_ADMIN',
        },
      });

      const options = await generateAdminRegistrationOptions(admin.id);

      return NextResponse.json({ options, adminId: admin.id, isSetup: true });
    }

    // For subsequent registrations, require authentication
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Generate options for the current admin to add a new passkey
    const options = await generateAdminRegistrationOptions(session.userId);

    return NextResponse.json({ options, adminId: session.userId });
  } catch (error) {
    console.error('Failed to generate registration options:', error);
    return NextResponse.json(
      { error: 'Failed to generate registration options' },
      { status: 500 }
    );
  }
}
