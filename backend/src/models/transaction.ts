/**
 * Transaction types
 */
export enum TransactionType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
  TRANSFER = 'TRANSFER'
}

/**
 * Represents a transaction
 */
export class Transaction {
  private id: string;
  private type: TransactionType;
  private amount: number;
  private balanceAfter: number;
  private description?: string;
  private timestamp: Date;

  constructor(type: TransactionType, amount: number, balanceAfter: number, description?: string) {
    this.id = this.generateId();
    this.type = type;
    this.amount = amount;
    this.balanceAfter = balanceAfter;
    this.description = description;
    this.timestamp = new Date();
  }

  /**
   * Generate a unique transaction ID
   */
  private generateId(): string {
    return `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get transaction ID
   */
  getId(): string {
    return this.id;
  }

  /**
   * Get transaction type
   */
  getType(): TransactionType {
    return this.type;
  }

  /**
   * Get transaction amount
   */
  getAmount(): number {
    return this.amount;
  }

  /**
   * Get balance after transaction
   */
  getBalanceAfter(): number {
    return this.balanceAfter;
  }

  /**
   * Get transaction description
   */
  getDescription(): string | undefined {
    return this.description;
  }

  /**
   * Get transaction timestamp
   */
  getTimestamp(): Date {
    return this.timestamp;
  }

  /**
   * Get transaction details as a string
   */
  toString(): string {
    return `[${this.timestamp.toISOString()}] ${this.type}: $${this.amount.toFixed(2)} (Balance: $${this.balanceAfter.toFixed(2)})${this.description ? ` - ${this.description}` : ''}`;
  }
}
