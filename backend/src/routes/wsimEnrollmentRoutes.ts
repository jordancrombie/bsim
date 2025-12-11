import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config/env';
import { authMiddleware, AuthRequest } from '../middleware/auth';

/**
 * WSIM Enrollment Routes
 *
 * These endpoints support the embedded WSIM enrollment flow, allowing
 * BSIM users to enroll in WSIM Wallet directly from the bank's website.
 *
 * Reference: /Users/jcrombie/ai/wsim/docs/BSIM_ENROLLMENT_INTEGRATION.md
 */

interface EnrollmentClaims {
  sub: string;
  email: string;
  given_name?: string;
  family_name?: string;
}

interface EnrollmentDataResponse {
  claims: EnrollmentClaims;
  cardToken: string;
  bsimId: string;
  signature: string;
  timestamp: number;
}

/**
 * Generate HMAC-SHA256 signature for enrollment payload
 */
function generateEnrollmentSignature(
  claims: EnrollmentClaims,
  cardToken: string,
  bsimId: string,
  timestamp: number
): string {
  const payload = JSON.stringify({
    claims,
    cardToken,
    bsimId,
    timestamp,
  });

  return crypto
    .createHmac('sha256', config.wsim.sharedSecret)
    .update(payload)
    .digest('hex');
}

export function createWsimEnrollmentRoutes(prisma: PrismaClient): Router {
  const router = Router();

  /**
   * POST /api/wsim/enrollment-data
   *
   * Generates signed enrollment data for the embedded WSIM enrollment flow.
   * Returns user claims, a cardToken for server-to-server card fetch, and HMAC signature.
   *
   * The cardToken is a short-lived JWT (5 minutes) that WSIM will use to fetch
   * the user's cards from BSIM's /api/wallet/cards endpoint.
   */
  router.post('/enrollment-data', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Get user details
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if user has any credit cards
      const cardCount = await prisma.creditCard.count({
        where: { userId },
      });

      if (cardCount === 0) {
        return res.status(400).json({
          error: 'No cards available',
          message: 'You need at least one credit card to enroll in Wallet Pay',
        });
      }

      // Generate a short-lived card access token (5 minutes)
      const cardToken = jwt.sign(
        {
          sub: userId,
          type: 'wallet_card_access',
          scope: 'cards:read',
        },
        config.wsim.cardTokenSecret,
        { expiresIn: '5m' }
      );

      const timestamp = Date.now();

      // Build claims object
      const claims: EnrollmentClaims = {
        sub: userId,
        email: user.email,
        given_name: user.firstName || undefined,
        family_name: user.lastName || undefined,
      };

      // Generate HMAC signature
      const signature = generateEnrollmentSignature(
        claims,
        cardToken,
        config.wsim.bsimId,
        timestamp
      );

      const response: EnrollmentDataResponse = {
        claims,
        cardToken,
        bsimId: config.wsim.bsimId,
        signature,
        timestamp,
      };

      console.log(`[WSIM Enrollment] Generated enrollment data for user ${userId.substring(0, 8)}...`);

      res.json(response);
    } catch (error) {
      console.error('[WSIM Enrollment] Error generating enrollment data:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/wsim/enrollment-status
   *
   * Check if the current user is enrolled in WSIM Wallet.
   * Returns enrollment status and wallet details if enrolled.
   */
  router.get('/enrollment-status', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Check for active wallet credentials
      const walletCredential = await prisma.walletCredential.findFirst({
        where: {
          userId,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        select: {
          id: true,
          walletId: true,
          walletName: true,
          issuedAt: true,
          expiresAt: true,
          permittedCards: true,
        },
        orderBy: {
          issuedAt: 'desc',
        },
      });

      if (walletCredential) {
        res.json({
          enrolled: true,
          walletId: walletCredential.walletId,
          walletName: walletCredential.walletName,
          enrolledAt: walletCredential.issuedAt,
          expiresAt: walletCredential.expiresAt,
          cardCount: walletCredential.permittedCards.length,
        });
      } else {
        // Check if user has cards available for enrollment
        const cardCount = await prisma.creditCard.count({
          where: { userId },
        });

        res.json({
          enrolled: false,
          canEnroll: cardCount > 0,
          cardCount,
        });
      }
    } catch (error) {
      console.error('[WSIM Enrollment] Error checking enrollment status:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/wsim/config
   *
   * Returns WSIM configuration for the frontend.
   * This allows the frontend to know the WSIM auth URL without hardcoding it.
   */
  router.get('/config', (_req: Request, res: Response) => {
    res.json({
      authUrl: config.wsim.authUrl,
      bsimId: config.wsim.bsimId,
    });
  });

  return router;
}
