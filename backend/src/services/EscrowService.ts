import { PrismaClient } from '@prisma/client';

export interface CreateEscrowHoldRequest {
  userId: string;
  accountId: string;
  walletId?: string; // External wallet ID from ContractSim
  amount: number;
  currency?: string;
  contractId: string;
  contractService?: string;
  expiresAt: Date;
  description?: string;
}

export interface ReleaseEscrowRequest {
  releaseType: 'settlement';
  transferReference?: string;
  contractId: string;
  reason: string;
}

export interface ReturnEscrowRequest {
  reason: string;
  contractId: string;
}

export interface EscrowHoldResponse {
  escrowId: string;
  status: string;
  amount: number;
  currency: string;
  availableBalance: number;
  escrowedBalance: number;
  createdAt: Date;
}

export interface EscrowWebhookPayload {
  event_id: string;
  event_type: 'escrow.held' | 'escrow.expired';
  timestamp: string;
  data: {
    escrow_id: string;
    contract_id: string;
    user_id: string;
    wallet_id: string;
    amount?: number;
  };
}

export class EscrowService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create an escrow hold on a user's account
   */
  async createHold(request: CreateEscrowHoldRequest): Promise<EscrowHoldResponse> {
    const {
      userId,
      accountId,
      walletId,
      amount,
      currency = 'CAD',
      contractId,
      contractService = 'contractsim',
      expiresAt,
      description,
    } = request;

    // Validate account exists and belongs to user
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId },
    });

    if (!account) {
      throw new Error('ACCOUNT_NOT_FOUND');
    }

    // Calculate current available balance (balance minus existing escrow holds)
    const existingHolds = await this.prisma.escrowHold.aggregate({
      where: {
        accountId,
        status: { in: ['PENDING', 'HELD'] },
      },
      _sum: { amount: true },
    });

    const currentEscrowed = Number(existingHolds._sum.amount || 0);
    const currentBalance = Number(account.balance);
    const availableBalance = currentBalance - currentEscrowed;

    if (amount > availableBalance) {
      throw new Error('INSUFFICIENT_FUNDS');
    }

    // Check for duplicate hold on same contract
    const existingHold = await this.prisma.escrowHold.findUnique({
      where: {
        contractId_userId: { contractId, userId },
      },
    });

    if (existingHold) {
      throw new Error('DUPLICATE_HOLD');
    }

    // Create the escrow hold
    const escrowHold = await this.prisma.escrowHold.create({
      data: {
        userId,
        accountId,
        walletId,
        contractId,
        contractService,
        amount,
        currency,
        status: 'HELD',
        heldAt: new Date(),
        expiresAt,
        description,
      },
    });

    // Create transaction record for the hold
    await this.prisma.transaction.create({
      data: {
        type: 'ESCROW_HOLD',
        amount: -amount, // Negative to show funds leaving available
        balanceAfter: currentBalance, // Balance doesn't change, just available
        description: description || `Escrow Hold - Contract ${contractId}`,
        accountId,
      },
    });

    // Calculate new escrow totals
    const newEscrowedBalance = currentEscrowed + amount;
    const newAvailableBalance = currentBalance - newEscrowedBalance;

    // Send webhook to ContractSim
    await this.sendWebhook('escrow.held', {
      escrow_id: escrowHold.id,
      contract_id: contractId,
      user_id: userId,
      wallet_id: walletId || accountId, // Use walletId if provided, else fallback to accountId
      amount,
    });

    return {
      escrowId: escrowHold.id,
      status: escrowHold.status,
      amount: Number(escrowHold.amount),
      currency: escrowHold.currency,
      availableBalance: newAvailableBalance,
      escrowedBalance: newEscrowedBalance,
      createdAt: escrowHold.createdAt,
    };
  }

  /**
   * Release escrow for settlement (funds go to TransferSim for distribution)
   */
  async release(escrowId: string, request: ReleaseEscrowRequest): Promise<{ escrowId: string; status: string; releasedAt: Date; transferReference?: string }> {
    const escrow = await this.prisma.escrowHold.findUnique({
      where: { id: escrowId },
      include: { account: true },
    });

    if (!escrow) {
      throw new Error('ESCROW_NOT_FOUND');
    }

    if (escrow.status !== 'HELD') {
      throw new Error('ESCROW_NOT_HELD');
    }

    if (escrow.contractId !== request.contractId) {
      throw new Error('CONTRACT_MISMATCH');
    }

    const releasedAt = new Date();

    // Update escrow status
    await this.prisma.escrowHold.update({
      where: { id: escrowId },
      data: {
        status: 'RELEASED',
        releaseType: request.releaseType,
        transferReference: request.transferReference,
        releasedAt,
      },
    });

    // Deduct from actual balance (funds leaving the bank via TransferSim)
    const currentBalance = Number(escrow.account.balance);
    const newBalance = currentBalance - Number(escrow.amount);

    await this.prisma.account.update({
      where: { id: escrow.accountId },
      data: { balance: newBalance },
    });

    // Create transaction record
    await this.prisma.transaction.create({
      data: {
        type: 'ESCROW_RELEASE',
        amount: -Number(escrow.amount),
        balanceAfter: newBalance,
        description: `Escrow Released - ${request.reason}`,
        accountId: escrow.accountId,
      },
    });

    return {
      escrowId,
      status: 'RELEASED',
      releasedAt,
      transferReference: request.transferReference,
    };
  }

  /**
   * Return escrowed funds to user (cancelled/expired contract)
   */
  async return(escrowId: string, request: ReturnEscrowRequest): Promise<{ escrowId: string; status: string; returnedAt: Date; availableBalance: number }> {
    const escrow = await this.prisma.escrowHold.findUnique({
      where: { id: escrowId },
      include: { account: true },
    });

    if (!escrow) {
      throw new Error('ESCROW_NOT_FOUND');
    }

    if (escrow.status !== 'HELD') {
      throw new Error('ESCROW_NOT_HELD');
    }

    if (escrow.contractId !== request.contractId) {
      throw new Error('CONTRACT_MISMATCH');
    }

    const returnedAt = new Date();

    // Update escrow status
    await this.prisma.escrowHold.update({
      where: { id: escrowId },
      data: {
        status: 'RETURNED',
        releaseType: 'return',
        releasedAt: returnedAt,
      },
    });

    // Create transaction record (no balance change, just releasing the hold)
    const currentBalance = Number(escrow.account.balance);

    await this.prisma.transaction.create({
      data: {
        type: 'ESCROW_RETURN',
        amount: Number(escrow.amount), // Positive to show funds returning to available
        balanceAfter: currentBalance,
        description: `Escrow Returned - ${request.reason}`,
        accountId: escrow.accountId,
      },
    });

    // Calculate new available balance
    const remainingHolds = await this.prisma.escrowHold.aggregate({
      where: {
        accountId: escrow.accountId,
        status: { in: ['PENDING', 'HELD'] },
      },
      _sum: { amount: true },
    });

    const totalEscrowed = Number(remainingHolds._sum.amount || 0);
    const availableBalance = currentBalance - totalEscrowed;

    return {
      escrowId,
      status: 'RETURNED',
      returnedAt,
      availableBalance,
    };
  }

  /**
   * Get escrow hold by ID
   */
  async getById(escrowId: string): Promise<{
    escrowId: string;
    status: string;
    amount: number;
    currency: string;
    contractId: string;
    userId: string;
    accountId: string;
    createdAt: Date;
    expiresAt: Date;
  } | null> {
    const escrow = await this.prisma.escrowHold.findUnique({
      where: { id: escrowId },
    });

    if (!escrow) {
      return null;
    }

    return {
      escrowId: escrow.id,
      status: escrow.status,
      amount: Number(escrow.amount),
      currency: escrow.currency,
      contractId: escrow.contractId,
      userId: escrow.userId,
      accountId: escrow.accountId,
      createdAt: escrow.createdAt,
      expiresAt: escrow.expiresAt,
    };
  }

  /**
   * Get available and escrowed balance for an account
   */
  async getAccountBalances(accountId: string): Promise<{
    balance: number;
    availableBalance: number;
    escrowedBalance: number;
  }> {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new Error('ACCOUNT_NOT_FOUND');
    }

    const escrowHolds = await this.prisma.escrowHold.aggregate({
      where: {
        accountId,
        status: { in: ['PENDING', 'HELD'] },
      },
      _sum: { amount: true },
    });

    const balance = Number(account.balance);
    const escrowedBalance = Number(escrowHolds._sum.amount || 0);
    const availableBalance = balance - escrowedBalance;

    return {
      balance,
      availableBalance,
      escrowedBalance,
    };
  }

  /**
   * Process expired escrow holds (called by background job)
   */
  async processExpiredHolds(): Promise<number> {
    const expiredHolds = await this.prisma.escrowHold.findMany({
      where: {
        status: 'HELD',
        expiresAt: { lte: new Date() },
      },
      include: { account: true },
    });

    let processedCount = 0;

    for (const escrow of expiredHolds) {
      try {
        await this.prisma.escrowHold.update({
          where: { id: escrow.id },
          data: {
            status: 'EXPIRED',
            releaseType: 'expired',
            releasedAt: new Date(),
          },
        });

        // Create transaction record
        await this.prisma.transaction.create({
          data: {
            type: 'ESCROW_RETURN',
            amount: Number(escrow.amount),
            balanceAfter: Number(escrow.account.balance),
            description: 'Escrow Expired - Auto-returned',
            accountId: escrow.accountId,
          },
        });

        // Send webhook to ContractSim
        await this.sendWebhook('escrow.expired', {
          escrow_id: escrow.id,
          contract_id: escrow.contractId,
          user_id: escrow.userId,
          wallet_id: escrow.walletId || escrow.accountId,
        });

        processedCount++;
      } catch (error) {
        console.error(`Failed to process expired escrow ${escrow.id}:`, error);
      }
    }

    return processedCount;
  }

  /**
   * Send webhook to ContractSim
   */
  private async sendWebhook(eventType: 'escrow.held' | 'escrow.expired', data: EscrowWebhookPayload['data']): Promise<void> {
    const webhookUrl = process.env.CONTRACTSIM_WEBHOOK_URL;

    if (!webhookUrl) {
      console.warn('CONTRACTSIM_WEBHOOK_URL not configured, skipping webhook');
      return;
    }

    const payload: EscrowWebhookPayload = {
      event_id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      event_type: eventType,
      timestamp: new Date().toISOString(),
      data,
    };

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-BSIM-Signature': this.signPayload(payload),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error(`Webhook to ContractSim failed: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to send webhook to ContractSim:', error);
    }
  }

  /**
   * Sign webhook payload for verification
   */
  private signPayload(payload: EscrowWebhookPayload): string {
    const crypto = require('crypto');
    const secret = process.env.CONTRACTSIM_WEBHOOK_SECRET || 'default-secret';
    return crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
  }
}
