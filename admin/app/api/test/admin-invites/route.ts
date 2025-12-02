import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';

/**
 * Test Admin Invite Endpoint
 *
 * This endpoint creates admin invites for E2E testing without requiring
 * Super Admin authentication. It is protected by a secret key and only
 * creates invites for test admin emails (@testadmin.banksim.ca).
 *
 * SECURITY:
 * - Only enabled when TEST_ADMIN_KEY env var is set
 * - Only creates invites for @testadmin.banksim.ca emails
 * - Test invites expire in 5 minutes
 * - Can only create ADMIN role, never SUPER_ADMIN
 */

const TEST_ADMIN_EMAIL_DOMAIN = '@testadmin.banksim.ca';
const TEST_INVITE_EXPIRY_MINUTES = 5;

// Generate a short, readable invite code
function generateInviteCode(): string {
  const bytes = randomBytes(6);
  const hex = bytes.toString('hex').toUpperCase();
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
}

// Middleware to verify test admin key
function verifyTestAdminKey(request: NextRequest): NextResponse | null {
  const testAdminKey = process.env.TEST_ADMIN_KEY;

  // If no test admin key is configured, disable the endpoint
  if (!testAdminKey) {
    return NextResponse.json(
      {
        error: 'Test admin endpoint not configured',
        message: 'Set TEST_ADMIN_KEY environment variable to enable',
      },
      { status: 503 }
    );
  }

  const providedKey = request.headers.get('x-test-admin-key');

  if (providedKey !== testAdminKey) {
    return NextResponse.json({ error: 'Invalid test admin key' }, { status: 401 });
  }

  return null; // Key is valid
}

/**
 * POST /api/test/admin-invites
 * Create a test admin invite for E2E testing
 */
export async function POST(request: NextRequest) {
  // Verify test admin key
  const keyError = verifyTestAdminKey(request);
  if (keyError) return keyError;

  try {
    const body = await request.json();
    const { email, role = 'ADMIN' } = body;

    // Validate email domain
    if (!email || !email.endsWith(TEST_ADMIN_EMAIL_DOMAIN)) {
      return NextResponse.json(
        {
          error: `Email must end with ${TEST_ADMIN_EMAIL_DOMAIN}`,
          message: 'Test invites can only be created for test admin emails',
        },
        { status: 400 }
      );
    }

    // Only allow ADMIN role for test invites (never SUPER_ADMIN)
    if (role !== 'ADMIN') {
      return NextResponse.json(
        {
          error: 'Test invites can only create ADMIN role',
          message: 'SUPER_ADMIN creation via test endpoint is not allowed',
        },
        { status: 400 }
      );
    }

    // Check if admin already exists
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
      // Return existing invite code
      console.log(`[Test Admin] Returning existing invite for ${email}`);
      return NextResponse.json({
        code: existingInvite.code,
        email: existingInvite.email,
        role: existingInvite.role,
        expiresAt: existingInvite.expiresAt,
        existing: true,
      });
    }

    // Calculate short expiration (5 minutes for test invites)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + TEST_INVITE_EXPIRY_MINUTES);

    // Generate unique invite code
    let code = generateInviteCode();
    let attempts = 0;
    while (attempts < 5) {
      const existing = await prisma.adminInvite.findUnique({ where: { code } });
      if (!existing) break;
      code = generateInviteCode();
      attempts++;
    }

    // We need a creator for the invite - use a system placeholder
    // First, check if we have any super admin (for foreign key requirement)
    let creatorId: string;
    const superAdmin = await prisma.adminUser.findFirst({
      where: { role: 'SUPER_ADMIN' },
    });

    if (superAdmin) {
      creatorId = superAdmin.id;
    } else {
      // Create a system admin if none exists (edge case for fresh installs)
      // This shouldn't happen in practice since we need at least one super admin
      return NextResponse.json(
        {
          error: 'No super admin exists to create invites',
          message: 'At least one super admin must exist before test invites can be created',
        },
        { status: 503 }
      );
    }

    // Create the test invite
    const invite = await prisma.adminInvite.create({
      data: {
        code,
        email,
        role: 'ADMIN',
        createdById: creatorId,
        expiresAt,
      },
    });

    console.log(`[Test Admin] Created test invite for ${email}, code: ${code}`);

    return NextResponse.json(
      {
        code: invite.code,
        email: invite.email,
        role: invite.role,
        expiresAt: invite.expiresAt,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[Test Admin] Error creating test invite:', error);
    return NextResponse.json(
      {
        error: 'Failed to create test invite',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/test/admin-invites
 * Delete all test admin invites (@testadmin.banksim.ca)
 */
export async function DELETE(request: NextRequest) {
  // Verify test admin key
  const keyError = verifyTestAdminKey(request);
  if (keyError) return keyError;

  try {
    // Find all test admin invites
    const testInvites = await prisma.adminInvite.findMany({
      where: {
        email: {
          endsWith: TEST_ADMIN_EMAIL_DOMAIN,
        },
      },
      select: {
        id: true,
        email: true,
        code: true,
      },
    });

    if (testInvites.length === 0) {
      return NextResponse.json({
        message: 'No test admin invites found',
        deletedCount: 0,
      });
    }

    // Delete all test admin invites
    const result = await prisma.adminInvite.deleteMany({
      where: {
        email: {
          endsWith: TEST_ADMIN_EMAIL_DOMAIN,
        },
      },
    });

    console.log(`[Test Admin] Deleted ${result.count} test admin invites`);

    return NextResponse.json({
      message: `Deleted ${result.count} test admin invites`,
      deletedCount: result.count,
      deletedEmails: testInvites.map((i) => i.email),
    });
  } catch (error) {
    console.error('[Test Admin] Error deleting test invites:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete test invites',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/test/admin-invites
 * Get count of test admin invites (for monitoring)
 */
export async function GET(request: NextRequest) {
  // Verify test admin key
  const keyError = verifyTestAdminKey(request);
  if (keyError) return keyError;

  try {
    const count = await prisma.adminInvite.count({
      where: {
        email: {
          endsWith: TEST_ADMIN_EMAIL_DOMAIN,
        },
      },
    });

    return NextResponse.json({
      count,
      domain: TEST_ADMIN_EMAIL_DOMAIN,
    });
  } catch (error) {
    console.error('[Test Admin] Error counting test invites:', error);
    return NextResponse.json(
      { error: 'Failed to count test invites' },
      { status: 500 }
    );
  }
}
