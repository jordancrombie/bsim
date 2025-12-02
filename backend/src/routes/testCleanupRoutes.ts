import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

/**
 * Test cleanup routes for E2E testing
 *
 * These endpoints delete test users created during E2E test runs.
 * Only users with @testuser.banksim.ca email domain are affected.
 *
 * SECURITY: These endpoints are protected by a secret key that must
 * be provided in the X-Test-Cleanup-Key header.
 */

const TEST_EMAIL_DOMAIN = '@testuser.banksim.ca';

export function createTestCleanupRoutes(prisma: PrismaClient): Router {
  const router = Router();

  // Middleware to verify cleanup key
  const verifyCleanupKey = (req: Request, res: Response, next: Function) => {
    const cleanupKey = process.env.TEST_CLEANUP_KEY;

    // If no cleanup key is configured, disable the endpoint
    if (!cleanupKey) {
      return res.status(503).json({
        error: 'Test cleanup endpoint not configured',
        message: 'Set TEST_CLEANUP_KEY environment variable to enable',
      });
    }

    const providedKey = req.headers['x-test-cleanup-key'];

    if (providedKey !== cleanupKey) {
      return res.status(401).json({ error: 'Invalid cleanup key' });
    }

    next();
  };

  /**
   * DELETE /api/test-cleanup/users
   * Delete all test users (those with @testuser.banksim.ca email)
   */
  router.delete('/users', verifyCleanupKey, async (req: Request, res: Response) => {
    try {
      // Find all test users
      const testUsers = await prisma.user.findMany({
        where: {
          email: {
            endsWith: TEST_EMAIL_DOMAIN,
          },
        },
        select: {
          id: true,
          email: true,
        },
      });

      if (testUsers.length === 0) {
        return res.json({
          message: 'No test users found',
          deletedCount: 0,
        });
      }

      // Delete all test users (cascading deletes handle related records)
      const result = await prisma.user.deleteMany({
        where: {
          email: {
            endsWith: TEST_EMAIL_DOMAIN,
          },
        },
      });

      console.log(`[Test Cleanup] Deleted ${result.count} test users`);

      return res.json({
        message: `Deleted ${result.count} test users`,
        deletedCount: result.count,
        deletedEmails: testUsers.map(u => u.email),
      });
    } catch (error) {
      console.error('[Test Cleanup] Error deleting test users:', error);
      return res.status(500).json({
        error: 'Failed to delete test users',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/test-cleanup/users/count
   * Get count of test users (for monitoring)
   */
  router.get('/users/count', verifyCleanupKey, async (req: Request, res: Response) => {
    try {
      const count = await prisma.user.count({
        where: {
          email: {
            endsWith: TEST_EMAIL_DOMAIN,
          },
        },
      });

      return res.json({
        count,
        domain: TEST_EMAIL_DOMAIN,
      });
    } catch (error) {
      console.error('[Test Cleanup] Error counting test users:', error);
      return res.status(500).json({
        error: 'Failed to count test users',
      });
    }
  });

  return router;
}
