import { Response } from 'express';
import { EscrowService } from '../services/EscrowService';
import { EscrowRequest } from '../middleware/escrowAuth';

export class EscrowController {
  constructor(private escrowService: EscrowService) {
    // Bind methods to preserve 'this' context
    this.createHold = this.createHold.bind(this);
    this.release = this.release.bind(this);
    this.returnEscrow = this.returnEscrow.bind(this);
    this.getById = this.getById.bind(this);
  }

  /**
   * POST /api/escrow/hold
   * Create an escrow hold on a user's account
   */
  async createHold(req: EscrowRequest, res: Response): Promise<void> {
    try {
      const {
        user_id,
        account_id,
        wallet_id,
        amount,
        currency,
        contract_id,
        contract_service,
        expires_at,
        description,
      } = req.body;

      // Validate required fields
      if (!user_id || !account_id || !amount || !contract_id || !expires_at) {
        res.status(400).json({
          error: 'Missing required fields',
          required: ['user_id', 'account_id', 'amount', 'contract_id', 'expires_at'],
        });
        return;
      }

      if (amount <= 0) {
        res.status(400).json({ error: 'Amount must be positive' });
        return;
      }

      const result = await this.escrowService.createHold({
        userId: user_id,
        accountId: account_id,
        walletId: wallet_id,
        amount,
        currency,
        contractId: contract_id,
        contractService: contract_service,
        expiresAt: new Date(expires_at),
        description,
      });

      res.status(201).json({
        escrow_id: result.escrowId,
        status: result.status.toLowerCase(),
        amount: result.amount,
        currency: result.currency,
        available_balance: result.availableBalance,
        escrowed_balance: result.escrowedBalance,
        created_at: result.createdAt.toISOString(),
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * POST /api/escrow/:id/release
   * Release escrow for settlement
   */
  async release(req: EscrowRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { release_type, transfer_reference, contract_id, reason } = req.body;

      if (!contract_id || !reason) {
        res.status(400).json({
          error: 'Missing required fields',
          required: ['contract_id', 'reason'],
        });
        return;
      }

      const result = await this.escrowService.release(id, {
        releaseType: release_type || 'settlement',
        transferReference: transfer_reference,
        contractId: contract_id,
        reason,
      });

      res.json({
        escrow_id: result.escrowId,
        status: result.status.toLowerCase(),
        released_at: result.releasedAt.toISOString(),
        transfer_reference: result.transferReference,
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * POST /api/escrow/:id/return
   * Return escrowed funds to user
   */
  async returnEscrow(req: EscrowRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { reason, contract_id } = req.body;

      if (!contract_id || !reason) {
        res.status(400).json({
          error: 'Missing required fields',
          required: ['contract_id', 'reason'],
        });
        return;
      }

      const result = await this.escrowService.return(id, {
        reason,
        contractId: contract_id,
      });

      res.json({
        escrow_id: result.escrowId,
        status: result.status.toLowerCase(),
        returned_at: result.returnedAt.toISOString(),
        available_balance: result.availableBalance,
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * GET /api/escrow/:id
   * Get escrow hold by ID
   */
  async getById(req: EscrowRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const result = await this.escrowService.getById(id);

      if (!result) {
        res.status(404).json({ error: 'Escrow not found' });
        return;
      }

      res.json({
        escrow_id: result.escrowId,
        status: result.status.toLowerCase(),
        amount: result.amount,
        currency: result.currency,
        contract_id: result.contractId,
        user_id: result.userId,
        account_id: result.accountId,
        created_at: result.createdAt.toISOString(),
        expires_at: result.expiresAt.toISOString(),
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Handle service errors and map to HTTP responses
   */
  private handleError(error: unknown, res: Response): void {
    const message = error instanceof Error ? error.message : 'Unknown error';

    switch (message) {
      case 'ACCOUNT_NOT_FOUND':
        res.status(404).json({ error: 'Account not found' });
        break;
      case 'INSUFFICIENT_FUNDS':
        res.status(400).json({ error: 'Insufficient funds for escrow hold' });
        break;
      case 'DUPLICATE_HOLD':
        res.status(409).json({ error: 'Escrow hold already exists for this contract and user' });
        break;
      case 'ESCROW_NOT_FOUND':
        res.status(404).json({ error: 'Escrow not found' });
        break;
      case 'ESCROW_NOT_HELD':
        res.status(400).json({ error: 'Escrow is not in held status' });
        break;
      case 'CONTRACT_MISMATCH':
        res.status(400).json({ error: 'Contract ID does not match escrow' });
        break;
      default:
        console.error('Escrow error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
  }
}
