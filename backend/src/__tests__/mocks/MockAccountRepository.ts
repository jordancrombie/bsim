import {
  IAccountRepository,
  CreateAccountDto,
  AccountData,
} from '../../repositories/interfaces/IAccountRepository';

/**
 * Mock account repository for testing
 * Stores accounts in memory and provides all IAccountRepository methods
 */
export class MockAccountRepository implements IAccountRepository {
  private accounts: Map<string, AccountData> = new Map();
  private accountNumberIndex: Map<string, string> = new Map(); // accountNumber -> id
  private userAccountsIndex: Map<string, string[]> = new Map(); // userId -> accountIds[]

  constructor(initialAccounts: Array<AccountData> = []) {
    for (const account of initialAccounts) {
      this.accounts.set(account.id, account);
      this.accountNumberIndex.set(account.accountNumber, account.id);

      const userAccounts = this.userAccountsIndex.get(account.userId) || [];
      userAccounts.push(account.id);
      this.userAccountsIndex.set(account.userId, userAccounts);
    }
  }

  async create(data: CreateAccountDto): Promise<AccountData> {
    const id = `acc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const accountNumber = this.generateAccountNumber();
    const now = new Date();

    const account: AccountData = {
      id,
      accountNumber,
      balance: data.initialBalance || 0,
      userId: data.userId,
      createdAt: now,
      updatedAt: now,
    };

    this.accounts.set(id, account);
    this.accountNumberIndex.set(accountNumber, id);

    const userAccounts = this.userAccountsIndex.get(data.userId) || [];
    userAccounts.push(id);
    this.userAccountsIndex.set(data.userId, userAccounts);

    return account;
  }

  async findByAccountNumber(accountNumber: string): Promise<AccountData | null> {
    const id = this.accountNumberIndex.get(accountNumber);
    if (!id) return null;
    return this.accounts.get(id) || null;
  }

  async findByUserId(userId: string): Promise<AccountData[]> {
    const accountIds = this.userAccountsIndex.get(userId) || [];
    return accountIds
      .map((id) => this.accounts.get(id))
      .filter((account): account is AccountData => account !== undefined);
  }

  async findById(id: string): Promise<AccountData | null> {
    return this.accounts.get(id) || null;
  }

  async updateBalance(id: string, newBalance: number): Promise<void> {
    const account = this.accounts.get(id);
    if (account) {
      account.balance = newBalance;
      account.updatedAt = new Date();
      this.accounts.set(id, account);
    }
  }

  // Helper methods for testing
  private generateAccountNumber(): string {
    return Math.floor(1000000000 + Math.random() * 9000000000).toString();
  }

  clear(): void {
    this.accounts.clear();
    this.accountNumberIndex.clear();
    this.userAccountsIndex.clear();
  }

  getAccountCount(): number {
    return this.accounts.size;
  }

  getAllAccounts(): Array<AccountData> {
    return Array.from(this.accounts.values());
  }
}
