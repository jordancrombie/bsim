import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/invites/validate - Validate an invite code (public endpoint)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json(
        { error: 'Invite code is required' },
        { status: 400 }
      );
    }

    // Normalize the code (remove dashes, uppercase)
    const normalizedCode = code.replace(/-/g, '').toUpperCase();
    // Reconstruct with dashes for lookup
    const formattedCode = normalizedCode.length === 12
      ? `${normalizedCode.slice(0, 4)}-${normalizedCode.slice(4, 8)}-${normalizedCode.slice(8, 12)}`
      : code.toUpperCase();

    const invite = await prisma.adminInvite.findUnique({
      where: { code: formattedCode },
      include: {
        createdBy: {
          select: { firstName: true, lastName: true },
        },
      },
    });

    if (!invite) {
      return NextResponse.json(
        { valid: false, error: 'Invalid invite code' },
        { status: 404 }
      );
    }

    // Check if already used
    if (invite.usedAt) {
      return NextResponse.json(
        { valid: false, error: 'This invite has already been used' },
        { status: 400 }
      );
    }

    // Check if revoked
    if (invite.revokedAt) {
      return NextResponse.json(
        { valid: false, error: 'This invite has been revoked' },
        { status: 400 }
      );
    }

    // Check if expired
    if (new Date() > invite.expiresAt) {
      return NextResponse.json(
        { valid: false, error: 'This invite has expired' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      invite: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        expiresAt: invite.expiresAt,
        createdBy: `${invite.createdBy.firstName} ${invite.createdBy.lastName}`,
      },
    });
  } catch (error) {
    console.error('Failed to validate invite:', error);
    return NextResponse.json(
      { error: 'Failed to validate invite' },
      { status: 500 }
    );
  }
}
