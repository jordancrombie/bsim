import { PrismaClient } from '@prisma/client';
import { IAccountRepository, CreateAccountDto, AccountData } from '../interfaces/IAccountRepository';

export class PrismaAccountRepository implements IAccountRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateAccountDto): Promise<AccountData> {
    const accountNumber = this.generateAccountNumber();

    const account = await this.prisma.account.create({
      data: {
        accountNumber,
        balance: data.initialBalance || 0,
        userId: data.userId,
      },
    });

    return {
      id: account.id,
      accountNumber: account.accountNumber,
      balance: Number(account.balance),
      userId: account.userId,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }

  async findByAccountNumber(accountNumber: string): Promise<AccountData | null> {
    const account = await this.prisma.account.findUnique({
      where: { accountNumber },
    });

    if (!account) return null;

    return {
      id: account.id,
      accountNumber: account.accountNumber,
      balance: Number(account.balance),
      userId: account.userId,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }

  async findByUserId(userId: string): Promise<AccountData[]> {
    const accounts = await this.prisma.account.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return accounts.map((account) => ({
      id: account.id,
      accountNumber: account.accountNumber,
      balance: Number(account.balance),
      userId: account.userId,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    }));
  }

  async findById(id: string): Promise<AccountData | null> {
    const account = await this.prisma.account.findUnique({
      where: { id },
    });

    if (!account) return null;

    return {
      id: account.id,
      accountNumber: account.accountNumber,
      balance: Number(account.balance),
      userId: account.userId,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }

  async updateBalance(id: string, newBalance: number): Promise<void> {
    await this.prisma.account.update({
      where: { id },
      data: { balance: newBalance },
    });
  }

  private generateAccountNumber(): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `ACC-${timestamp}-${random}`;
  }
}
