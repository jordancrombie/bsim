import {
  ITransactionRepository,
  CreateTransactionDto,
  TransactionData,
} from '../../repositories/interfaces/ITransactionRepository';

/**
 * Mock transaction repository for testing
 * Stores transactions in memory and provides all ITransactionRepository methods
 */
export class MockTransactionRepository implements ITransactionRepository {
  private transactions: Map<string, TransactionData> = new Map();
  private accountTransactionsIndex: Map<string, string[]> = new Map(); // accountId -> transactionIds[]

  constructor(initialTransactions: Array<TransactionData> = []) {
    for (const transaction of initialTransactions) {
      this.transactions.set(transaction.id, transaction);

      const accountTransactions = this.accountTransactionsIndex.get(transaction.accountId) || [];
      accountTransactions.push(transaction.id);
      this.accountTransactionsIndex.set(transaction.accountId, accountTransactions);
    }
  }

  async create(data: CreateTransactionDto): Promise<TransactionData> {
    const id = `txn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const transaction: TransactionData = {
      id,
      type: data.type,
      amount: data.amount,
      balanceAfter: data.balanceAfter,
      description: data.description,
      accountId: data.accountId,
      createdAt: now,
    };

    this.transactions.set(id, transaction);

    const accountTransactions = this.accountTransactionsIndex.get(data.accountId) || [];
    accountTransactions.push(id);
    this.accountTransactionsIndex.set(data.accountId, accountTransactions);

    return transaction;
  }

  async findByAccountId(accountId: string): Promise<TransactionData[]> {
    const transactionIds = this.accountTransactionsIndex.get(accountId) || [];
    return transactionIds
      .map((id) => this.transactions.get(id))
      .filter((txn): txn is TransactionData => txn !== undefined);
  }

  async findById(id: string): Promise<TransactionData | null> {
    return this.transactions.get(id) || null;
  }

  // Helper methods for testing
  clear(): void {
    this.transactions.clear();
    this.accountTransactionsIndex.clear();
  }

  getTransactionCount(): number {
    return this.transactions.size;
  }

  getAllTransactions(): Array<TransactionData> {
    return Array.from(this.transactions.values());
  }
}
