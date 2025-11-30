import { AccountService } from '../../services/AccountService';
import { MockAccountRepository } from '../mocks/MockAccountRepository';
import { MockTransactionRepository } from '../mocks/MockTransactionRepository';
import { MockUserRepository } from '../mocks/MockUserRepository';
import { MockNotificationRepository } from '../mocks/MockNotificationRepository';
import { NotificationService } from '../../services/NotificationService';
import { TransactionType } from '../../models/transaction';
import { NotificationType } from '../../repositories/interfaces/INotificationRepository';

describe('AccountService', () => {
  let accountService: AccountService;
  let mockAccountRepository: MockAccountRepository;
  let mockTransactionRepository: MockTransactionRepository;
  let mockUserRepository: MockUserRepository;

  const testUserId = 'user-123';

  beforeEach(() => {
    mockAccountRepository = new MockAccountRepository();
    mockTransactionRepository = new MockTransactionRepository();
    mockUserRepository = new MockUserRepository();
    accountService = new AccountService(
      mockAccountRepository,
      mockTransactionRepository,
      mockUserRepository
    );
  });

  afterEach(() => {
    mockAccountRepository.clear();
    mockTransactionRepository.clear();
    mockUserRepository.clear();
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

    it('should allow transferring exact balance', async () => {
      const fromAccount = await accountService.createAccount(testUserId, 500);
      const toAccount = await accountService.createAccount('other-user', 100);

      const result = await accountService.transfer({
        fromAccountNumber: fromAccount.accountNumber,
        toAccountNumber: toAccount.accountNumber,
        amount: 500,
      });

      const updatedFrom = await accountService.getAccountByNumber(fromAccount.accountNumber);
      expect(updatedFrom!.balance).toBe(0);
    });

    it('should include description in transaction records', async () => {
      const fromAccount = await accountService.createAccount(testUserId, 500);
      const toAccount = await accountService.createAccount('other-user', 100);
      mockTransactionRepository.clear();

      await accountService.transfer({
        fromAccountNumber: fromAccount.accountNumber,
        toAccountNumber: toAccount.accountNumber,
        amount: 200,
        description: 'Payment for services',
      });

      const transactions = mockTransactionRepository.getAllTransactions();
      const fromTxn = transactions.find((t) => t.accountId === fromAccount.id);
      const toTxn = transactions.find((t) => t.accountId === toAccount.id);

      expect(fromTxn!.description).toContain('Transfer to');
      expect(fromTxn!.description).toContain('Payment for services');
      expect(toTxn!.description).toContain('Transfer from');
      expect(toTxn!.description).toContain('Payment for services');
    });
  });

  describe('transfer by email', () => {
    it('should transfer money to recipient by email address', async () => {
      // Create sender with account
      const senderUser = await mockUserRepository.create({
        email: 'sender@example.com',
        password: 'hashedpassword',
        firstName: 'Sender',
        lastName: 'User',
      });
      const senderAccount = await accountService.createAccount(senderUser.id, 1000);

      // Create recipient with account
      const recipientUser = await mockUserRepository.create({
        email: 'recipient@example.com',
        password: 'hashedpassword',
        firstName: 'Recipient',
        lastName: 'User',
      });
      const recipientAccount = await accountService.createAccount(recipientUser.id, 500);

      // Transfer by email
      const result = await accountService.transfer({
        fromAccountNumber: senderAccount.accountNumber,
        toEmail: 'recipient@example.com',
        amount: 300,
      });

      expect(result.recipientEmail).toBe('recipient@example.com');
      expect(result.recipientAccountNumber).toBe(recipientAccount.accountNumber);

      // Verify balances
      const updatedSender = await accountService.getAccountByNumber(senderAccount.accountNumber);
      const updatedRecipient = await accountService.getAccountByNumber(recipientAccount.accountNumber);

      expect(updatedSender!.balance).toBe(700);
      expect(updatedRecipient!.balance).toBe(800);
    });

    it('should use recipient primary account when transferring by email', async () => {
      // Create sender
      const senderUser = await mockUserRepository.create({
        email: 'sender@example.com',
        password: 'hashedpassword',
        firstName: 'Sender',
        lastName: 'User',
      });
      const senderAccount = await accountService.createAccount(senderUser.id, 1000);

      // Create recipient with multiple accounts
      const recipientUser = await mockUserRepository.create({
        email: 'recipient@example.com',
        password: 'hashedpassword',
        firstName: 'Recipient',
        lastName: 'User',
      });
      const recipientAccount1 = await accountService.createAccount(recipientUser.id, 100);
      await accountService.createAccount(recipientUser.id, 200); // Second account

      // Transfer by email should use first account
      const result = await accountService.transfer({
        fromAccountNumber: senderAccount.accountNumber,
        toEmail: 'recipient@example.com',
        amount: 250,
      });

      expect(result.recipientAccountNumber).toBe(recipientAccount1.accountNumber);

      const updatedRecipient = await accountService.getAccountByNumber(recipientAccount1.accountNumber);
      expect(updatedRecipient!.balance).toBe(350);
    });

    it('should throw error when recipient email not found', async () => {
      const senderUser = await mockUserRepository.create({
        email: 'sender@example.com',
        password: 'hashedpassword',
        firstName: 'Sender',
        lastName: 'User',
      });
      const senderAccount = await accountService.createAccount(senderUser.id, 1000);

      await expect(
        accountService.transfer({
          fromAccountNumber: senderAccount.accountNumber,
          toEmail: 'nonexistent@example.com',
          amount: 100,
        })
      ).rejects.toThrow('Recipient not found');
    });

    it('should throw error when recipient has no accounts', async () => {
      const senderUser = await mockUserRepository.create({
        email: 'sender@example.com',
        password: 'hashedpassword',
        firstName: 'Sender',
        lastName: 'User',
      });
      const senderAccount = await accountService.createAccount(senderUser.id, 1000);

      // Create recipient without any accounts
      await mockUserRepository.create({
        email: 'recipient@example.com',
        password: 'hashedpassword',
        firstName: 'Recipient',
        lastName: 'User',
      });

      await expect(
        accountService.transfer({
          fromAccountNumber: senderAccount.accountNumber,
          toEmail: 'recipient@example.com',
          amount: 100,
        })
      ).rejects.toThrow('Recipient has no accounts');
    });

    it('should include email in transaction description when transferring by email', async () => {
      const senderUser = await mockUserRepository.create({
        email: 'sender@example.com',
        password: 'hashedpassword',
        firstName: 'Sender',
        lastName: 'User',
      });
      const senderAccount = await accountService.createAccount(senderUser.id, 1000);

      const recipientUser = await mockUserRepository.create({
        email: 'recipient@example.com',
        password: 'hashedpassword',
        firstName: 'Recipient',
        lastName: 'User',
      });
      await accountService.createAccount(recipientUser.id, 500);

      mockTransactionRepository.clear();

      await accountService.transfer({
        fromAccountNumber: senderAccount.accountNumber,
        toEmail: 'recipient@example.com',
        amount: 200,
        description: 'Birthday gift',
      });

      const transactions = mockTransactionRepository.getAllTransactions();
      const senderTxn = transactions.find((t) => t.accountId === senderAccount.id);

      expect(senderTxn!.description).toContain('recipient@example.com');
      expect(senderTxn!.description).toContain('Birthday gift');
    });

    it('should prevent transferring to own account via email', async () => {
      const user = await mockUserRepository.create({
        email: 'user@example.com',
        password: 'hashedpassword',
        firstName: 'Test',
        lastName: 'User',
      });
      const account = await accountService.createAccount(user.id, 1000);

      await expect(
        accountService.transfer({
          fromAccountNumber: account.accountNumber,
          toEmail: 'user@example.com',
          amount: 100,
        })
      ).rejects.toThrow('Cannot transfer to the same account');
    });
  });

  describe('transfer with notifications', () => {
    let mockNotificationRepository: MockNotificationRepository;
    let notificationService: NotificationService;
    let accountServiceWithNotifications: AccountService;

    beforeEach(() => {
      mockNotificationRepository = new MockNotificationRepository();
      notificationService = new NotificationService(mockNotificationRepository);
      accountServiceWithNotifications = new AccountService(
        mockAccountRepository,
        mockTransactionRepository,
        mockUserRepository,
        notificationService
      );
    });

    afterEach(() => {
      mockNotificationRepository.clear();
    });

    it('should send notification to recipient when transfer is received', async () => {
      const senderUser = await mockUserRepository.create({
        email: 'sender@example.com',
        password: 'hashedpassword',
        firstName: 'Sender',
        lastName: 'User',
      });
      const senderAccount = await accountServiceWithNotifications.createAccount(senderUser.id, 1000);

      const recipientUser = await mockUserRepository.create({
        email: 'recipient@example.com',
        password: 'hashedpassword',
        firstName: 'Recipient',
        lastName: 'User',
      });
      await accountServiceWithNotifications.createAccount(recipientUser.id, 500);

      await accountServiceWithNotifications.transfer({
        fromAccountNumber: senderAccount.accountNumber,
        toEmail: 'recipient@example.com',
        amount: 250,
        senderEmail: 'sender@example.com',
      });

      const notifications = mockNotificationRepository.getAllNotifications();
      const recipientNotification = notifications.find(
        (n) => n.userId === recipientUser.id && n.type === NotificationType.TRANSFER_RECEIVED
      );

      expect(recipientNotification).toBeDefined();
      expect(recipientNotification!.title).toContain('Received');
      expect(recipientNotification!.message).toContain('250');
    });

    it('should send notification to sender when transfer is sent', async () => {
      const senderUser = await mockUserRepository.create({
        email: 'sender@example.com',
        password: 'hashedpassword',
        firstName: 'Sender',
        lastName: 'User',
      });
      const senderAccount = await accountServiceWithNotifications.createAccount(senderUser.id, 1000);

      const recipientUser = await mockUserRepository.create({
        email: 'recipient@example.com',
        password: 'hashedpassword',
        firstName: 'Recipient',
        lastName: 'User',
      });
      await accountServiceWithNotifications.createAccount(recipientUser.id, 500);

      await accountServiceWithNotifications.transfer({
        fromAccountNumber: senderAccount.accountNumber,
        toEmail: 'recipient@example.com',
        amount: 250,
        senderUserId: senderUser.id,
        senderEmail: 'sender@example.com',
      });

      const notifications = mockNotificationRepository.getAllNotifications();
      const senderNotification = notifications.find(
        (n) => n.userId === senderUser.id && n.type === NotificationType.TRANSFER_SENT
      );

      expect(senderNotification).toBeDefined();
      expect(senderNotification!.title).toContain('Sent');
      expect(senderNotification!.message).toContain('250');
    });

    it('should send notifications to both parties on successful transfer', async () => {
      const senderUser = await mockUserRepository.create({
        email: 'sender@example.com',
        password: 'hashedpassword',
        firstName: 'Sender',
        lastName: 'User',
      });
      const senderAccount = await accountServiceWithNotifications.createAccount(senderUser.id, 1000);

      const recipientUser = await mockUserRepository.create({
        email: 'recipient@example.com',
        password: 'hashedpassword',
        firstName: 'Recipient',
        lastName: 'User',
      });
      await accountServiceWithNotifications.createAccount(recipientUser.id, 500);

      await accountServiceWithNotifications.transfer({
        fromAccountNumber: senderAccount.accountNumber,
        toEmail: 'recipient@example.com',
        amount: 100,
        senderUserId: senderUser.id,
        senderEmail: 'sender@example.com',
      });

      const notifications = mockNotificationRepository.getAllNotifications();
      expect(notifications.length).toBe(2);

      const types = notifications.map((n) => n.type);
      expect(types).toContain(NotificationType.TRANSFER_RECEIVED);
      expect(types).toContain(NotificationType.TRANSFER_SENT);
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
