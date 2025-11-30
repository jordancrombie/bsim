import { Response, NextFunction } from 'express';
import { AccountService } from '../services/AccountService';
import { AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const createAccountSchema = z.object({
  initialBalance: z.number().min(0).optional().default(0),
});

const depositSchema = z.object({
  accountNumber: z.string().min(1),
  amount: z.number().positive('Amount must be positive'),
  description: z.string().optional(),
});

const withdrawSchema = z.object({
  accountNumber: z.string().min(1),
  amount: z.number().positive('Amount must be positive'),
  description: z.string().optional(),
});

const transferSchema = z.object({
  fromAccountNumber: z.string().min(1),
  toAccountNumber: z.string().min(1).optional(),
  toEmail: z.string().email('Invalid email address').optional(),
  amount: z.number().positive('Amount must be positive'),
  description: z.string().optional(),
}).refine(data => data.toAccountNumber || data.toEmail, {
  message: 'Either destination account number or recipient email is required',
});

export class AccountController {
  constructor(private accountService: AccountService) {}

  createAccount = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const validatedData = createAccountSchema.parse(req.body);
      const account = await this.accountService.createAccount(req.user.userId, validatedData.initialBalance);

      res.status(201).json({ account });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors[0].message });
        return;
      }
      next(error);
    }
  };

  getAccounts = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const accounts = await this.accountService.getAccountsByUserId(req.user.userId);
      res.status(200).json({ accounts });
    } catch (error) {
      next(error);
    }
  };

  getAccount = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { accountNumber } = req.params;
      const account = await this.accountService.getAccountByNumber(accountNumber);

      if (!account) {
        res.status(404).json({ error: 'Account not found' });
        return;
      }

      // Check if account belongs to the user
      if (req.user && account.userId !== req.user.userId) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      res.status(200).json({ account });
    } catch (error) {
      next(error);
    }
  };

  deposit = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validatedData = depositSchema.parse(req.body);

      // Verify account belongs to user
      const account = await this.accountService.getAccountByNumber(validatedData.accountNumber);
      if (!account) {
        res.status(404).json({ error: 'Account not found' });
        return;
      }

      if (req.user && account.userId !== req.user.userId) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      const updatedAccount = await this.accountService.deposit(validatedData);
      res.status(200).json({ account: updatedAccount });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors[0].message });
        return;
      }
      next(error);
    }
  };

  withdraw = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validatedData = withdrawSchema.parse(req.body);

      // Verify account belongs to user
      const account = await this.accountService.getAccountByNumber(validatedData.accountNumber);
      if (!account) {
        res.status(404).json({ error: 'Account not found' });
        return;
      }

      if (req.user && account.userId !== req.user.userId) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      const updatedAccount = await this.accountService.withdraw(validatedData);
      res.status(200).json({ account: updatedAccount });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors[0].message });
        return;
      }
      next(error);
    }
  };

  transfer = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validatedData = transferSchema.parse(req.body);

      // Verify source account belongs to user
      const fromAccount = await this.accountService.getAccountByNumber(validatedData.fromAccountNumber);
      if (!fromAccount) {
        res.status(404).json({ error: 'Source account not found' });
        return;
      }

      if (req.user && fromAccount.userId !== req.user.userId) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      // Pass sender info for notifications
      const result = await this.accountService.transfer({
        ...validatedData,
        senderUserId: req.user?.userId,
        senderEmail: req.user?.email,
      });
      res.status(200).json({
        message: 'Transfer successful',
        recipientEmail: result.recipientEmail,
        recipientAccountNumber: result.recipientAccountNumber,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors[0].message });
        return;
      }
      next(error);
    }
  };

  getTransactions = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { accountNumber } = req.params;

      // Verify account belongs to user
      const account = await this.accountService.getAccountByNumber(accountNumber);
      if (!account) {
        res.status(404).json({ error: 'Account not found' });
        return;
      }

      if (req.user && account.userId !== req.user.userId) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      const transactions = await this.accountService.getTransactionHistory(accountNumber);
      res.status(200).json({ transactions });
    } catch (error) {
      next(error);
    }
  };
}
