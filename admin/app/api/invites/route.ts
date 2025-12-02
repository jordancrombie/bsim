import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';

// Generate a short, readable invite code
function generateInviteCode(): string {
  // Generate 6 bytes = 12 hex characters, then format as XXX-XXX-XXX
  const bytes = randomBytes(6);
  const hex = bytes.toString('hex').toUpperCase();
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
}

// GET /api/invites - List all invites (Super Admin only)
export async function GET() {
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
        { error: 'Only Super Admins can manage invites' },
        { status: 403 }
      );
    }

    const invites = await prisma.adminInvite.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        usedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    return NextResponse.json({ invites });
  } catch (error) {
    console.error('Failed to fetch invites:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invites' },
      { status: 500 }
    );
  }
}

// POST /api/invites - Create a new invite (Super Admin only)
export async function POST(request: NextRequest) {
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
        { error: 'Only Super Admins can create invites' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email, role = 'ADMIN', expiresInDays = 7 } = body;

    // Validate role
    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Invalid role. Must be ADMIN or SUPER_ADMIN' },
        { status: 400 }
      );
    }

    // If email is provided, check it's not already in use
    if (email) {
      const existingAdmin = await prisma.adminUser.findUnique({
        where: { email },
      });
      if (existingAdmin) {
        return NextResponse.json(
          { error: 'An admin with this email already exists' },
          { status: 400 }
        );
      }

      // Check for existing pending invite for this email
      const existingInvite = await prisma.adminInvite.findFirst({
        where: {
          email,
          usedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
      });
      if (existingInvite) {
        return NextResponse.json(
          { error: 'A pending invite for this email already exists' },
          { status: 400 }
        );
      }
    }

    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Generate unique invite code
    let code = generateInviteCode();
    let attempts = 0;
    while (attempts < 5) {
      const existing = await prisma.adminInvite.findUnique({ where: { code } });
      if (!existing) break;
      code = generateInviteCode();
      attempts++;
    }

    // Create the invite
    const invite = await prisma.adminInvite.create({
      data: {
        code,
        email: email || null,
        role,
        createdById: session.userId,
        expiresAt,
      },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    return NextResponse.json({ invite }, { status: 201 });
  } catch (error) {
    console.error('Failed to create invite:', error);
    return NextResponse.json(
      { error: 'Failed to create invite' },
      { status: 500 }
    );
  }
}
