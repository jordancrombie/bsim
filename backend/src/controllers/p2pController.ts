import { Response, NextFunction } from 'express';
import { PrismaClient, P2PDirection, P2PStatus, TransactionType } from '@prisma/client';
import { P2PRequest } from '../middleware/p2pAuth';
import { z } from 'zod';

// Validation schemas
const debitSchema = z.object({
  transferId: z.string().uuid('Invalid transfer ID'),
  userId: z.string().uuid('Invalid user ID'),
  accountId: z.string().uuid('Invalid account ID'),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().default('CAD'),
  recipientAlias: z.string().optional(),
  description: z.string().optional(),
});

const creditSchema = z.object({
  transferId: z.string().uuid('Invalid transfer ID'),
  userId: z.string().uuid('Invalid user ID'),
  accountId: z.string().uuid().optional(), // Optional - use default account if not provided
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().default('CAD'),
  senderAlias: z.string().optional(),
  description: z.string().optional(),
  // Micro Merchant fee collection (optional)
  feeAmount: z.number().positive().optional(),
  feeAccountId: z.string().uuid().optional(),
  merchantName: z.string().optional(), // For fee transaction description
}).refine(
  (data) => {
    // If feeAmount is provided, feeAccountId must also be provided (and vice versa)
    if (data.feeAmount !== undefined && data.feeAccountId === undefined) return false;
    if (data.feeAccountId !== undefined && data.feeAmount === undefined) return false;
    return true;
  },
  { message: 'feeAmount and feeAccountId must both be provided for fee collection' }
).refine(
  (data) => {
    // Fee amount must be less than gross amount
    if (data.feeAmount !== undefined && data.feeAmount >= data.amount) return false;
    return true;
  },
  { message: 'feeAmount must be less than the gross amount' }
);

const verifySchema = z.object({
  userId: z.string().uuid('Invalid user ID').optional(),
  email: z.string().email('Invalid email').optional(),
}).refine(data => data.userId || data.email, {
  message: 'Either userId or email is required',
});

export class P2PController {
  constructor(private prisma: PrismaClient) {}

