import { Transaction, TransactionType } from './transaction';

/**
 * Represents a bank account
 */
export class Account {
  private accountNumber: string;
  private balance: number;
  private transactions: Transaction[];
  private createdAt: Date;

  constructor(accountNumber: string, initialBalance: number = 0) {
    this.accountNumber = accountNumber;
    this.balance = initialBalance;
    this.transactions = [];
    this.createdAt = new Date();

    if (initialBalance > 0) {
      this.addTransaction(TransactionType.DEPOSIT, initialBalance, 'Initial deposit');
    }
  }

  /**
   * Get the account number
   */
  getAccountNumber(): string {
    return this.accountNumber;
  }

  /**
   * Get the current balance
   */
  getBalance(): number {
    return this.balance;
  }

  /**
   * Get all transactions
   */
  getTransactions(): Transaction[] {
    return [...this.transactions];
  }

  /**
   * Deposit money into the account
   */
  deposit(amount: number, description?: string): void {
    if (amount <= 0) {
      throw new Error('Deposit amount must be positive');
    }

    this.balance += amount;
    this.addTransaction(TransactionType.DEPOSIT, amount, description);
  }

  /**
   * Withdraw money from the account
   */
  withdraw(amount: number, description?: string): void {
    if (amount <= 0) {
      throw new Error('Withdrawal amount must be positive');
    }

    if (amount > this.balance) {
      throw new Error('Insufficient funds');
    }

    this.balance -= amount;
    this.addTransaction(TransactionType.WITHDRAWAL, amount, description);
  }

  /**
   * Transfer money to another account
   */
  transfer(toAccount: Account, amount: number, description?: string): void {
    if (amount <= 0) {
      throw new Error('Transfer amount must be positive');
    }

    if (amount > this.balance) {
      throw new Error('Insufficient funds');
    }

    this.withdraw(amount, `Transfer to ${toAccount.getAccountNumber()}: ${description || ''}`);
    toAccount.deposit(amount, `Transfer from ${this.accountNumber}: ${description || ''}`);
  }

  /**
   * Add a transaction to the account history
   */
  private addTransaction(type: TransactionType, amount: number, description?: string): void {
    const transaction = new Transaction(type, amount, this.balance, description);
    this.transactions.push(transaction);
  }

  /**
   * Get account information
   */
  getAccountInfo(): string {
    return `Account: ${this.accountNumber}\nBalance: $${this.balance.toFixed(2)}\nCreated: ${this.createdAt.toISOString()}\nTransactions: ${this.transactions.length}`;
  }
}
