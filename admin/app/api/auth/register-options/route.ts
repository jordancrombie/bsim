import { NextRequest, NextResponse } from 'next/server';
import { generateAdminRegistrationOptions } from '@/lib/passkey';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, firstName, lastName, inviteCode } = body;

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

    // Check for invite-based registration
    if (inviteCode) {
      if (!email || !firstName || !lastName) {
        return NextResponse.json(
          { error: 'Email, firstName, and lastName are required' },
          { status: 400 }
        );
      }

      // Normalize the code
      const normalizedCode = inviteCode.replace(/-/g, '').toUpperCase();
      const formattedCode = normalizedCode.length === 12
        ? `${normalizedCode.slice(0, 4)}-${normalizedCode.slice(4, 8)}-${normalizedCode.slice(8, 12)}`
        : inviteCode.toUpperCase();

      // Find and validate the invite
      const invite = await prisma.adminInvite.findUnique({
        where: { code: formattedCode },
      });

      if (!invite) {
        return NextResponse.json(
          { error: 'Invalid invite code' },
          { status: 400 }
        );
      }

      if (invite.usedAt) {
        return NextResponse.json(
          { error: 'This invite has already been used' },
          { status: 400 }
        );
      }

      if (invite.revokedAt) {
        return NextResponse.json(
          { error: 'This invite has been revoked' },
          { status: 400 }
        );
      }

      if (new Date() > invite.expiresAt) {
        return NextResponse.json(
          { error: 'This invite has expired' },
          { status: 400 }
        );
      }

      // If invite has restricted email, check it matches
      if (invite.email && invite.email.toLowerCase() !== email.toLowerCase()) {
        return NextResponse.json(
          { error: 'This invite is restricted to a different email address' },
          { status: 400 }
        );
      }

      // Check if email is already in use
      const existingAdmin = await prisma.adminUser.findUnique({
        where: { email },
      });

      if (existingAdmin) {
        return NextResponse.json(
          { error: 'An admin with this email already exists' },
          { status: 400 }
        );
      }

      // Create the new admin user with the invite's role
      const admin = await prisma.adminUser.create({
        data: {
          email,
          firstName,
          lastName,
          role: invite.role,
        },
      });

      // Mark the invite as used
      await prisma.adminInvite.update({
        where: { id: invite.id },
        data: {
          usedById: admin.id,
          usedAt: new Date(),
        },
      });

      const options = await generateAdminRegistrationOptions(admin.id);

      return NextResponse.json({
        options,
        adminId: admin.id,
        isInvite: true,
        role: invite.role,
      });
    }

    // For subsequent registrations (adding passkeys), require authentication
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
