import { Response, NextFunction } from 'express';
import { AccountController } from '../../controllers/accountController';
import { AccountService } from '../../services/AccountService';
import { MockAccountRepository } from '../mocks/MockAccountRepository';
import { MockTransactionRepository } from '../mocks/MockTransactionRepository';
import { MockUserRepository } from '../mocks/MockUserRepository';
import { AuthRequest } from '../../middleware/auth';

describe('AccountController', () => {
  let accountController: AccountController;
  let accountService: AccountService;
  let mockAccountRepository: MockAccountRepository;
  let mockTransactionRepository: MockTransactionRepository;
  let mockUserRepository: MockUserRepository;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  const testUserId = 'user-123';
  const testUserEmail = 'test@example.com';

  beforeEach(() => {
    mockAccountRepository = new MockAccountRepository();
    mockTransactionRepository = new MockTransactionRepository();
    mockUserRepository = new MockUserRepository();
    accountService = new AccountService(mockAccountRepository, mockTransactionRepository, mockUserRepository);
    accountController = new AccountController(accountService);

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  afterEach(() => {
    mockAccountRepository.clear();
    mockTransactionRepository.clear();
    mockUserRepository.clear();
    jest.clearAllMocks();
  });

  describe('createAccount', () => {
    it('should create account and return 201 with account data', async () => {
      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        body: { initialBalance: 1000 },
      } as AuthRequest;

      await accountController.createAccount(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          account: expect.objectContaining({
            userId: testUserId,
            balance: 1000,
          }),
        })
      );
    });

    it('should create account with zero balance when no initial balance provided', async () => {
      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        body: {},
      } as AuthRequest;

      await accountController.createAccount(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          account: expect.objectContaining({
            balance: 0,
          }),
        })
      );
    });

    it('should return 401 when user is not authenticated', async () => {
      const mockRequest = {
        user: undefined,
        body: { initialBalance: 1000 },
      } as AuthRequest;

      await accountController.createAccount(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('should return 400 for negative initial balance', async () => {
      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        body: { initialBalance: -100 },
      } as AuthRequest;

      await accountController.createAccount(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getAccounts', () => {
    it('should return 200 with user accounts', async () => {
      // Create accounts for the user
      await accountService.createAccount(testUserId, 1000);
      await accountService.createAccount(testUserId, 2000);

      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
      } as AuthRequest;

      await accountController.getAccounts(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      const jsonCall = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(jsonCall.accounts.length).toBe(2);
    });

    it('should return 401 when user is not authenticated', async () => {
      const mockRequest = {
        user: undefined,
      } as AuthRequest;

      await accountController.getAccounts(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('should return empty array when user has no accounts', async () => {
      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
      } as AuthRequest;

      await accountController.getAccounts(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({ accounts: [] });
    });

    it('should only return accounts belonging to the authenticated user', async () => {
      await accountService.createAccount(testUserId, 1000);
      await accountService.createAccount('other-user', 2000);

      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
      } as AuthRequest;

      await accountController.getAccounts(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      const jsonCall = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(jsonCall.accounts.length).toBe(1);
      expect(jsonCall.accounts[0].balance).toBe(1000);
    });
  });

  describe('getAccount', () => {
    it('should return 200 with account data', async () => {
      const account = await accountService.createAccount(testUserId, 1000);

      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        params: { accountNumber: account.accountNumber },
      } as unknown as AuthRequest;

      await accountController.getAccount(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          account: expect.objectContaining({
            accountNumber: account.accountNumber,
            balance: 1000,
          }),
        })
      );
    });

    it('should return 404 when account not found', async () => {
      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        params: { accountNumber: 'nonexistent' },
      } as unknown as AuthRequest;

      await accountController.getAccount(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Account not found' });
    });

    it('should return 403 when account belongs to another user', async () => {
      const account = await accountService.createAccount('other-user', 1000);

      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        params: { accountNumber: account.accountNumber },
      } as unknown as AuthRequest;

      await accountController.getAccount(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Forbidden' });
    });
  });

  describe('deposit', () => {
    it('should return 200 with updated account after deposit', async () => {
      const account = await accountService.createAccount(testUserId, 1000);

      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        body: {
          accountNumber: account.accountNumber,
          amount: 500,
        },
      } as AuthRequest;

      await accountController.deposit(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          account: expect.objectContaining({
            balance: 1500,
          }),
        })
      );
    });

    it('should return 400 for non-positive amount', async () => {
      const account = await accountService.createAccount(testUserId, 1000);

      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        body: {
          accountNumber: account.accountNumber,
          amount: 0,
        },
      } as AuthRequest;

      await accountController.deposit(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 when account not found', async () => {
      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        body: {
          accountNumber: 'nonexistent',
          amount: 500,
        },
      } as AuthRequest;

      await accountController.deposit(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Account not found' });
    });

    it('should return 403 when account belongs to another user', async () => {
      const account = await accountService.createAccount('other-user', 1000);

      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        body: {
          accountNumber: account.accountNumber,
          amount: 500,
        },
      } as AuthRequest;

      await accountController.deposit(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Forbidden' });
    });

    it('should accept optional description', async () => {
      const account = await accountService.createAccount(testUserId, 1000);

      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        body: {
          accountNumber: account.accountNumber,
          amount: 500,
          description: 'Paycheck deposit',
        },
      } as AuthRequest;

      await accountController.deposit(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });
  });

  describe('withdraw', () => {
    it('should return 200 with updated account after withdrawal', async () => {
      const account = await accountService.createAccount(testUserId, 1000);

      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        body: {
          accountNumber: account.accountNumber,
          amount: 300,
        },
      } as AuthRequest;

      await accountController.withdraw(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          account: expect.objectContaining({
            balance: 700,
          }),
        })
      );
    });

    it('should return 400 for non-positive amount', async () => {
      const account = await accountService.createAccount(testUserId, 1000);

      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        body: {
          accountNumber: account.accountNumber,
          amount: -100,
        },
      } as AuthRequest;

      await accountController.withdraw(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 when account not found', async () => {
      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        body: {
          accountNumber: 'nonexistent',
          amount: 300,
        },
      } as AuthRequest;

      await accountController.withdraw(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Account not found' });
    });

    it('should return 403 when account belongs to another user', async () => {
      const account = await accountService.createAccount('other-user', 1000);

      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        body: {
          accountNumber: account.accountNumber,
          amount: 300,
        },
      } as AuthRequest;

      await accountController.withdraw(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Forbidden' });
    });

    it('should call next with error for insufficient funds', async () => {
      const account = await accountService.createAccount(testUserId, 100);

      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        body: {
          accountNumber: account.accountNumber,
          amount: 500,
        },
      } as AuthRequest;

      await accountController.withdraw(mockRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('transfer', () => {
    it('should return 200 on successful transfer by account number', async () => {
      const fromAccount = await accountService.createAccount(testUserId, 1000);
      const toAccount = await accountService.createAccount('other-user', 500);

      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        body: {
          fromAccountNumber: fromAccount.accountNumber,
          toAccountNumber: toAccount.accountNumber,
          amount: 300,
        },
      } as AuthRequest;

      await accountController.transfer(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Transfer successful',
        })
      );
    });

    it('should return 200 on successful transfer by email', async () => {
      const sender = await mockUserRepository.create({
        email: 'sender@example.com',
        password: 'hashedpassword',
        firstName: 'Sender',
        lastName: 'User',
      });
      const fromAccount = await accountService.createAccount(sender.id, 1000);

      const recipient = await mockUserRepository.create({
        email: 'recipient@example.com',
        password: 'hashedpassword',
        firstName: 'Recipient',
        lastName: 'User',
      });
      await accountService.createAccount(recipient.id, 500);

      const mockRequest = {
        user: { userId: sender.id, email: 'sender@example.com' },
        body: {
          fromAccountNumber: fromAccount.accountNumber,
          toEmail: 'recipient@example.com',
          amount: 300,
        },
      } as AuthRequest;

      await accountController.transfer(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Transfer successful',
          recipientEmail: 'recipient@example.com',
        })
      );
    });

    it('should return 400 for non-positive amount', async () => {
      const fromAccount = await accountService.createAccount(testUserId, 1000);
      const toAccount = await accountService.createAccount('other-user', 500);

      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        body: {
          fromAccountNumber: fromAccount.accountNumber,
          toAccountNumber: toAccount.accountNumber,
          amount: 0,
        },
      } as AuthRequest;

      await accountController.transfer(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 when neither destination account nor email provided', async () => {
      const fromAccount = await accountService.createAccount(testUserId, 1000);

      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        body: {
          fromAccountNumber: fromAccount.accountNumber,
          amount: 300,
        },
      } as AuthRequest;

      await accountController.transfer(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 when source account not found', async () => {
      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        body: {
          fromAccountNumber: 'nonexistent',
          toAccountNumber: 'some-account',
          amount: 300,
        },
      } as AuthRequest;

      await accountController.transfer(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Source account not found' });
    });

    it('should return 403 when source account belongs to another user', async () => {
      const fromAccount = await accountService.createAccount('other-user', 1000);
      const toAccount = await accountService.createAccount(testUserId, 500);

      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        body: {
          fromAccountNumber: fromAccount.accountNumber,
          toAccountNumber: toAccount.accountNumber,
          amount: 300,
        },
      } as AuthRequest;

      await accountController.transfer(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Forbidden' });
    });

    it('should call next with error for insufficient funds', async () => {
      const fromAccount = await accountService.createAccount(testUserId, 100);
      const toAccount = await accountService.createAccount('other-user', 500);

      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        body: {
          fromAccountNumber: fromAccount.accountNumber,
          toAccountNumber: toAccount.accountNumber,
          amount: 500,
        },
      } as AuthRequest;

      await accountController.transfer(mockRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getTransactions', () => {
    it('should return 200 with transaction history', async () => {
      const account = await accountService.createAccount(testUserId, 1000);
      await accountService.deposit({ accountNumber: account.accountNumber, amount: 500 });
      await accountService.withdraw({ accountNumber: account.accountNumber, amount: 200 });

      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        params: { accountNumber: account.accountNumber },
      } as unknown as AuthRequest;

      await accountController.getTransactions(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      const jsonCall = (mockResponse.json as jest.Mock).mock.calls[0][0];
      // Initial deposit (from createAccount) + deposit + withdrawal = 3 transactions
      expect(jsonCall.transactions.length).toBe(3);
    });

    it('should return 404 when account not found', async () => {
      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        params: { accountNumber: 'nonexistent' },
      } as unknown as AuthRequest;

      await accountController.getTransactions(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Account not found' });
    });

    it('should return 403 when account belongs to another user', async () => {
      const account = await accountService.createAccount('other-user', 1000);

      const mockRequest = {
        user: { userId: testUserId, email: testUserEmail },
        params: { accountNumber: account.accountNumber },
      } as unknown as AuthRequest;

      await accountController.getTransactions(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Forbidden' });
    });
  });
});
