import { IAccountRepository, AccountData, AccountType } from '../repositories/interfaces/IAccountRepository';
import { ITransactionRepository } from '../repositories/interfaces/ITransactionRepository';
import { IUserRepository } from '../repositories/interfaces/IUserRepository';
import { TransactionType } from '../models/transaction';
import { NotificationService } from './NotificationService';

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
  toAccountNumber?: string;
  toEmail?: string;
  amount: number;
  description?: string;
  senderUserId?: string;
  senderEmail?: string;
}

export class AccountService {
  constructor(
    private accountRepository: IAccountRepository,
    private transactionRepository: ITransactionRepository,
    private userRepository?: IUserRepository,
    private notificationService?: NotificationService
  ) {}

  async createAccount(userId: string, initialBalance: number = 0, accountType: AccountType = 'CHECKING'): Promise<AccountData> {
    if (initialBalance < 0) {
      throw new Error('Initial balance cannot be negative');
    }

    const account = await this.accountRepository.create({ userId, initialBalance, accountType });

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

  async transfer(data: TransferDto): Promise<{ recipientEmail: string; recipientAccountNumber: string }> {
    if (data.amount <= 0) {
      throw new Error('Transfer amount must be positive');
    }

    if (!data.toAccountNumber && !data.toEmail) {
      throw new Error('Either destination account number or recipient email is required');
    }

    const fromAccount = await this.accountRepository.findByAccountNumber(data.fromAccountNumber);
    if (!fromAccount) {
      throw new Error('Source account not found');
    }

    let toAccount: AccountData | null = null;
    let recipientEmail = '';

    if (data.toEmail) {
      // Look up recipient by email
      if (!this.userRepository) {
        throw new Error('User repository not configured for email-based transfers');
      }

      const recipient = await this.userRepository.findByEmail(data.toEmail);
      if (!recipient) {
        throw new Error('Recipient not found');
      }

      recipientEmail = recipient.email;

      // Get recipient's accounts and use the first one
      const recipientAccounts = await this.accountRepository.findByUserId(recipient.id);
      if (recipientAccounts.length === 0) {
        throw new Error('Recipient has no accounts');
      }

      toAccount = recipientAccounts[0];
    } else if (data.toAccountNumber) {
      toAccount = await this.accountRepository.findByAccountNumber(data.toAccountNumber);
      if (!toAccount) {
        throw new Error('Destination account not found');
      }
    }

    if (!toAccount) {
      throw new Error('Could not determine destination account');
    }

    // Prevent transferring to the same account
    if (fromAccount.id === toAccount.id) {
      throw new Error('Cannot transfer to the same account');
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
      description: data.toEmail
        ? `Transfer to ${data.toEmail}: ${data.description || ''}`
        : `Transfer to ${toAccount.accountNumber}: ${data.description || ''}`,
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

    // Send notifications
    if (this.notificationService) {
      // Notify recipient of received funds
      await this.notificationService.notifyTransferReceived(
        toAccount.userId,
        data.senderEmail || data.fromAccountNumber,
        data.amount,
        toAccount.accountNumber
      );

      // Notify sender of successful transfer
      if (data.senderUserId) {
        await this.notificationService.notifyTransferSent(
          data.senderUserId,
          recipientEmail || toAccount.accountNumber,
          data.amount,
          data.fromAccountNumber
        );
      }
    }

    return {
      recipientEmail: recipientEmail || data.toEmail || '',
      recipientAccountNumber: toAccount.accountNumber,
    };
  }

  async getTransactionHistory(accountNumber: string) {
    const account = await this.accountRepository.findByAccountNumber(accountNumber);
    if (!account) {
      throw new Error('Account not found');
    }

    return this.transactionRepository.findByAccountId(account.id);
  }
}
