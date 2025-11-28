import { Account } from './models/account';
import { Transaction } from './models/transaction';

/**
 * Main banking simulator class
 */
export class BankingSimulator {
  private accounts: Map<string, Account>;

  constructor() {
    this.accounts = new Map();
  }

  /**
   * Start the banking simulator
   */
  start(): void {
    console.log('Banking Simulator initialized');
    console.log('System ready for operations');
  }

  /**
   * Create a new account
   */
  createAccount(accountNumber: string, initialBalance: number = 0): Account {
    if (this.accounts.has(accountNumber)) {
      throw new Error(`Account ${accountNumber} already exists`);
    }

    const account = new Account(accountNumber, initialBalance);
    this.accounts.set(accountNumber, account);
    return account;
  }

  /**
   * Get an account by account number
   */
  getAccount(accountNumber: string): Account | undefined {
    return this.accounts.get(accountNumber);
  }

  /**
   * Get all accounts
   */
  getAllAccounts(): Account[] {
    return Array.from(this.accounts.values());
  }
}
