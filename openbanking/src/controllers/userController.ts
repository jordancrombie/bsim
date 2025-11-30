import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

export class UserController {
  constructor(private prisma: PrismaClient) {}

  // GET /users/:fiUserRef/accounts - List all accounts for a user by fi_user_ref
  async listUserAccounts(req: Request, res: Response) {
    try {
      const { fiUserRef } = req.params;
      const tokenSub = req.token?.sub;

      if (!tokenSub) {
        return res.status(401).json({
          error: 'unauthorized',
          error_description: 'Invalid token',
        });
      }

      // Verify the token's sub claim matches the requested fi_user_ref
      if (tokenSub !== fiUserRef) {
        return res.status(403).json({
          error: 'forbidden',
          error_description: 'Token subject does not match requested user',
        });
      }

      // Look up user by fi_user_ref
      const user = await this.prisma.user.findUnique({
        where: { fiUserRef },
        select: {
          id: true,
          fiUserRef: true,
          firstName: true,
          lastName: true,
          accounts: {
            select: {
              id: true,
              accountNumber: true,
              accountType: true,
              balance: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!user) {
        return res.status(404).json({
          error: 'not_found',
          error_description: 'User not found',
        });
      }

      // Format accounts
      const formattedAccounts = user.accounts.map((account) => ({
        accountId: account.id,
        accountNumber: account.accountNumber,
        accountNumberMasked: `****${account.accountNumber.slice(-4)}`,
        accountType: account.accountType,
        status: 'OPEN',
        currency: 'CAD',
        balance: {
          current: parseFloat(account.balance.toString()),
          available: parseFloat(account.balance.toString()),
          asOf: account.updatedAt.toISOString(),
        },
        openedDate: account.createdAt.toISOString().split('T')[0],
      }));

      res.json({
        fiUserRef: user.fiUserRef,
        accountHolder: {
          name: `${user.firstName} ${user.lastName}`,
        },
        accounts: formattedAccounts,
      });
    } catch (error) {
      console.error('Error listing user accounts:', error);
      res.status(500).json({
        error: 'server_error',
        error_description: 'Failed to list user accounts',
      });
    }
  }
}
