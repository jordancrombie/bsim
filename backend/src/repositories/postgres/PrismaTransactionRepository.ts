import { PrismaClient } from '@prisma/client';
import { ITransactionRepository, CreateTransactionDto, TransactionData } from '../interfaces/ITransactionRepository';

export class PrismaTransactionRepository implements ITransactionRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateTransactionDto): Promise<TransactionData> {
    const transaction = await this.prisma.transaction.create({
      data: {
        type: data.type,
        amount: data.amount,
        balanceAfter: data.balanceAfter,
        description: data.description,
        accountId: data.accountId,
      },
    });

    return {
      id: transaction.id,
      type: transaction.type as any,
      amount: Number(transaction.amount),
      balanceAfter: Number(transaction.balanceAfter),
      description: transaction.description || undefined,
      accountId: transaction.accountId,
      createdAt: transaction.createdAt,
    };
  }

  async findByAccountId(accountId: string): Promise<TransactionData[]> {
    const transactions = await this.prisma.transaction.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
    });

    return transactions.map((t) => ({
      id: t.id,
      type: t.type as any,
      amount: Number(t.amount),
      balanceAfter: Number(t.balanceAfter),
      description: t.description || undefined,
      accountId: t.accountId,
      createdAt: t.createdAt,
    }));
  }

  async findById(id: string): Promise<TransactionData | null> {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
    });

    if (!transaction) return null;

    return {
      id: transaction.id,
      type: transaction.type as any,
      amount: Number(transaction.amount),
      balanceAfter: Number(transaction.balanceAfter),
      description: transaction.description || undefined,
      accountId: transaction.accountId,
      createdAt: transaction.createdAt,
    };
  }
}
