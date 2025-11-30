import {
  ICreditCardTransactionRepository,
  CreateCreditCardTransactionDto,
  CreditCardTransactionData,
} from '../../repositories/interfaces/ICreditCardTransactionRepository';

/**
 * Mock credit card transaction repository for testing
 * Stores transactions in memory and provides all ICreditCardTransactionRepository methods
 */
export class MockCreditCardTransactionRepository implements ICreditCardTransactionRepository {
  private transactions: Map<string, CreditCardTransactionData> = new Map();
  private cardTransactionsIndex: Map<string, string[]> = new Map(); // creditCardId -> transactionIds[]

  constructor(initialTransactions: Array<CreditCardTransactionData> = []) {
    for (const transaction of initialTransactions) {
      this.transactions.set(transaction.id, transaction);

      const cardTransactions = this.cardTransactionsIndex.get(transaction.creditCardId) || [];
      cardTransactions.push(transaction.id);
      this.cardTransactionsIndex.set(transaction.creditCardId, cardTransactions);
    }
  }

  async create(data: CreateCreditCardTransactionDto): Promise<CreditCardTransactionData> {
    const id = `cctxn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const transaction: CreditCardTransactionData = {
      id,
      type: data.type,
      amount: data.amount,
      availableAfter: data.availableAfter,
      description: data.description,
      merchantName: data.merchantName || null,
      merchantId: data.merchantId || null,
      mccCode: data.mccCode || null,
      transactionDate: data.transactionDate || now,
      creditCardId: data.creditCardId,
      createdAt: now,
    };

    this.transactions.set(id, transaction);

    const cardTransactions = this.cardTransactionsIndex.get(data.creditCardId) || [];
    cardTransactions.push(id);
    this.cardTransactionsIndex.set(data.creditCardId, cardTransactions);

    return transaction;
  }

  async findByCreditCardId(creditCardId: string): Promise<CreditCardTransactionData[]> {
    const transactionIds = this.cardTransactionsIndex.get(creditCardId) || [];
    return transactionIds
      .map((id) => this.transactions.get(id))
      .filter((txn): txn is CreditCardTransactionData => txn !== undefined);
  }

  async findById(id: string): Promise<CreditCardTransactionData | null> {
    return this.transactions.get(id) || null;
  }

  // Helper methods for testing
  clear(): void {
    this.transactions.clear();
    this.cardTransactionsIndex.clear();
  }

  getTransactionCount(): number {
    return this.transactions.size;
  }

  getAllTransactions(): Array<CreditCardTransactionData> {
    return Array.from(this.transactions.values());
  }
}
