import { randomUUID } from 'crypto';
import { PrismaClient, PaymentAuthorizationStatus } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { IPaymentNetworkHandler } from './IPaymentNetworkHandler';
import {
  PaymentAuthorizationRequest,
  PaymentAuthorizationResponse,
  PaymentCaptureRequest,
  PaymentCaptureResponse,
  PaymentVoidRequest,
  PaymentVoidResponse,
  PaymentRefundRequest,
  PaymentRefundResponse,
} from './types';

// JWT secret for wallet payment tokens (should match walletRoutes.ts)
const WALLET_CREDENTIAL_SECRET = process.env.WALLET_CREDENTIAL_SECRET || process.env.JWT_SECRET || 'wallet-credential-secret';

/**
 * Wallet payment token payload structure
 */
interface WalletPaymentTokenPayload {
  type: 'wallet_payment_token';
  cardId: string;
  fiUserRef: string;
  walletId: string;
  merchantId: string;
  amount?: number;
  currency: string;
  jti: string;  // Token ID stored in PaymentConsent.cardToken
  iat: number;
  exp: number;
}

/**
 * Check if a token is a JWT (three base64 segments separated by dots)
 */
function isJwtToken(token: string): boolean {
  const parts = token.split('.');
  return parts.length === 3;
}

/**
 * Decode and verify a wallet payment JWT token
 * Returns the token ID (jti) if valid, null otherwise
 */
