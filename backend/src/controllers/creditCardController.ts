import { Response, NextFunction } from 'express';
import { CreditCardService } from '../services/CreditCardService';
import { AuthRequest } from '../middleware/auth';
import { z } from 'zod';
import { CreditCardType } from '@prisma/client';

const createCreditCardSchema = z.object({
  creditLimit: z.number().positive('Credit limit must be positive'),
  cardHolder: z.string().optional(),
  cardType: z.nativeEnum(CreditCardType).optional(),
});

const chargeSchema = z.object({
  cardNumber: z.string().min(1),
  amount: z.number().positive('Amount must be positive'),
  description: z.string().optional(),
  merchantName: z.string().optional(),
  merchantId: z.string().optional(),
  mccCode: z.string().optional(),
  transactionDate: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
});

const paymentSchema = z.object({
  cardNumber: z.string().min(1),
  amount: z.number().positive('Amount must be positive'),
  description: z.string().optional(),
});

const refundSchema = z.object({
  cardNumber: z.string().min(1),
  amount: z.number().positive('Amount must be positive'),
  description: z.string().optional(),
});

export class CreditCardController {
  constructor(private creditCardService: CreditCardService) {}

  createCreditCard = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const validatedData = createCreditCardSchema.parse(req.body);
      const creditCard = await this.creditCardService.createCreditCard(
        req.user.userId,
        validatedData.creditLimit,
        validatedData.cardHolder,
        validatedData.cardType
      );

      res.status(201).json({ creditCard });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors[0].message });
        return;
      }
      next(error);
    }
  };

  getCreditCards = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const creditCards = await this.creditCardService.getCreditCardsByUserId(req.user.userId);
      res.status(200).json({ creditCards });
    } catch (error) {
      next(error);
    }
  };

  getCreditCard = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { cardNumber } = req.params;
      const creditCard = await this.creditCardService.getCreditCardByNumber(cardNumber);

      if (!creditCard) {
        res.status(404).json({ error: 'Credit card not found' });
        return;
      }

      // Check if credit card belongs to the user
      if (req.user && creditCard.userId !== req.user.userId) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      res.status(200).json({ creditCard });
    } catch (error) {
      next(error);
    }
  };

  getTransactions = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { cardNumber } = req.params;
      const creditCard = await this.creditCardService.getCreditCardByNumber(cardNumber);

      if (!creditCard) {
        res.status(404).json({ error: 'Credit card not found' });
        return;
      }

      // Check if credit card belongs to the user
      if (req.user && creditCard.userId !== req.user.userId) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      const transactions = await this.creditCardService.getTransactionHistory(cardNumber);
      res.status(200).json({ transactions });
    } catch (error) {
      next(error);
    }
  };

  charge = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validatedData = chargeSchema.parse(req.body);

      // Verify the credit card belongs to the user
      const creditCard = await this.creditCardService.getCreditCardByNumber(validatedData.cardNumber);
      if (!creditCard) {
        res.status(404).json({ error: 'Credit card not found' });
        return;
      }

      if (req.user && creditCard.userId !== req.user.userId) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      const updatedCreditCard = await this.creditCardService.charge(validatedData);
      res.status(200).json({ creditCard: updatedCreditCard });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors[0].message });
        return;
      }
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
        return;
      }
      next(error);
    }
  };

  payment = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validatedData = paymentSchema.parse(req.body);

      // Verify the credit card belongs to the user
      const creditCard = await this.creditCardService.getCreditCardByNumber(validatedData.cardNumber);
      if (!creditCard) {
        res.status(404).json({ error: 'Credit card not found' });
        return;
      }

      if (req.user && creditCard.userId !== req.user.userId) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      const updatedCreditCard = await this.creditCardService.payment(validatedData);
      res.status(200).json({ creditCard: updatedCreditCard });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors[0].message });
        return;
      }
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
        return;
      }
      next(error);
    }
  };

  refund = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validatedData = refundSchema.parse(req.body);

      // Verify the credit card belongs to the user
      const creditCard = await this.creditCardService.getCreditCardByNumber(validatedData.cardNumber);
      if (!creditCard) {
        res.status(404).json({ error: 'Credit card not found' });
        return;
      }

      if (req.user && creditCard.userId !== req.user.userId) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      const updatedCreditCard = await this.creditCardService.refund(validatedData);
      res.status(200).json({ creditCard: updatedCreditCard });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors[0].message });
        return;
      }
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
        return;
      }
      next(error);
    }
  };
}
