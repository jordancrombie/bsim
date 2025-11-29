import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ConsentService } from '../services/consentService';

export class AccountController {
  private consentService: ConsentService;

  constructor(private prisma: PrismaClient) {
    this.consentService = new ConsentService(prisma);
  }

  // GET /accounts - List accounts (only consented ones)
  async listAccounts(req: Request, res: Response) {
    try {
      const userId = req.token?.sub;
      // Note: In a real implementation, we'd extract client_id from the token
      // For simplicity, we'll return all user's accounts that match consent

      if (!userId) {
        return res.status(401).json({
          error: 'unauthorized',
          error_description: 'Invalid token',
        });
      }

      // Get pagination params
      const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
      const offset = parseInt(req.query.offset as string) || 0;

      // Get all user accounts (in production, filter by consented accounts)
      const accounts = await this.prisma.account.findMany({
        where: { userId },
        skip: offset,
        take: limit + 1, // Fetch one extra to check if there are more
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          accountNumber: true,
          balance: true,
          createdAt: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      const hasMore = accounts.length > limit;
      const results = accounts.slice(0, limit);

      // Format accounts in FDX style
      const formattedAccounts = results.map((account) => ({
        accountId: account.id,
        accountNumber: `****${account.accountNumber.slice(-4)}`, // Masked
        accountNumberDisplay: `****${account.accountNumber.slice(-4)}`,
        accountType: 'CHECKING', // In a real system, this would be stored
        status: 'OPEN',
        currency: {
          currencyCode: 'CAD',
        },
        balance: {
          current: parseFloat(account.balance.toString()),
          available: parseFloat(account.balance.toString()),
          asOf: new Date().toISOString(),
        },
        accountHolder: {
          name: `${account.user.firstName} ${account.user.lastName}`,
        },
        openedDate: account.createdAt.toISOString().split('T')[0],
      }));

      const response: Record<string, any> = {
        accounts: formattedAccounts,
      };

      // Add pagination info
      if (hasMore) {
        response.page = {
          nextOffset: offset + limit,
        };
      }

      res.json(response);
    } catch (error) {
      console.error('Error listing accounts:', error);
      res.status(500).json({
        error: 'server_error',
        error_description: 'Failed to list accounts',
      });
    }
  }

  // GET /accounts/:accountId - Get account details
  async getAccount(req: Request, res: Response) {
    try {
      const userId = req.token?.sub;
      const { accountId } = req.params;

      if (!userId) {
        return res.status(401).json({
          error: 'unauthorized',
          error_description: 'Invalid token',
        });
      }

      const account = await this.prisma.account.findFirst({
        where: {
          id: accountId,
          userId, // Ensure account belongs to the authenticated user
        },
        select: {
          id: true,
          accountNumber: true,
          balance: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      if (!account) {
        return res.status(404).json({
          error: 'not_found',
          error_description: 'Account not found',
        });
      }

      // Format in FDX style
      const formattedAccount = {
        accountId: account.id,
        accountNumber: `****${account.accountNumber.slice(-4)}`,
        accountNumberDisplay: `****${account.accountNumber.slice(-4)}`,
        accountType: 'CHECKING',
        status: 'OPEN',
        currency: {
          currencyCode: 'CAD',
        },
        balance: {
          current: parseFloat(account.balance.toString()),
          available: parseFloat(account.balance.toString()),
          asOf: account.updatedAt.toISOString(),
        },
        accountHolder: {
          name: `${account.user.firstName} ${account.user.lastName}`,
          email: account.user.email,
        },
        openedDate: account.createdAt.toISOString().split('T')[0],
      };

      res.json({ account: formattedAccount });
    } catch (error) {
      console.error('Error fetching account:', error);
      res.status(500).json({
        error: 'server_error',
        error_description: 'Failed to fetch account',
      });
    }
  }

  // GET /accounts/:accountId/transactions - Get transaction history
  async getTransactions(req: Request, res: Response) {
    try {
      const userId = req.token?.sub;
      const { accountId } = req.params;

      if (!userId) {
        return res.status(401).json({
          error: 'unauthorized',
          error_description: 'Invalid token',
        });
      }

      // Verify account belongs to user
      const account = await this.prisma.account.findFirst({
        where: {
          id: accountId,
          userId,
        },
      });

      if (!account) {
        return res.status(404).json({
          error: 'not_found',
          error_description: 'Account not found',
        });
      }

      // Get pagination and filter params
      const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
      const offset = parseInt(req.query.offset as string) || 0;
      const startTime = req.query.startTime
        ? new Date(req.query.startTime as string)
        : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // Default: 90 days ago
      const endTime = req.query.endTime
        ? new Date(req.query.endTime as string)
        : new Date();

      // Fetch transactions
      const transactions = await this.prisma.transaction.findMany({
        where: {
          accountId,
          createdAt: {
            gte: startTime,
            lte: endTime,
          },
        },
        skip: offset,
        take: limit + 1,
        orderBy: { createdAt: 'desc' },
      });

      const hasMore = transactions.length > limit;
      const results = transactions.slice(0, limit);

      // Format transactions in FDX style
      const formattedTransactions = results.map((tx) => ({
        transactionId: tx.id,
        transactionType: tx.type,
        amount: parseFloat(tx.amount.toString()),
        debitCreditMemo: tx.type === 'DEPOSIT' ? 'CREDIT' : 'DEBIT',
        status: 'POSTED',
        description: tx.description || tx.type,
        postedTimestamp: tx.createdAt.toISOString(),
        runningBalance: parseFloat(tx.balanceAfter.toString()),
      }));

      const response: Record<string, any> = {
        transactions: formattedTransactions,
      };

      if (hasMore) {
        response.page = {
          nextOffset: offset + limit,
        };
      }

      res.json(response);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      res.status(500).json({
        error: 'server_error',
        error_description: 'Failed to fetch transactions',
      });
    }
  }
}
