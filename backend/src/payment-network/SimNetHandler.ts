import { randomUUID } from 'crypto';
import { PrismaClient, PaymentAuthorizationStatus } from '@prisma/client';
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

/**
 * SimNet Payment Handler
 *
 * Implementation of IPaymentNetworkHandler for the SimNet payment network.
 * This handler processes payments from NSIM by:
 * - Validating card tokens (from PaymentConsent)
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
    const consent = await this.prisma.paymentConsent.findUnique({
      where: { cardToken: request.cardToken },
    });

    if (!consent) {
      return {
        status: 'declined',
        declineReason: 'Invalid card token',
      };
    }

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

    // Check merchant matches
    if (consent.merchantId !== request.merchantId) {
      return {
        status: 'declined',
        declineReason: 'Merchant mismatch',
      };
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
    const consent = await this.prisma.paymentConsent.findUnique({
      where: { cardToken },
    });

    if (!consent) return false;
    if (consent.revokedAt) return false;
    if (consent.expiresAt < new Date()) return false;

    return true;
  }
}
