import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// DELETE /api/invites/[id] - Revoke an invite (Super Admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is super admin
    const admin = await prisma.adminUser.findUnique({
      where: { id: session.userId },
    });

    if (!admin || admin.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Only Super Admins can revoke invites' },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Find the invite
    const invite = await prisma.adminInvite.findUnique({
      where: { id },
    });

    if (!invite) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    }

    // Can't revoke already used invites
    if (invite.usedAt) {
      return NextResponse.json(
        { error: 'Cannot revoke an invite that has already been used' },
        { status: 400 }
      );
    }

    // Revoke the invite
    const updatedInvite = await prisma.adminInvite.update({
      where: { id },
      data: { revokedAt: new Date() },
    });

    return NextResponse.json({ invite: updatedInvite });
  } catch (error) {
    console.error('Failed to revoke invite:', error);
    return NextResponse.json(
      { error: 'Failed to revoke invite' },
      { status: 500 }
    );
  }
}
