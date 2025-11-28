import { IAccountRepository, AccountData } from '../repositories/interfaces/IAccountRepository';
import { ITransactionRepository } from '../repositories/interfaces/ITransactionRepository';
import { TransactionType } from '../models/transaction';

export interface DepositDto {
  accountNumber: string;
  amount: number;
  description?: string;
}

export interface WithdrawDto {
  accountNumber: string;
  amount: number;
  description?: string;
}

export interface TransferDto {
  fromAccountNumber: string;
  toAccountNumber: string;
  amount: number;
  description?: string;
}

export class AccountService {
  constructor(
    private accountRepository: IAccountRepository,
    private transactionRepository: ITransactionRepository
  ) {}

  async createAccount(userId: string, initialBalance: number = 0): Promise<AccountData> {
    if (initialBalance < 0) {
      throw new Error('Initial balance cannot be negative');
    }

    const account = await this.accountRepository.create({ userId, initialBalance });

    // Create initial deposit transaction if balance > 0
    if (initialBalance > 0) {
      await this.transactionRepository.create({
        type: TransactionType.DEPOSIT,
        amount: initialBalance,
        balanceAfter: initialBalance,
        description: 'Initial deposit',
        accountId: account.id,
      });
    }

    return account;
  }

  async getAccountsByUserId(userId: string): Promise<AccountData[]> {
    return this.accountRepository.findByUserId(userId);
  }

  async getAccountByNumber(accountNumber: string): Promise<AccountData | null> {
    return this.accountRepository.findByAccountNumber(accountNumber);
  }

  async deposit(data: DepositDto): Promise<AccountData> {
    if (data.amount <= 0) {
      throw new Error('Deposit amount must be positive');
    }

    const account = await this.accountRepository.findByAccountNumber(data.accountNumber);
    if (!account) {
      throw new Error('Account not found');
    }

    const newBalance = account.balance + data.amount;

    await this.accountRepository.updateBalance(account.id, newBalance);
    await this.transactionRepository.create({
      type: TransactionType.DEPOSIT,
      amount: data.amount,
      balanceAfter: newBalance,
      description: data.description,
      accountId: account.id,
    });

    return { ...account, balance: newBalance };
  }

  async withdraw(data: WithdrawDto): Promise<AccountData> {
    if (data.amount <= 0) {
      throw new Error('Withdrawal amount must be positive');
    }

    const account = await this.accountRepository.findByAccountNumber(data.accountNumber);
    if (!account) {
      throw new Error('Account not found');
    }

    if (data.amount > account.balance) {
      throw new Error('Insufficient funds');
    }

    const newBalance = account.balance - data.amount;

    await this.accountRepository.updateBalance(account.id, newBalance);
    await this.transactionRepository.create({
      type: TransactionType.WITHDRAWAL,
      amount: data.amount,
      balanceAfter: newBalance,
      description: data.description,
      accountId: account.id,
    });

    return { ...account, balance: newBalance };
  }

  async transfer(data: TransferDto): Promise<void> {
    if (data.amount <= 0) {
      throw new Error('Transfer amount must be positive');
    }

    const fromAccount = await this.accountRepository.findByAccountNumber(data.fromAccountNumber);
    if (!fromAccount) {
      throw new Error('Source account not found');
    }

    const toAccount = await this.accountRepository.findByAccountNumber(data.toAccountNumber);
    if (!toAccount) {
      throw new Error('Destination account not found');
    }

    if (data.amount > fromAccount.balance) {
      throw new Error('Insufficient funds');
    }

    // Deduct from source account
    const fromNewBalance = fromAccount.balance - data.amount;
    await this.accountRepository.updateBalance(fromAccount.id, fromNewBalance);
    await this.transactionRepository.create({
      type: TransactionType.TRANSFER,
      amount: data.amount,
      balanceAfter: fromNewBalance,
      description: `Transfer to ${data.toAccountNumber}: ${data.description || ''}`,
      accountId: fromAccount.id,
    });

    // Add to destination account
    const toNewBalance = toAccount.balance + data.amount;
    await this.accountRepository.updateBalance(toAccount.id, toNewBalance);
    await this.transactionRepository.create({
      type: TransactionType.TRANSFER,
      amount: data.amount,
      balanceAfter: toNewBalance,
      description: `Transfer from ${data.fromAccountNumber}: ${data.description || ''}`,
      accountId: toAccount.id,
    });
  }

  async getTransactionHistory(accountNumber: string) {
    const account = await this.accountRepository.findByAccountNumber(accountNumber);
    if (!account) {
      throw new Error('Account not found');
    }

    return this.transactionRepository.findByAccountId(account.id);
  }
}
