import { PrismaClient } from '@prisma/client';
import {
  ICreditCardTransactionRepository,
  CreateCreditCardTransactionDto,
  CreditCardTransactionData,
} from '../interfaces/ICreditCardTransactionRepository';
import { CreditCardTransactionType } from '../../models/creditCardTransaction';

export class PrismaCreditCardTransactionRepository implements ICreditCardTransactionRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateCreditCardTransactionDto): Promise<CreditCardTransactionData> {
    const transaction = await this.prisma.creditCardTransaction.create({
      data: {
        type: data.type,
        amount: data.amount,
        availableAfter: data.availableAfter,
        description: data.description,
        merchantName: data.merchantName,
        merchantId: data.merchantId,
        mccCode: data.mccCode,
        transactionDate: data.transactionDate || new Date(),
        creditCardId: data.creditCardId,
      },
    });

    return {
      id: transaction.id,
      type: transaction.type as CreditCardTransactionType,
      amount: Number(transaction.amount),
      availableAfter: Number(transaction.availableAfter),
      description: transaction.description || undefined,
      merchantName: transaction.merchantName,
      merchantId: transaction.merchantId,
      mccCode: transaction.mccCode,
      transactionDate: transaction.transactionDate,
      creditCardId: transaction.creditCardId,
      createdAt: transaction.createdAt,
    };
  }

  async findByCreditCardId(creditCardId: string): Promise<CreditCardTransactionData[]> {
    const transactions = await this.prisma.creditCardTransaction.findMany({
      where: { creditCardId },
      orderBy: { transactionDate: 'desc' },
    });

    return transactions.map((transaction) => ({
      id: transaction.id,
      type: transaction.type as CreditCardTransactionType,
      amount: Number(transaction.amount),
      availableAfter: Number(transaction.availableAfter),
      description: transaction.description || undefined,
      merchantName: transaction.merchantName,
      merchantId: transaction.merchantId,
      mccCode: transaction.mccCode,
      transactionDate: transaction.transactionDate,
      creditCardId: transaction.creditCardId,
      createdAt: transaction.createdAt,
    }));
  }

  async findById(id: string): Promise<CreditCardTransactionData | null> {
    const transaction = await this.prisma.creditCardTransaction.findUnique({
      where: { id },
    });

    if (!transaction) return null;

    return {
      id: transaction.id,
      type: transaction.type as CreditCardTransactionType,
      amount: Number(transaction.amount),
      availableAfter: Number(transaction.availableAfter),
      description: transaction.description || undefined,
      merchantName: transaction.merchantName,
      merchantId: transaction.merchantId,
      mccCode: transaction.mccCode,
      transactionDate: transaction.transactionDate,
      creditCardId: transaction.creditCardId,
      createdAt: transaction.createdAt,
    };
  }
}
