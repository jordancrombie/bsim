import { Request, Response } from 'express';
import { AccountController } from '../../controllers/accountController';
import { createMockPrismaClient, MockPrismaClient } from '../mocks/mockPrisma';
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

describe('AccountController', () => {
  let accountController: AccountController;
  let mockPrisma: MockPrismaClient;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  const testUserId = 'user-123';
  const testFiUserRef = 'fi-user-ref-123'; // External identifier in token's sub claim

  beforeEach(() => {
    mockPrisma = createMockPrismaClient();
    accountController = new AccountController(mockPrisma as unknown as PrismaClient);

    // Add user with fiUserRef matching the token's sub claim
    mockPrisma._addUser({
      id: testUserId,
      fiUserRef: testFiUserRef,
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      phone: null,
      address: null,
      city: null,
      state: null,
      postalCode: null,
      country: null,
      dateOfBirth: null,
    });

    mockRequest = {
      token: {
        sub: testFiUserRef, // Token's sub contains fiUserRef, not internal userId
        scope: 'fdx:accounts:read',
        scopes: ['fdx:accounts:read'],
        aud: 'https://openbanking.banksim.ca',
        iss: 'https://auth.banksim.ca',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      },
      query: {},
      params: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    mockPrisma._clear();
  });

  describe('listAccounts', () => {
    it('should return 401 when no token sub is present', async () => {
      mockRequest.token = undefined;

      await accountController.listAccounts(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'unauthorized',
        error_description: 'Invalid token',
      });
    });

    it('should return empty accounts array when user has no accounts', async () => {
      await accountController.listAccounts(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({ accounts: [] });
    });

    it('should return accounts in FDX format', async () => {
      const now = new Date();
      mockPrisma._addAccount({
        id: 'account-1',
        userId: testUserId,
        accountNumber: '1234567890',
        accountType: 'CHECKING',
        balance: { toString: () => '1000.50' },
        createdAt: now,
        updatedAt: now,
        user: { firstName: 'John', lastName: 'Doe' },
      });

      await accountController.listAccounts(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalled();
      const response = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(response.accounts).toHaveLength(1);
      expect(response.accounts[0]).toMatchObject({
        accountId: 'account-1',
        accountNumber: '****7890',
        accountNumberDisplay: '****7890',
        accountType: 'CHECKING',
        status: 'OPEN',
        currency: { currencyCode: 'CAD' },
        balance: {
          current: 1000.50,
          available: 1000.50,
        },
        accountHolder: { name: 'John Doe' },
      });
    });

    it('should mask account numbers correctly', async () => {
      mockPrisma._addAccount({
        id: 'account-1',
        userId: testUserId,
        accountNumber: '9876543210',
        accountType: 'SAVINGS',
        balance: { toString: () => '500' },
        createdAt: new Date(),
        updatedAt: new Date(),
        user: { firstName: 'Jane', lastName: 'Smith' },
      });

      await accountController.listAccounts(mockRequest as Request, mockResponse as Response);

      const response = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(response.accounts[0].accountNumber).toBe('****3210');
      expect(response.accounts[0].accountNumberDisplay).toBe('****3210');
    });

    it('should respect limit parameter', async () => {
      for (let i = 0; i < 10; i++) {
        mockPrisma._addAccount({
          id: `account-${i}`,
          userId: testUserId,
          accountNumber: `123456789${i}`,
          accountType: 'CHECKING',
          balance: { toString: () => '100' },
          createdAt: new Date(Date.now() - i * 1000),
          updatedAt: new Date(),
          user: { firstName: 'John', lastName: 'Doe' },
        });
      }

      mockRequest.query = { limit: '5' };

      await accountController.listAccounts(mockRequest as Request, mockResponse as Response);

      const response = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(response.accounts.length).toBe(5);
    });

    it('should include pagination info when there are more results', async () => {
      for (let i = 0; i < 30; i++) {
        mockPrisma._addAccount({
          id: `account-${i}`,
          userId: testUserId,
          accountNumber: `123456789${i}`,
          accountType: 'CHECKING',
          balance: { toString: () => '100' },
          createdAt: new Date(Date.now() - i * 1000),
          updatedAt: new Date(),
          user: { firstName: 'John', lastName: 'Doe' },
        });
      }

      mockRequest.query = { limit: '10', offset: '0' };

      await accountController.listAccounts(mockRequest as Request, mockResponse as Response);

      const response = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(response.page).toEqual({ nextOffset: 10 });
    });

    it('should not include pagination when there are no more results', async () => {
      mockPrisma._addAccount({
        id: 'account-1',
        userId: testUserId,
        accountNumber: '1234567890',
        accountType: 'CHECKING',
        balance: { toString: () => '100' },
        createdAt: new Date(),
        updatedAt: new Date(),
        user: { firstName: 'John', lastName: 'Doe' },
      });

      await accountController.listAccounts(mockRequest as Request, mockResponse as Response);

      const response = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(response.page).toBeUndefined();
    });

    it('should not return accounts from other users', async () => {
      mockPrisma._addAccount({
        id: 'account-1',
        userId: testUserId,
        accountNumber: '1234567890',
        accountType: 'CHECKING',
        balance: { toString: () => '100' },
        createdAt: new Date(),
        updatedAt: new Date(),
        user: { firstName: 'John', lastName: 'Doe' },
      });

      mockPrisma._addAccount({
        id: 'account-2',
        userId: 'other-user',
        accountNumber: '0987654321',
        accountType: 'SAVINGS',
        balance: { toString: () => '500' },
        createdAt: new Date(),
        updatedAt: new Date(),
        user: { firstName: 'Other', lastName: 'User' },
      });

      await accountController.listAccounts(mockRequest as Request, mockResponse as Response);

      const response = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(response.accounts).toHaveLength(1);
      expect(response.accounts[0].accountId).toBe('account-1');
    });

    it('should cap limit at 100', async () => {
      mockRequest.query = { limit: '200' };

      await accountController.listAccounts(mockRequest as Request, mockResponse as Response);

      // The mock should have been called with take: 101 (limit + 1)
      expect(mockPrisma.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 101,
        })
      );
    });
  });

  describe('getAccount', () => {
    it('should return 401 when no token sub is present', async () => {
      mockRequest.token = undefined;
      mockRequest.params = { accountId: 'account-1' };

      await accountController.getAccount(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'unauthorized',
        error_description: 'Invalid token',
      });
    });

    it('should return 404 when account does not exist', async () => {
      mockRequest.params = { accountId: 'nonexistent' };

      await accountController.getAccount(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'not_found',
        error_description: 'Account not found',
      });
    });

    it('should return 404 when account belongs to different user', async () => {
      mockPrisma._addAccount({
        id: 'account-1',
        userId: 'other-user',
        accountNumber: '1234567890',
        accountType: 'CHECKING',
        balance: { toString: () => '100' },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockRequest.params = { accountId: 'account-1' };

      await accountController.getAccount(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('should return account details in FDX format', async () => {
      const now = new Date();
      mockPrisma._addAccount({
        id: 'account-1',
        userId: testUserId,
        accountNumber: '1234567890',
        accountType: 'SAVINGS',
        balance: { toString: () => '2500.75' },
        createdAt: now,
        updatedAt: now,
        user: { firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
      });

      mockRequest.params = { accountId: 'account-1' };

      await accountController.getAccount(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalled();
      const response = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(response.account).toMatchObject({
        accountId: 'account-1',
        accountNumber: '****7890',
        accountType: 'SAVINGS',
        status: 'OPEN',
        currency: { currencyCode: 'CAD' },
        balance: {
          current: 2500.75,
          available: 2500.75,
        },
        accountHolder: {
          name: 'John Doe',
          email: 'john@example.com',
        },
      });
    });
  });

  describe('getTransactions', () => {
    beforeEach(() => {
      mockPrisma._addAccount({
        id: 'account-1',
        userId: testUserId,
        accountNumber: '1234567890',
        accountType: 'CHECKING',
        balance: { toString: () => '1000' },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    it('should return 401 when no token sub is present', async () => {
      mockRequest.token = undefined;
      mockRequest.params = { accountId: 'account-1' };

      await accountController.getTransactions(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });

    it('should return 404 when account does not exist', async () => {
      mockRequest.params = { accountId: 'nonexistent' };

      await accountController.getTransactions(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'not_found',
        error_description: 'Account not found',
      });
    });

    it('should return 404 when account belongs to different user', async () => {
      mockPrisma._clear();
      // Re-add the requesting user (cleared above)
      mockPrisma._addUser({
        id: testUserId,
        fiUserRef: testFiUserRef,
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        phone: null,
        address: null,
        city: null,
        state: null,
        postalCode: null,
        country: null,
        dateOfBirth: null,
      });
      // Add account owned by a different user
      mockPrisma._addAccount({
        id: 'account-1',
        userId: 'other-user',
        accountNumber: '1234567890',
        accountType: 'CHECKING',
        balance: { toString: () => '1000' },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockRequest.params = { accountId: 'account-1' };

      await accountController.getTransactions(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('should return empty transactions array when no transactions exist', async () => {
      mockRequest.params = { accountId: 'account-1' };

      await accountController.getTransactions(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({ transactions: [] });
    });

    it('should return transactions in FDX format', async () => {
      const now = new Date();
      mockPrisma._addTransaction({
        id: 'tx-1',
        accountId: 'account-1',
        type: 'DEPOSIT',
        amount: { toString: () => '100.00' },
        description: 'Payroll deposit',
        balanceAfter: { toString: () => '1100.00' },
        createdAt: now,
      });

      mockRequest.params = { accountId: 'account-1' };

      await accountController.getTransactions(mockRequest as Request, mockResponse as Response);

      const response = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(response.transactions).toHaveLength(1);
      expect(response.transactions[0]).toMatchObject({
        transactionId: 'tx-1',
        transactionType: 'DEPOSIT',
        amount: 100.00,
        debitCreditMemo: 'CREDIT',
        status: 'POSTED',
        description: 'Payroll deposit',
        runningBalance: 1100.00,
      });
    });

    it('should mark WITHDRAWAL as DEBIT', async () => {
      mockPrisma._addTransaction({
        id: 'tx-1',
        accountId: 'account-1',
        type: 'WITHDRAWAL',
        amount: { toString: () => '50.00' },
        description: 'ATM withdrawal',
        balanceAfter: { toString: () => '950.00' },
        createdAt: new Date(),
      });

      mockRequest.params = { accountId: 'account-1' };

      await accountController.getTransactions(mockRequest as Request, mockResponse as Response);

      const response = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(response.transactions[0].debitCreditMemo).toBe('DEBIT');
    });

    it('should respect pagination parameters', async () => {
      for (let i = 0; i < 30; i++) {
        mockPrisma._addTransaction({
          id: `tx-${i}`,
          accountId: 'account-1',
          type: 'DEPOSIT',
          amount: { toString: () => '10.00' },
          description: `Transaction ${i}`,
          balanceAfter: { toString: () => '1000.00' },
          createdAt: new Date(Date.now() - i * 1000),
        });
      }

      mockRequest.params = { accountId: 'account-1' };
      mockRequest.query = { limit: '10', offset: '0' };

      await accountController.getTransactions(mockRequest as Request, mockResponse as Response);

      const response = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(response.transactions.length).toBe(10);
      expect(response.page).toEqual({ nextOffset: 10 });
    });

    it('should use transaction type as description when description is null', async () => {
      mockPrisma._addTransaction({
        id: 'tx-1',
        accountId: 'account-1',
        type: 'TRANSFER',
        amount: { toString: () => '25.00' },
        description: null,
        balanceAfter: { toString: () => '975.00' },
        createdAt: new Date(),
      });

      mockRequest.params = { accountId: 'account-1' };

      await accountController.getTransactions(mockRequest as Request, mockResponse as Response);

      const response = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(response.transactions[0].description).toBe('TRANSFER');
    });

    it('should filter transactions by date range', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

      mockPrisma._addTransaction({
        id: 'tx-1',
        accountId: 'account-1',
        type: 'DEPOSIT',
        amount: { toString: () => '100.00' },
        description: 'Today',
        balanceAfter: { toString: () => '1000.00' },
        createdAt: now,
      });

      mockPrisma._addTransaction({
        id: 'tx-2',
        accountId: 'account-1',
        type: 'DEPOSIT',
        amount: { toString: () => '200.00' },
        description: 'Yesterday',
        balanceAfter: { toString: () => '900.00' },
        createdAt: yesterday,
      });

      mockRequest.params = { accountId: 'account-1' };
      mockRequest.query = {
        startTime: yesterday.toISOString(),
        endTime: now.toISOString(),
      };

      await accountController.getTransactions(mockRequest as Request, mockResponse as Response);

      const response = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(response.transactions.length).toBe(2);
    });
  });
});