  /**
   * POST /api/p2p/transfer/debit
   * Debit a user's account for an outgoing P2P transfer.
   * Called by TransferSim when initiating a transfer.
   */
  debit = async (req: P2PRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = debitSchema.parse(req.body);

      // Check for idempotency - if we've already processed this transfer, return the existing result
      const existingTransfer = await this.prisma.p2PTransfer.findUnique({
        where: { externalId: data.transferId },
      });

      if (existingTransfer) {
        if (existingTransfer.status === 'COMPLETED') {
          res.status(200).json({
            success: true,
            transactionId: existingTransfer.transactionId,
            transferId: existingTransfer.externalId,
            message: 'Transfer already processed',
          });
          return;
        } else if (existingTransfer.status === 'FAILED') {
          res.status(400).json({
            success: false,
            error: existingTransfer.errorCode || 'PREVIOUS_FAILURE',
            message: existingTransfer.errorMessage || 'Previous attempt failed',
          });
          return;
        }
      }

      // Verify account exists and belongs to user
      const account = await this.prisma.account.findUnique({
        where: { id: data.accountId },
        include: { user: true },
      });

      if (!account) {
        res.status(404).json({
          success: false,
          error: 'ACCOUNT_NOT_FOUND',
          message: 'Account not found',
        });
        return;
      }

      if (account.userId !== data.userId) {
        res.status(403).json({
          success: false,
          error: 'USER_MISMATCH',
          message: 'Account does not belong to specified user',
        });
        return;
      }

      // Check sufficient funds
      const amount = Number(data.amount);
      const currentBalance = Number(account.balance);

      if (amount > currentBalance) {
        // Record failed transfer attempt
        await this.prisma.p2PTransfer.create({
          data: {
            externalId: data.transferId,
            direction: P2PDirection.DEBIT,
            userId: data.userId,
            accountId: data.accountId,
            amount: data.amount,
            currency: data.currency,
            status: P2PStatus.FAILED,
            counterpartyAlias: data.recipientAlias,
            description: data.description,
            errorCode: 'INSUFFICIENT_FUNDS',
            errorMessage: 'Insufficient funds for this transfer',
          },
        });

        res.status(400).json({
          success: false,
          error: 'INSUFFICIENT_FUNDS',
          message: 'Insufficient funds for this transfer',
        });
        return;
      }

      // Perform the debit in a transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // Debit the account
        const newBalance = currentBalance - amount;

        await tx.account.update({
          where: { id: data.accountId },
          data: { balance: newBalance },
        });

        // Create transaction record
        const transaction = await tx.transaction.create({
          data: {
            type: TransactionType.WITHDRAWAL,
            amount: data.amount,
            balanceAfter: newBalance,
            description: data.recipientAlias
              ? `P2P Transfer to ${data.recipientAlias}${data.description ? ': ' + data.description : ''}`
              : `P2P Transfer${data.description ? ': ' + data.description : ''}`,
            accountId: data.accountId,
          },
        });

        // Create P2P transfer record
        const p2pTransfer = await tx.p2PTransfer.create({
          data: {
            externalId: data.transferId,
            direction: P2PDirection.DEBIT,
            userId: data.userId,
            accountId: data.accountId,
            transactionId: transaction.id,
            amount: data.amount,
            currency: data.currency,
            status: P2PStatus.COMPLETED,
            counterpartyAlias: data.recipientAlias,
            description: data.description,
          },
        });

        return { transaction, p2pTransfer, newBalance };
      });

      res.status(200).json({
        success: true,
        transactionId: result.transaction.id,
        transferId: data.transferId,
        newBalance: result.newBalance,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: error.errors[0].message,
        });
        return;
      }
      next(error);
    }
  };

  /**
   * POST /api/p2p/transfer/credit
   * Credit a user's account for an incoming P2P transfer.
   * Called by TransferSim when completing a transfer to a recipient.
   *
   * For Micro Merchant transfers, also handles fee collection:
   * - feeAmount: The fee to collect (e.g., $0.25)
   * - feeAccountId: The system fee collection account
   * - merchantName: Name for fee transaction description
   */
  credit = async (req: P2PRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = creditSchema.parse(req.body);

      // Check for idempotency
      const existingTransfer = await this.prisma.p2PTransfer.findUnique({
        where: { externalId: data.transferId },
      });

      if (existingTransfer) {
        if (existingTransfer.status === 'COMPLETED') {
          res.status(200).json({
            success: true,
            transactionId: existingTransfer.transactionId,
            transferId: existingTransfer.externalId,
            message: 'Transfer already processed',
          });
          return;
        } else if (existingTransfer.status === 'FAILED') {
          res.status(400).json({
            success: false,
            error: existingTransfer.errorCode || 'PREVIOUS_FAILURE',
            message: existingTransfer.errorMessage || 'Previous attempt failed',
          });
          return;
        }
      }

      // Verify user exists
      const user = await this.prisma.user.findUnique({
        where: { id: data.userId },
        include: { accounts: true },
      });

      if (!user) {
        res.status(404).json({
          success: false,
          error: 'USER_NOT_FOUND',
          message: 'User not found',
        });
        return;
      }

      // Determine which account to credit
      let targetAccountId = data.accountId;

      if (!targetAccountId) {
        // Use user's first account as default
        if (user.accounts.length === 0) {
          res.status(400).json({
            success: false,
            error: 'NO_ACCOUNT',
            message: 'User has no accounts to receive funds',
          });
          return;
        }
        targetAccountId = user.accounts[0].id;
      }

      const account = await this.prisma.account.findUnique({
        where: { id: targetAccountId },
      });

      if (!account) {
        res.status(404).json({
          success: false,
          error: 'ACCOUNT_NOT_FOUND',
          message: 'Account not found',
        });
        return;
      }

      if (account.userId !== data.userId) {
        res.status(403).json({
          success: false,
          error: 'USER_MISMATCH',
          message: 'Account does not belong to specified user',
        });
        return;
      }

      // Check if this is a Micro Merchant transaction with fee collection
      const hasFee = data.feeAmount !== undefined && data.feeAccountId !== undefined;
      let feeAccount = null;

      if (hasFee) {
        // Verify fee account exists
        feeAccount = await this.prisma.account.findUnique({
          where: { id: data.feeAccountId },
        });

        if (!feeAccount) {
          res.status(400).json({
            success: false,
            error: 'FEE_ACCOUNT_NOT_FOUND',
            message: 'Fee collection account not found',
          });
          return;
        }
      }

      // Calculate amounts
      const grossAmount = Number(data.amount);
      const feeAmount = hasFee ? Number(data.feeAmount) : 0;
      const netAmount = grossAmount - feeAmount;
      const currentBalance = Number(account.balance);

      // Perform the credit (and optional fee) in a single transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // 1. Credit the merchant's net amount
        const newMerchantBalance = currentBalance + netAmount;

        await tx.account.update({
          where: { id: targetAccountId },
          data: { balance: newMerchantBalance },
        });

        // Create merchant's transaction record
        const merchantTransaction = await tx.transaction.create({
          data: {
            type: TransactionType.DEPOSIT,
            amount: netAmount,
            balanceAfter: newMerchantBalance,
            description: data.senderAlias
              ? `P2P Transfer from ${data.senderAlias}${data.description ? ': ' + data.description : ''}${hasFee ? ` (Fee: $${feeAmount.toFixed(2)})` : ''}`
              : `P2P Transfer${data.description ? ': ' + data.description : ''}${hasFee ? ` (Fee: $${feeAmount.toFixed(2)})` : ''}`,
            accountId: targetAccountId!,
          },
        });

        // Create P2P transfer record for merchant
        const p2pTransfer = await tx.p2PTransfer.create({
          data: {
            externalId: data.transferId,
            direction: P2PDirection.CREDIT,
            userId: data.userId,
            accountId: targetAccountId!,
            transactionId: merchantTransaction.id,
            amount: netAmount, // Store net amount (after fee)
            currency: data.currency,
            status: P2PStatus.COMPLETED,
            counterpartyAlias: data.senderAlias,
            description: data.description,
          },
        });

        // 2. If fee collection, credit the fee account
        let feeTransaction = null;
        if (hasFee && feeAccount) {
          const currentFeeBalance = Number(feeAccount.balance);
          const newFeeBalance = currentFeeBalance + feeAmount;

          await tx.account.update({
            where: { id: data.feeAccountId },
            data: { balance: newFeeBalance },
          });

          // Create fee transaction record
          feeTransaction = await tx.transaction.create({
            data: {
              type: TransactionType.FEE,
              amount: feeAmount,
              balanceAfter: newFeeBalance,
              description: `Micro Merchant Fee: ${data.merchantName || 'Unknown'} (Transfer: ${data.transferId})`,
              accountId: data.feeAccountId!,
            },
          });
        }

        return {
          merchantTransaction,
          feeTransaction,
          p2pTransfer,
          newMerchantBalance,
          netAmount,
          feeAmount: hasFee ? feeAmount : undefined,
        };
      });

      // Build response
      const response: Record<string, unknown> = {
        success: true,
        transactionId: result.merchantTransaction.id,
        transferId: data.transferId,
        newBalance: result.newMerchantBalance,
      };

      // Add fee-related fields if applicable
      if (hasFee) {
        response.netAmount = result.netAmount;
        response.feeAmount = result.feeAmount;
        response.feeTransactionId = result.feeTransaction?.id;
      }

      res.status(200).json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: error.errors[0].message,
        });
        return;
      }
      next(error);
    }
  };

  /**
   * GET /api/p2p/config/fee-account
   * Get the configured fee collection account ID for this BSIM.
   * Called by TransferSim to know where to direct Micro Merchant fees.
   */
  getFeeAccount = async (req: P2PRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const config = await this.prisma.systemConfig.findUnique({
        where: { key: 'P2P_FEE_ACCOUNT_ID' },
      });

      if (!config) {
        res.status(404).json({
          success: false,
          error: 'NOT_CONFIGURED',
          message: 'P2P fee account not configured',
        });
        return;
      }

      // Verify the account still exists
      const account = await this.prisma.account.findUnique({
        where: { id: config.value },
        include: { user: true },
      });

      if (!account) {
        res.status(404).json({
          success: false,
          error: 'ACCOUNT_NOT_FOUND',
          message: 'Configured fee account no longer exists',
        });
        return;
      }

      res.status(200).json({
        success: true,
        feeAccountId: config.value,
        accountNumber: account.accountNumber,
        balance: Number(account.balance),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PUT /api/p2p/config/fee-account
   * Set the fee collection account ID for this BSIM.
   * Should be called during BSIM setup by TransferSim.
   */
  setFeeAccount = async (req: P2PRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { accountId } = req.body;

      if (!accountId || typeof accountId !== 'string') {
        res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'accountId is required',
        });
        return;
      }

      // Verify the account exists
      const account = await this.prisma.account.findUnique({
        where: { id: accountId },
      });

      if (!account) {
        res.status(404).json({
          success: false,
          error: 'ACCOUNT_NOT_FOUND',
          message: 'Account not found',
        });
        return;
      }

      // Upsert the config
      await this.prisma.systemConfig.upsert({
        where: { key: 'P2P_FEE_ACCOUNT_ID' },
        create: {
          key: 'P2P_FEE_ACCOUNT_ID',
          value: accountId,
          description: 'Account ID for collecting Micro Merchant P2P fees',
        },
        update: {
          value: accountId,
        },
      });

      res.status(200).json({
        success: true,
        feeAccountId: accountId,
        message: 'Fee account configured successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/p2p/user/verify
   * Verify that a user exists at this BSIM and can receive P2P transfers.
   * Called by TransferSim during alias lookup.
   */
  verify = async (req: P2PRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = verifySchema.parse(req.body);

      let user;

      if (data.userId) {
        user = await this.prisma.user.findUnique({
          where: { id: data.userId },
          include: { accounts: true },
        });
      } else if (data.email) {
        user = await this.prisma.user.findUnique({
          where: { email: data.email },
          include: { accounts: true },
        });
      }

      if (!user) {
        res.status(200).json({
          exists: false,
        });
        return;
      }

      // Mask the display name (first name + last initial)
      const displayName = `${user.firstName} ${user.lastName.charAt(0)}.`;

      // Get default receiving account (first account)
      const defaultAccountId = user.accounts.length > 0 ? user.accounts[0].id : null;

      res.status(200).json({
        exists: true,
        userId: user.id,
        displayName,
        defaultAccountId,
        p2pEnabled: user.accounts.length > 0, // User can receive if they have at least one account
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: error.errors[0].message,
        });
        return;
      }
      next(error);
    }
  };
}
