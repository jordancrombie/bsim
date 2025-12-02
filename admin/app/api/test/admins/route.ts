import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Test Admin Cleanup Endpoint
 *
 * This endpoint deletes test admin users created during E2E testing.
 * Only admins with @testadmin.banksim.ca emails are affected.
 *
 * SECURITY:
 * - Only enabled when TEST_ADMIN_KEY env var is set
 * - Only deletes admins with @testadmin.banksim.ca emails
 * - Cannot delete real admin accounts
 */

const TEST_ADMIN_EMAIL_DOMAIN = '@testadmin.banksim.ca';

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
 * DELETE /api/test/admins
 * Delete all test admin users (@testadmin.banksim.ca)
 */
export async function DELETE(request: NextRequest) {
  // Verify test admin key
  const keyError = verifyTestAdminKey(request);
  if (keyError) return keyError;

  try {
    // Find all test admin users
    const testAdmins = await prisma.adminUser.findMany({
      where: {
        email: {
          endsWith: TEST_ADMIN_EMAIL_DOMAIN,
        },
      },
      select: {
        id: true,
        email: true,
      },
    });

    if (testAdmins.length === 0) {
      return NextResponse.json({
        message: 'No test admins found',
        deletedCount: 0,
      });
    }

    // Delete all test admins (cascading deletes handle passkeys and invites)
    const result = await prisma.adminUser.deleteMany({
      where: {
        email: {
          endsWith: TEST_ADMIN_EMAIL_DOMAIN,
        },
      },
    });

    console.log(`[Test Admin] Deleted ${result.count} test admin users`);

    return NextResponse.json({
      message: `Deleted ${result.count} test admin users`,
      deletedCount: result.count,
      deletedEmails: testAdmins.map((a) => a.email),
    });
  } catch (error) {
    console.error('[Test Admin] Error deleting test admins:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete test admins',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/test/admins
 * Get count of test admin users (for monitoring)
 */
export async function GET(request: NextRequest) {
  // Verify test admin key
  const keyError = verifyTestAdminKey(request);
  if (keyError) return keyError;

  try {
    const count = await prisma.adminUser.count({
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
    console.error('[Test Admin] Error counting test admins:', error);
    return NextResponse.json(
      { error: 'Failed to count test admins' },
      { status: 500 }
    );
  }
}
