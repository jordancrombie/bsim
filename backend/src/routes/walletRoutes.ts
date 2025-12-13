import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config/env';

/**
 * Wallet API Routes
 *
 * These endpoints are called by digital wallet providers (e.g., WSIM) to:
 * - Get user's cards for wallet display
 * - Generate ephemeral payment tokens
 * - Check credential status
 * - Revoke credentials
 *
 * Authentication methods:
 * 1. WalletCredential token (for existing OIDC flow)
 * 2. cardToken JWT (for embedded enrollment flow - server-to-server card fetch)
 */

// Extend Request to include wallet credential info
interface WalletRequest extends Request {
  walletCredential?: {
    id: string;
    userId: string;
    walletId: string;
    permittedCards: string[];
    scopes: string[];
  };
  // For cardToken authentication (embedded enrollment flow)
  cardTokenAuth?: {
    userId: string;
    scope: string;
  };
}

// JWT secret for wallet credentials (should match auth-server)
const WALLET_CREDENTIAL_SECRET = process.env.WALLET_CREDENTIAL_SECRET || process.env.JWT_SECRET || 'wallet-credential-secret';

export function createWalletRoutes(prisma: PrismaClient): Router {
  const router = Router();

  // Wallet credential authentication middleware
  const authenticateWalletCredential = async (req: WalletRequest, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No wallet credential provided' });
      }

      const token = authHeader.substring(7);

      // First, check if this token exists in the database and is valid
      const credential = await prisma.walletCredential.findUnique({
        where: { credentialToken: token },
      });

      if (!credential) {
        return res.status(401).json({ error: 'Invalid wallet credential' });
      }

      if (credential.revokedAt) {
        return res.status(401).json({ error: 'Wallet credential has been revoked' });
      }

      if (credential.expiresAt < new Date()) {
        return res.status(401).json({ error: 'Wallet credential has expired' });
      }

      // Update lastUsedAt
      await prisma.walletCredential.update({
        where: { id: credential.id },
        data: { lastUsedAt: new Date() },
      });

      // Attach credential info to request
      req.walletCredential = {
        id: credential.id,
        userId: credential.userId,
        walletId: credential.walletId,
        permittedCards: credential.permittedCards,
        scopes: credential.scopes,
      };

      next();
    } catch (error) {
      console.error('[Wallet] Authentication error:', error);
      return res.status(401).json({ error: 'Invalid wallet credential' });
    }
  };

  /**
   * Middleware to authenticate cardToken JWT (for embedded enrollment flow)
   * This is used when WSIM calls BSIM server-to-server to fetch cards
   */
  const authenticateCardToken = async (req: WalletRequest, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No card token provided' });
      }

      const token = authHeader.substring(7);

      // Verify the cardToken JWT
      const decoded = jwt.verify(token, config.wsim.cardTokenSecret) as {
        sub: string;
        type: string;
        scope: string;
      };

      // Validate token type
      if (decoded.type !== 'wallet_card_access') {
        return res.status(401).json({ error: 'Invalid token type' });
      }

      // Attach auth info to request
      req.cardTokenAuth = {
        userId: decoded.sub,
        scope: decoded.scope,
      };

      next();
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return res.status(401).json({ error: 'Card token has expired' });
      }
      if (error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({ error: 'Invalid card token' });
      }
      console.error('[Wallet] Card token authentication error:', error);
      return res.status(401).json({ error: 'Authentication failed' });
    }
  };

  /**
   * GET /api/wallet/cards
   * Get user's cards (masked) for wallet display
   * Supports two authentication methods:
   * 1. WalletCredential token - returns only permitted cards
   * 2. cardToken JWT - returns all user's cards (for enrollment flow)
   */
  router.get('/cards', authenticateWalletCredential, async (req: WalletRequest, res: Response) => {
    try {
      const { userId, permittedCards, scopes } = req.walletCredential!;

      // Check if wallet has permission to read cards
      if (!scopes.includes('cards:read')) {
        return res.status(403).json({ error: 'Wallet does not have permission to read cards' });
      }

      // Get user's credit cards that are permitted
      const cards = await prisma.creditCard.findMany({
        where: {
          userId,
          id: { in: permittedCards },
        },
        select: {
          id: true,
          cardNumber: true,
          cardType: true,
          cardHolder: true,
          expiryMonth: true,
          expiryYear: true,
          // Don't include CVV or full card number
        },
      });

      // Mask card numbers (show only last 4 digits)
      const maskedCards = cards.map(card => ({
        id: card.id,
        cardType: card.cardType,
        cardHolder: card.cardHolder,
        lastFour: card.cardNumber.slice(-4),
        expiryMonth: card.expiryMonth,
        expiryYear: card.expiryYear,
      }));

      res.json({ cards: maskedCards });
    } catch (error) {
      console.error('[Wallet] Get cards error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/wallet/cards/enroll
   * Get ALL user's cards for enrollment selection
   * Uses cardToken JWT authentication (server-to-server from WSIM)
   * This endpoint is called by WSIM during the embedded enrollment flow
   */
  router.get('/cards/enroll', authenticateCardToken, async (req: WalletRequest, res: Response) => {
    try {
      const { userId, scope } = req.cardTokenAuth!;

      // Check if token has cards:read scope
      if (!scope.includes('cards:read')) {
        return res.status(403).json({ error: 'Token does not have permission to read cards' });
      }

      // Get ALL user's credit cards (for enrollment selection)
      const cards = await prisma.creditCard.findMany({
        where: { userId },
        select: {
          id: true,
          cardNumber: true,
          cardType: true,
          cardHolder: true,
          expiryMonth: true,
          expiryYear: true,
          // Don't include CVV or full card number
        },
      });

      // Mask card numbers (show only last 4 digits)
      const maskedCards = cards.map(card => ({
        id: card.id,
        cardType: card.cardType,
        cardHolder: card.cardHolder,
        lastFour: card.cardNumber.slice(-4),
        expiryMonth: card.expiryMonth,
        expiryYear: card.expiryYear,
      }));

      console.log(`[Wallet] Enrollment card fetch: ${maskedCards.length} cards for user ${userId.substring(0, 8)}...`);

      res.json({ cards: maskedCards });
    } catch (error) {
      console.error('[Wallet] Get enrollment cards error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * POST /api/wallet/tokens
   * Generate ephemeral payment token for a card
   * Token is short-lived and contains routing info for NSIM
   */
  router.post('/tokens', authenticateWalletCredential, async (req: WalletRequest, res: Response) => {
    try {
      const { userId, walletId, permittedCards, scopes } = req.walletCredential!;
      const { cardId, merchantId, amount, currency } = req.body;

      // Check if wallet has permission to create payments
      if (!scopes.includes('payments:create')) {
        return res.status(403).json({ error: 'Wallet does not have permission to create payments' });
      }

      // Validate required fields
      if (!cardId) {
        return res.status(400).json({ error: 'cardId is required' });
      }

      // Check if card is permitted
      if (!permittedCards.includes(cardId)) {
        return res.status(403).json({ error: 'Card is not enrolled in this wallet' });
      }

      // Get the card
      const card = await prisma.creditCard.findUnique({
        where: { id: cardId, userId },
        include: { user: { select: { fiUserRef: true } } },
      });

      if (!card) {
        return res.status(404).json({ error: 'Card not found' });
      }

      // Generate ephemeral token (short-lived, 5 minutes)
      const tokenPayload = {
        type: 'wallet_payment_token',
        cardId: card.id,
        fiUserRef: card.user.fiUserRef,
        walletId,
        merchantId,
        amount,
        currency: currency || 'CAD',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 300, // 5 minutes
      };

      // Create a unique token ID
      const tokenId = crypto.randomBytes(16).toString('hex');

      // Create the payment token - this will be validated by BSIM when the payment comes through NSIM
      const paymentToken = jwt.sign(
        { ...tokenPayload, jti: tokenId },
        WALLET_CREDENTIAL_SECRET,
        { algorithm: 'HS256' }
      );

      // Store a reference to this token in PaymentConsent for validation
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      await prisma.paymentConsent.create({
        data: {
          cardToken: tokenId,
          userId,
          creditCardId: cardId,
          merchantId: merchantId || 'wallet-payment',
          merchantName: 'Wallet Payment',
          expiresAt,
        },
      });

      console.log(`[Wallet] Generated payment token for card ${cardId.substring(0, 8)}...`);

      res.json({
        token: paymentToken,
        tokenId,
        expiresAt: expiresAt.toISOString(),
        cardInfo: {
          lastFour: card.cardNumber.slice(-4),
          cardType: card.cardType,
        },
      });
    } catch (error) {
      console.error('[Wallet] Generate token error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/wallet/credentials/:id/status
   * Check credential validity
   */
  router.get('/credentials/:id/status', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const credential = await prisma.walletCredential.findUnique({
        where: { id },
        select: {
          id: true,
          walletId: true,
          walletName: true,
          issuedAt: true,
          expiresAt: true,
          revokedAt: true,
          lastUsedAt: true,
          scopes: true,
          permittedCards: true,
        },
      });

      if (!credential) {
        return res.status(404).json({ error: 'Credential not found' });
      }

      const isValid = !credential.revokedAt && credential.expiresAt > new Date();

      res.json({
        id: credential.id,
        walletId: credential.walletId,
        walletName: credential.walletName,
        isValid,
        issuedAt: credential.issuedAt,
        expiresAt: credential.expiresAt,
        revokedAt: credential.revokedAt,
        lastUsedAt: credential.lastUsedAt,
        cardCount: credential.permittedCards.length,
        scopes: credential.scopes,
      });
    } catch (error) {
      console.error('[Wallet] Credential status error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * POST /api/wallet/credentials/:id/revoke
   * Revoke a wallet credential
   * Can be called by the user (via BSIM UI) or by the wallet
   */
  router.post('/credentials/:id/revoke', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Check if credential exists
      const credential = await prisma.walletCredential.findUnique({
        where: { id },
      });

      if (!credential) {
        return res.status(404).json({ error: 'Credential not found' });
      }

      if (credential.revokedAt) {
        return res.status(400).json({ error: 'Credential is already revoked' });
      }

      // Revoke the credential
      await prisma.walletCredential.update({
        where: { id },
        data: { revokedAt: new Date() },
      });

      console.log(`[Wallet] Credential ${id} revoked`);

      res.json({ success: true, message: 'Credential revoked successfully' });
    } catch (error) {
      console.error('[Wallet] Revoke credential error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
