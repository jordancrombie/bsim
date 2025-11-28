import { TransactionType } from '../../models/transaction';

export interface CreateTransactionDto {
  type: TransactionType;
  amount: number;
  balanceAfter: number;
  description?: string;
  accountId: string;
}

export interface TransactionData {
  id: string;
  type: TransactionType;
  amount: number;
  balanceAfter: number;
  description?: string;
  accountId: string;
  createdAt: Date;
}

export interface ITransactionRepository {
  create(data: CreateTransactionDto): Promise<TransactionData>;
  findByAccountId(accountId: string): Promise<TransactionData[]>;
  findById(id: string): Promise<TransactionData | null>;
}
