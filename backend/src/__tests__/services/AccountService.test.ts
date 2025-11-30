import { AccountService } from '../../services/AccountService';
import { MockAccountRepository } from '../mocks/MockAccountRepository';
import { MockTransactionRepository } from '../mocks/MockTransactionRepository';
import { TransactionType } from '../../models/transaction';

describe('AccountService', () => {
  let accountService: AccountService;
  let mockAccountRepository: MockAccountRepository;
  let mockTransactionRepository: MockTransactionRepository;

  const testUserId = 'user-123';

  beforeEach(() => {
    mockAccountRepository = new MockAccountRepository();
    mockTransactionRepository = new MockTransactionRepository();
    accountService = new AccountService(mockAccountRepository, mockTransactionRepository);
  });

  afterEach(() => {
    mockAccountRepository.clear();
    mockTransactionRepository.clear();
  });

  describe('createAccount', () => {
    it('should create an account with zero initial balance', async () => {
      const account = await accountService.createAccount(testUserId);

      expect(account).toBeDefined();
      expect(account.userId).toBe(testUserId);
      expect(account.balance).toBe(0);
      expect(account.accountNumber).toBeDefined();
      expect(account.accountNumber.length).toBe(10);
    });

    it('should create an account with specified initial balance', async () => {
      const initialBalance = 1000;
      const account = await accountService.createAccount(testUserId, initialBalance);

      expect(account).toBeDefined();
      expect(account.balance).toBe(initialBalance);
    });

    it('should create initial deposit transaction when balance > 0', async () => {
      const initialBalance = 500;
      await accountService.createAccount(testUserId, initialBalance);

      const transactions = mockTransactionRepository.getAllTransactions();
      expect(transactions.length).toBe(1);
      expect(transactions[0].type).toBe(TransactionType.DEPOSIT);
      expect(transactions[0].amount).toBe(initialBalance);
      expect(transactions[0].balanceAfter).toBe(initialBalance);
      expect(transactions[0].description).toBe('Initial deposit');
    });

    it('should not create transaction when initial balance is zero', async () => {
      await accountService.createAccount(testUserId, 0);

      const transactions = mockTransactionRepository.getAllTransactions();
      expect(transactions.length).toBe(0);
    });

    it('should throw error for negative initial balance', async () => {
      await expect(accountService.createAccount(testUserId, -100)).rejects.toThrow(
        'Initial balance cannot be negative'
      );
    });

    it('should generate unique account numbers', async () => {
      const account1 = await accountService.createAccount(testUserId);
      const account2 = await accountService.createAccount(testUserId);

      expect(account1.accountNumber).not.toBe(account2.accountNumber);
    });
  });

  describe('getAccountsByUserId', () => {
    it('should return empty array when user has no accounts', async () => {
      const accounts = await accountService.getAccountsByUserId(testUserId);

      expect(accounts).toEqual([]);
    });

    it('should return all accounts for a user', async () => {
      await accountService.createAccount(testUserId, 100);
      await accountService.createAccount(testUserId, 200);
      await accountService.createAccount(testUserId, 300);

      const accounts = await accountService.getAccountsByUserId(testUserId);

      expect(accounts.length).toBe(3);
      expect(accounts.map((a) => a.balance).sort()).toEqual([100, 200, 300]);
    });

    it('should not return accounts from other users', async () => {
      await accountService.createAccount(testUserId, 100);
      await accountService.createAccount('other-user', 200);

      const accounts = await accountService.getAccountsByUserId(testUserId);

      expect(accounts.length).toBe(1);
      expect(accounts[0].balance).toBe(100);
    });
  });

  describe('getAccountByNumber', () => {
    it('should return account when found', async () => {
      const created = await accountService.createAccount(testUserId, 500);
      const found = await accountService.getAccountByNumber(created.accountNumber);

      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
      expect(found!.balance).toBe(500);
    });

    it('should return null when account not found', async () => {
      const result = await accountService.getAccountByNumber('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('deposit', () => {
    it('should deposit money and update balance', async () => {
      const account = await accountService.createAccount(testUserId, 100);

      const updated = await accountService.deposit({
        accountNumber: account.accountNumber,
        amount: 50,
      });

      expect(updated.balance).toBe(150);
    });

    it('should create deposit transaction', async () => {
      const account = await accountService.createAccount(testUserId, 100);
      mockTransactionRepository.clear(); // Clear initial deposit transaction

      await accountService.deposit({
        accountNumber: account.accountNumber,
        amount: 50,
        description: 'Test deposit',
      });

      const transactions = mockTransactionRepository.getAllTransactions();
      expect(transactions.length).toBe(1);
      expect(transactions[0].type).toBe(TransactionType.DEPOSIT);
      expect(transactions[0].amount).toBe(50);
      expect(transactions[0].balanceAfter).toBe(150);
      expect(transactions[0].description).toBe('Test deposit');
    });

    it('should throw error for non-positive amount', async () => {
      const account = await accountService.createAccount(testUserId, 100);

      await expect(
        accountService.deposit({
          accountNumber: account.accountNumber,
          amount: 0,
        })
      ).rejects.toThrow('Deposit amount must be positive');

      await expect(
        accountService.deposit({
          accountNumber: account.accountNumber,
          amount: -50,
        })
      ).rejects.toThrow('Deposit amount must be positive');
    });

    it('should throw error for non-existent account', async () => {
      await expect(
        accountService.deposit({
          accountNumber: 'nonexistent',
          amount: 50,
        })
      ).rejects.toThrow('Account not found');
    });
  });

  describe('withdraw', () => {
    it('should withdraw money and update balance', async () => {
      const account = await accountService.createAccount(testUserId, 100);

      const updated = await accountService.withdraw({
        accountNumber: account.accountNumber,
        amount: 30,
      });

      expect(updated.balance).toBe(70);
    });

    it('should create withdrawal transaction', async () => {
      const account = await accountService.createAccount(testUserId, 100);
      mockTransactionRepository.clear();

      await accountService.withdraw({
        accountNumber: account.accountNumber,
        amount: 30,
        description: 'ATM withdrawal',
      });

      const transactions = mockTransactionRepository.getAllTransactions();
      expect(transactions.length).toBe(1);
      expect(transactions[0].type).toBe(TransactionType.WITHDRAWAL);
      expect(transactions[0].amount).toBe(30);
      expect(transactions[0].balanceAfter).toBe(70);
      expect(transactions[0].description).toBe('ATM withdrawal');
    });

    it('should throw error for insufficient funds', async () => {
      const account = await accountService.createAccount(testUserId, 50);

      await expect(
        accountService.withdraw({
          accountNumber: account.accountNumber,
          amount: 100,
        })
      ).rejects.toThrow('Insufficient funds');
    });

    it('should throw error for non-positive amount', async () => {
      const account = await accountService.createAccount(testUserId, 100);

      await expect(
        accountService.withdraw({
          accountNumber: account.accountNumber,
          amount: 0,
        })
      ).rejects.toThrow('Withdrawal amount must be positive');
    });

    it('should throw error for non-existent account', async () => {
      await expect(
        accountService.withdraw({
          accountNumber: 'nonexistent',
          amount: 50,
        })
      ).rejects.toThrow('Account not found');
    });

    it('should allow withdrawing exact balance', async () => {
      const account = await accountService.createAccount(testUserId, 100);

      const updated = await accountService.withdraw({
        accountNumber: account.accountNumber,
        amount: 100,
      });

      expect(updated.balance).toBe(0);
    });
  });

  describe('transfer', () => {
    it('should transfer money between accounts', async () => {
      const fromAccount = await accountService.createAccount(testUserId, 500);
      const toAccount = await accountService.createAccount('other-user', 100);

      const result = await accountService.transfer({
        fromAccountNumber: fromAccount.accountNumber,
        toAccountNumber: toAccount.accountNumber,
        amount: 200,
      });

      expect(result.recipientAccountNumber).toBe(toAccount.accountNumber);

      // Check balances
      const updatedFrom = await accountService.getAccountByNumber(fromAccount.accountNumber);
      const updatedTo = await accountService.getAccountByNumber(toAccount.accountNumber);

      expect(updatedFrom!.balance).toBe(300);
      expect(updatedTo!.balance).toBe(300);
    });

    it('should create transfer transactions for both accounts', async () => {
      const fromAccount = await accountService.createAccount(testUserId, 500);
      const toAccount = await accountService.createAccount('other-user', 100);
      mockTransactionRepository.clear();

      await accountService.transfer({
        fromAccountNumber: fromAccount.accountNumber,
        toAccountNumber: toAccount.accountNumber,
        amount: 200,
        description: 'Test transfer',
      });

      const transactions = mockTransactionRepository.getAllTransactions();
      expect(transactions.length).toBe(2);

      const fromTxn = transactions.find((t) => t.accountId === fromAccount.id);
      const toTxn = transactions.find((t) => t.accountId === toAccount.id);

      expect(fromTxn).toBeDefined();
      expect(fromTxn!.type).toBe(TransactionType.TRANSFER);
      expect(fromTxn!.amount).toBe(200);
      expect(fromTxn!.balanceAfter).toBe(300);

      expect(toTxn).toBeDefined();
      expect(toTxn!.type).toBe(TransactionType.TRANSFER);
      expect(toTxn!.amount).toBe(200);
      expect(toTxn!.balanceAfter).toBe(300);
    });

    it('should throw error for insufficient funds', async () => {
      const fromAccount = await accountService.createAccount(testUserId, 50);
      const toAccount = await accountService.createAccount('other-user', 100);

      await expect(
        accountService.transfer({
          fromAccountNumber: fromAccount.accountNumber,
          toAccountNumber: toAccount.accountNumber,
          amount: 100,
        })
      ).rejects.toThrow('Insufficient funds');
    });

    it('should throw error for non-positive amount', async () => {
      const fromAccount = await accountService.createAccount(testUserId, 500);
      const toAccount = await accountService.createAccount('other-user', 100);

      await expect(
        accountService.transfer({
          fromAccountNumber: fromAccount.accountNumber,
          toAccountNumber: toAccount.accountNumber,
          amount: 0,
        })
      ).rejects.toThrow('Transfer amount must be positive');
    });

    it('should throw error for transferring to same account', async () => {
      const account = await accountService.createAccount(testUserId, 500);

      await expect(
        accountService.transfer({
          fromAccountNumber: account.accountNumber,
          toAccountNumber: account.accountNumber,
          amount: 100,
        })
      ).rejects.toThrow('Cannot transfer to the same account');
    });

    it('should throw error when source account not found', async () => {
      const toAccount = await accountService.createAccount('other-user', 100);

      await expect(
        accountService.transfer({
          fromAccountNumber: 'nonexistent',
          toAccountNumber: toAccount.accountNumber,
          amount: 100,
        })
      ).rejects.toThrow('Source account not found');
    });

    it('should throw error when destination account not found', async () => {
      const fromAccount = await accountService.createAccount(testUserId, 500);

      await expect(
        accountService.transfer({
          fromAccountNumber: fromAccount.accountNumber,
          toAccountNumber: 'nonexistent',
          amount: 100,
        })
      ).rejects.toThrow('Destination account not found');
    });

    it('should throw error when neither destination account nor email provided', async () => {
      const fromAccount = await accountService.createAccount(testUserId, 500);

      await expect(
        accountService.transfer({
          fromAccountNumber: fromAccount.accountNumber,
          amount: 100,
        })
      ).rejects.toThrow('Either destination account number or recipient email is required');
    });
  });

  describe('getTransactionHistory', () => {
    it('should return transaction history for account', async () => {
      const account = await accountService.createAccount(testUserId, 100);

      await accountService.deposit({
        accountNumber: account.accountNumber,
        amount: 50,
      });

      await accountService.withdraw({
        accountNumber: account.accountNumber,
        amount: 25,
      });

      const history = await accountService.getTransactionHistory(account.accountNumber);

      // Initial deposit + deposit + withdrawal = 3 transactions
      expect(history.length).toBe(3);
    });

    it('should throw error for non-existent account', async () => {
      await expect(accountService.getTransactionHistory('nonexistent')).rejects.toThrow(
        'Account not found'
      );
    });
  });
});
