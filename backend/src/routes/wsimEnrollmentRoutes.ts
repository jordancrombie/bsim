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
   * POST /api/wsim/enrollment-complete
   *
   * Records a successful embedded enrollment.
   * Called by the frontend when the WSIM popup reports successful enrollment.
   * Creates a WalletCredential record to track the enrollment on BSIM side.
   */
  router.post('/enrollment-complete', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { walletId, cardsEnrolled } = req.body as {
        walletId: string;
        cardsEnrolled?: number;
      };

      if (!walletId) {
        return res.status(400).json({ error: 'walletId is required' });
      }

      // Check if user already has an active credential for this wallet
      const existingCredential = await prisma.walletCredential.findFirst({
        where: {
          userId,
          walletId,
          revokedAt: null,
        },
      });

      if (existingCredential) {
        // Update existing credential
        const updated = await prisma.walletCredential.update({
          where: { id: existingCredential.id },
          data: {
            lastUsedAt: new Date(),
            // Extend expiry if enrolling again
            expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
          },
        });

        console.log(`[WSIM Enrollment] Updated existing enrollment for user ${userId.substring(0, 8)}...`);

        return res.json({
          success: true,
          credentialId: updated.id,
          updated: true,
        });
      }

      // Get user's credit card IDs to store as permitted cards
      const userCards = await prisma.creditCard.findMany({
        where: { userId },
        select: { id: true },
      });

      const permittedCards = userCards.map(c => c.id);

      // Create a new wallet credential record
      const credential = await prisma.walletCredential.create({
        data: {
          userId,
          walletId,
          walletName: 'Wallet Simulator',
          credentialToken: crypto.randomUUID(), // Generate a unique token
          permittedCards,
          scopes: ['cards:read', 'payments:create'],
          issuedAt: new Date(),
          expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
        },
      });

      console.log(`[WSIM Enrollment] Recorded new enrollment for user ${userId.substring(0, 8)}..., walletId: ${walletId}, cards: ${cardsEnrolled || permittedCards.length}`);

      res.json({
        success: true,
        credentialId: credential.id,
        updated: false,
      });
    } catch (error) {
      console.error('[WSIM Enrollment] Error recording enrollment:', error);
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

  /**
   * GET /api/wsim/sso-url
   *
   * Generates a server-side SSO URL for opening WSIM Wallet.
   * This provides true SSO - works on any device/browser as long as the user is logged into BSIM.
   *
   * Flow:
   * 1. BSIM backend calls WSIM's /api/partner/sso-token endpoint (server-to-server)
   * 2. WSIM validates the request and returns a short-lived SSO token
   * 3. BSIM frontend receives the SSO URL and opens it
   * 4. User is automatically logged into WSIM
   */
  router.get('/sso-url', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Check if user is enrolled in WSIM
      const walletCredential = await prisma.walletCredential.findFirst({
        where: {
          userId,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
      });

      if (!walletCredential) {
        return res.status(400).json({
          error: 'Not enrolled',
          message: 'You must be enrolled in WSIM Wallet to use SSO',
        });
      }

      // Build the SSO request payload
      const timestamp = Date.now();
      const payload = {
        bsimId: config.wsim.bsimId,
        bsimUserId: userId,
        timestamp,
      };

      // Generate HMAC signature
      const signedData = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha256', config.wsim.sharedSecret)
        .update(signedData)
        .digest('hex');

      // Derive the WSIM API URL from the auth URL (wsim-auth-dev.banksim.ca -> wsim-dev.banksim.ca)
      const wsimApiUrl = config.wsim.authUrl.replace('-auth', '');

      // Call WSIM's partner SSO endpoint
      const response = await fetch(`${wsimApiUrl}/api/partner/sso-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, signature }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[WSIM SSO] Failed to get SSO token:', response.status, errorData);

        if (response.status === 404) {
          return res.status(400).json({
            error: 'Not enrolled in WSIM',
            message: 'Your WSIM enrollment may have expired. Please re-enroll.',
          });
        }

        return res.status(response.status).json({
          error: 'SSO failed',
          message: 'Failed to generate SSO URL. Please try again.',
        });
      }

      const data = await response.json();

      console.log(`[WSIM SSO] Generated SSO URL for user ${userId.substring(0, 8)}...`);

      res.json({
        ssoUrl: data.ssoUrl,
        expiresIn: data.expiresIn,
      });
    } catch (error) {
      console.error('[WSIM SSO] Error generating SSO URL:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