function decodeWalletPaymentToken(token: string): { tokenId: string; payload: WalletPaymentTokenPayload } | null {
  try {
    const decoded = jwt.verify(token, WALLET_CREDENTIAL_SECRET, {
      algorithms: ['HS256'],
    }) as WalletPaymentTokenPayload;

    // Verify it's a wallet payment token
    if (decoded.type !== 'wallet_payment_token') {
      console.log('[SimNetHandler] Token is not a wallet_payment_token, type:', decoded.type);
      return null;
    }

    if (!decoded.jti) {
      console.log('[SimNetHandler] Wallet token missing jti claim');
      return null;
    }

    return { tokenId: decoded.jti, payload: decoded };
  } catch (error) {
    console.error('[SimNetHandler] JWT verification failed:', error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * SimNet Payment Handler
 *
 * Implementation of IPaymentNetworkHandler for the SimNet payment network.
 * This handler processes payments from NSIM by:
 * - Validating card tokens (from PaymentConsent) - supports both direct tokens and JWT wallet tokens
 * - Creating authorization holds
 * - Processing captures against credit cards
 */
export class SimNetHandler implements IPaymentNetworkHandler {
  readonly networkId = 'simnet';

  private prisma: PrismaClient;
  private authorizationExpiryHours: number;

  constructor(prisma: PrismaClient, authorizationExpiryHours = 168) {
    this.prisma = prisma;
    this.authorizationExpiryHours = authorizationExpiryHours; // Default 7 days
  }

  async authorize(request: PaymentAuthorizationRequest): Promise<PaymentAuthorizationResponse> {
    // 1. Validate card token and get consent
    // Support both direct token IDs and JWT wallet payment tokens
    let cardTokenId = request.cardToken;
    let walletTokenPayload: WalletPaymentTokenPayload | null = null;

    // Check if this is a JWT wallet payment token
    if (isJwtToken(request.cardToken)) {
      console.log('[SimNetHandler] Detected JWT token, attempting to decode wallet_payment_token');
      const decoded = decodeWalletPaymentToken(request.cardToken);

      if (decoded) {
        cardTokenId = decoded.tokenId;
        walletTokenPayload = decoded.payload;
        console.log('[SimNetHandler] Wallet token decoded successfully:', {
          tokenId: cardTokenId.substring(0, 8) + '...',
          walletId: decoded.payload.walletId,
          cardId: decoded.payload.cardId.substring(0, 8) + '...',
        });
      } else {
        console.log('[SimNetHandler] JWT token verification failed, trying as direct token');
        // Fall through to try as direct token (backwards compatibility)
      }
    }

    const consent = await this.prisma.paymentConsent.findUnique({
      where: { cardToken: cardTokenId },
    });

    if (!consent) {
      console.log('[SimNetHandler] No consent found for token:', cardTokenId.substring(0, 8) + '...');
      return {
        status: 'declined',
        declineReason: 'Invalid card token',
      };
    }

    console.log('[SimNetHandler] Found consent:', {
      consentId: consent.id.substring(0, 8) + '...',
      merchantId: consent.merchantId,
      expiresAt: consent.expiresAt,
    });

    // Check consent is valid
    if (consent.revokedAt) {
      return {
        status: 'declined',
        declineReason: 'Consent revoked',
      };
    }

    if (consent.expiresAt < new Date()) {
      return {
        status: 'declined',
        declineReason: 'Consent expired',
      };
    }

    // Check merchant matches (skip for wallet payment tokens - they're cryptographically verified)
    // For wallet payments, the token's signature already proves it came from an authorized flow
    // The walletId in the JWT establishes the trust chain: WSIM → BSIM → NSIM → SSIM
    if (!walletTokenPayload && consent.merchantId !== request.merchantId) {
      console.log('[SimNetHandler] Merchant mismatch:', {
        consentMerchantId: consent.merchantId,
        requestMerchantId: request.merchantId,
      });
      return {
        status: 'declined',
        declineReason: 'Merchant mismatch',
      };
    }

    // For wallet tokens, log the merchant IDs for debugging but allow the transaction
    if (walletTokenPayload && consent.merchantId !== request.merchantId) {
      console.log('[SimNetHandler] Wallet payment: merchant IDs differ (allowed):', {
        consentMerchantId: consent.merchantId,
        requestMerchantId: request.merchantId,
        walletId: walletTokenPayload.walletId,
      });
    }

    // Check max amount if set
    if (consent.maxAmount && request.amount > Number(consent.maxAmount)) {
      return {
        status: 'declined',
        declineReason: 'Amount exceeds consent limit',
      };
    }

    // 2. Get credit card and check available credit
    const creditCard = await this.prisma.creditCard.findUnique({
      where: { id: consent.creditCardId },
    });

    if (!creditCard) {
      return {
        status: 'declined',
        declineReason: 'Card not found',
      };
    }

    const availableCredit = Number(creditCard.availableCredit);
    if (request.amount > availableCredit) {
      return {
        status: 'declined',
        declineReason: 'Insufficient credit',
        availableCredit,
      };
    }

    // 3. Create authorization hold
    const authorizationCode = `AUTH-${randomUUID().substring(0, 8).toUpperCase()}`;
    const expiresAt = new Date(Date.now() + this.authorizationExpiryHours * 60 * 60 * 1000);

    // Reduce available credit by authorization amount
    await this.prisma.$transaction(async (tx) => {
      // Create authorization record
      await tx.paymentAuthorization.create({
        data: {
          authorizationCode,
          consentId: consent.id,
          amount: request.amount,
          currency: request.currency,
          merchantId: request.merchantId,
          merchantName: request.merchantName,
          orderId: request.orderId,
          status: 'PENDING',
          expiresAt,
        },
      });

      // Hold the credit
      await tx.creditCard.update({
        where: { id: creditCard.id },
        data: {
          availableCredit: { decrement: request.amount },
        },
      });
    });

    return {
      status: 'approved',
      authorizationCode,
      availableCredit: availableCredit - request.amount,
    };
  }

  async capture(request: PaymentCaptureRequest): Promise<PaymentCaptureResponse> {
    const auth = await this.prisma.paymentAuthorization.findUnique({
      where: { authorizationCode: request.authorizationCode },
      include: { consent: true },
    });

    if (!auth) {
      return { success: false, error: 'Authorization not found' };
    }

    if (auth.status !== 'PENDING') {
      return { success: false, error: `Authorization is ${auth.status.toLowerCase()}` };
    }

    if (auth.expiresAt < new Date()) {
      // Mark as expired
      await this.prisma.paymentAuthorization.update({
        where: { id: auth.id },
        data: { status: 'EXPIRED' },
      });
      return { success: false, error: 'Authorization expired' };
    }

    // Capture amount can be less than or equal to authorized amount
    const captureAmount = Math.min(request.amount, Number(auth.amount));

    await this.prisma.$transaction(async (tx) => {
      // Update authorization status
      await tx.paymentAuthorization.update({
        where: { id: auth.id },
        data: {
          status: 'CAPTURED',
          capturedAmount: captureAmount,
        },
      });

      // Create credit card transaction for the charge
      const creditCard = await tx.creditCard.findUnique({
        where: { id: auth.consent.creditCardId },
      });

      if (creditCard) {
        // If capture is less than auth, release the difference
        const releaseAmount = Number(auth.amount) - captureAmount;
        if (releaseAmount > 0) {
          await tx.creditCard.update({
            where: { id: creditCard.id },
            data: {
              availableCredit: { increment: releaseAmount },
            },
          });
        }

        // Record the transaction
        await tx.creditCardTransaction.create({
          data: {
            type: 'CHARGE',
            amount: captureAmount,
            availableAfter: Number(creditCard.availableCredit) + releaseAmount,
            description: `Payment to ${auth.merchantName}`,
            merchantName: auth.merchantName,
            merchantId: auth.merchantId,
            creditCardId: creditCard.id,
          },
        });
      }
    });

    return { success: true };
  }

  async void(request: PaymentVoidRequest): Promise<PaymentVoidResponse> {
    const auth = await this.prisma.paymentAuthorization.findUnique({
      where: { authorizationCode: request.authorizationCode },
      include: { consent: true },
    });

    if (!auth) {
      return { success: false, error: 'Authorization not found' };
    }

    if (auth.status !== 'PENDING') {
      return { success: false, error: `Authorization is ${auth.status.toLowerCase()}` };
    }

    await this.prisma.$transaction(async (tx) => {
      // Update authorization status
      await tx.paymentAuthorization.update({
        where: { id: auth.id },
        data: { status: 'VOIDED' },
      });

      // Release the held credit
      await tx.creditCard.update({
        where: { id: auth.consent.creditCardId },
        data: {
          availableCredit: { increment: Number(auth.amount) },
        },
      });
    });

    return { success: true };
  }

  async refund(request: PaymentRefundRequest): Promise<PaymentRefundResponse> {
    const auth = await this.prisma.paymentAuthorization.findUnique({
      where: { authorizationCode: request.authorizationCode },
      include: { consent: true },
    });

    if (!auth) {
      return { success: false, error: 'Authorization not found' };
    }

    if (auth.status !== 'CAPTURED') {
      return { success: false, error: 'Can only refund captured payments' };
    }

    const maxRefund = Number(auth.capturedAmount);
    const refundAmount = Math.min(request.amount, maxRefund);

    if (refundAmount <= 0) {
      return { success: false, error: 'Nothing to refund' };
    }

    await this.prisma.$transaction(async (tx) => {
      // Credit back to card
      const creditCard = await tx.creditCard.findUnique({
        where: { id: auth.consent.creditCardId },
      });

      if (creditCard) {
        const newAvailable = Math.min(
          Number(creditCard.availableCredit) + refundAmount,
          Number(creditCard.creditLimit)
        );

        await tx.creditCard.update({
          where: { id: creditCard.id },
          data: { availableCredit: newAvailable },
        });

        // Record refund transaction
        await tx.creditCardTransaction.create({
          data: {
            type: 'REFUND',
            amount: refundAmount,
            availableAfter: newAvailable,
            description: `Refund from ${auth.merchantName}`,
            merchantName: auth.merchantName,
            merchantId: auth.merchantId,
            creditCardId: creditCard.id,
          },
        });
      }
    });

    return { success: true };
  }

  async validateCardToken(cardToken: string): Promise<boolean> {
    // Support both direct token IDs and JWT wallet payment tokens
    let cardTokenId = cardToken;

    // Check if this is a JWT wallet payment token
    if (isJwtToken(cardToken)) {
      const decoded = decodeWalletPaymentToken(cardToken);
      if (decoded) {
        cardTokenId = decoded.tokenId;
      }
      // If JWT decode fails, try as direct token (backwards compatibility)
    }

    const consent = await this.prisma.paymentConsent.findUnique({
      where: { cardToken: cardTokenId },
    });

    if (!consent) return false;
    if (consent.revokedAt) return false;
    if (consent.expiresAt < new Date()) return false;

    return true;
  }
}
