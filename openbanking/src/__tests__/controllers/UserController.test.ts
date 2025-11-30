import { Request, Response } from 'express';
import { UserController } from '../../controllers/userController';
import { createMockPrismaClient, MockPrismaClient } from '../mocks/mockPrisma';
import { PrismaClient } from '@prisma/client';

describe('UserController', () => {
  let userController: UserController;
  let mockPrisma: MockPrismaClient;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  const testFiUserRef = 'fi-user-ref-123';

  beforeEach(() => {
    mockPrisma = createMockPrismaClient();
    userController = new UserController(mockPrisma as unknown as PrismaClient);

    mockRequest = {
      token: {
        sub: testFiUserRef,
        scope: 'fdx:accounts:read',
        scopes: ['fdx:accounts:read'],
        aud: 'https://openbanking.banksim.ca',
        iss: 'https://auth.banksim.ca',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      },
      params: { fiUserRef: testFiUserRef },
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    mockPrisma._clear();
  });

  describe('listUserAccounts', () => {
    it('should return 401 when no token sub is present', async () => {
      mockRequest.token = undefined;

      await userController.listUserAccounts(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'unauthorized',
        error_description: 'Invalid token',
      });
    });

    it('should return 403 when token sub does not match fiUserRef', async () => {
      mockRequest.token!.sub = 'different-user-ref';
      mockRequest.params = { fiUserRef: testFiUserRef };

      await userController.listUserAccounts(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'forbidden',
        error_description: 'Token subject does not match requested user',
      });
    });

    it('should return 404 when user does not exist', async () => {
      await userController.listUserAccounts(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'not_found',
        error_description: 'User not found',
      });
    });

    it('should return user accounts when user exists', async () => {
      const userId = 'user-id-123';
      mockPrisma._addUser({
        id: userId,
        fiUserRef: testFiUserRef,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: null,
        address: null,
        city: null,
        state: null,
        postalCode: null,
        country: null,
        dateOfBirth: null,
      });

      const now = new Date();
      mockPrisma._addAccount({
        id: 'account-1',
        userId: userId,
        accountNumber: '1234567890',
        accountType: 'CHECKING',
        balance: { toString: () => '1000.50' },
        createdAt: now,
        updatedAt: now,
      });

      mockPrisma._addAccount({
        id: 'account-2',
        userId: userId,
        accountNumber: '0987654321',
        accountType: 'SAVINGS',
        balance: { toString: () => '5000.00' },
        createdAt: now,
        updatedAt: now,
      });

      await userController.listUserAccounts(mockRequest as Request, mockResponse as Response);

      const response = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(response.fiUserRef).toBe(testFiUserRef);
      expect(response.accountHolder).toEqual({ name: 'John Doe' });
      expect(response.accounts).toHaveLength(2);
    });

    it('should format accounts correctly', async () => {
      const userId = 'user-id-123';
      const now = new Date();

      mockPrisma._addUser({
        id: userId,
        fiUserRef: testFiUserRef,
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        phone: null,
        address: null,
        city: null,
        state: null,
        postalCode: null,
        country: null,
        dateOfBirth: null,
      });

      mockPrisma._addAccount({
        id: 'account-1',
        userId: userId,
        accountNumber: '9876543210',
        accountType: 'CHECKING',
        balance: { toString: () => '2500.75' },
        createdAt: now,
        updatedAt: now,
      });

      await userController.listUserAccounts(mockRequest as Request, mockResponse as Response);

      const response = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(response.accounts[0]).toMatchObject({
        accountId: 'account-1',
        accountNumber: '9876543210',
        accountNumberMasked: '****3210',
        accountType: 'CHECKING',
        status: 'OPEN',
        currency: 'CAD',
        balance: {
          current: 2500.75,
          available: 2500.75,
        },
      });
    });

    it('should return empty accounts array when user has no accounts', async () => {
      mockPrisma._addUser({
        id: 'user-id-123',
        fiUserRef: testFiUserRef,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: null,
        address: null,
        city: null,
        state: null,
        postalCode: null,
        country: null,
        dateOfBirth: null,
      });

      await userController.listUserAccounts(mockRequest as Request, mockResponse as Response);

      const response = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(response.fiUserRef).toBe(testFiUserRef);
      expect(response.accounts).toEqual([]);
    });

    it('should include openedDate in account response', async () => {
      const userId = 'user-id-123';
      const createdAt = new Date('2023-06-15T10:30:00Z');
      const updatedAt = new Date();

      mockPrisma._addUser({
        id: userId,
        fiUserRef: testFiUserRef,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: null,
        address: null,
        city: null,
        state: null,
        postalCode: null,
        country: null,
        dateOfBirth: null,
      });

      mockPrisma._addAccount({
        id: 'account-1',
        userId: userId,
        accountNumber: '1234567890',
        accountType: 'CHECKING',
        balance: { toString: () => '100' },
        createdAt: createdAt,
        updatedAt: updatedAt,
      });

      await userController.listUserAccounts(mockRequest as Request, mockResponse as Response);

      const response = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(response.accounts[0].openedDate).toBe('2023-06-15');
    });

    it('should include balance asOf timestamp', async () => {
      const userId = 'user-id-123';
      const now = new Date();

      mockPrisma._addUser({
        id: userId,
        fiUserRef: testFiUserRef,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: null,
        address: null,
        city: null,
        state: null,
        postalCode: null,
        country: null,
        dateOfBirth: null,
      });

      mockPrisma._addAccount({
        id: 'account-1',
        userId: userId,
        accountNumber: '1234567890',
        accountType: 'CHECKING',
        balance: { toString: () => '100' },
        createdAt: now,
        updatedAt: now,
      });

      await userController.listUserAccounts(mockRequest as Request, mockResponse as Response);

      const response = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(response.accounts[0].balance.asOf).toBe(now.toISOString());
    });

    it('should handle different account types', async () => {
      const userId = 'user-id-123';
      const now = new Date();

      mockPrisma._addUser({
        id: userId,
        fiUserRef: testFiUserRef,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: null,
        address: null,
        city: null,
        state: null,
        postalCode: null,
        country: null,
        dateOfBirth: null,
      });

      mockPrisma._addAccount({
        id: 'account-1',
        userId: userId,
        accountNumber: '1111111111',
        accountType: 'CHECKING',
        balance: { toString: () => '1000' },
        createdAt: now,
        updatedAt: now,
      });

      mockPrisma._addAccount({
        id: 'account-2',
        userId: userId,
        accountNumber: '2222222222',
        accountType: 'SAVINGS',
        balance: { toString: () => '5000' },
        createdAt: now,
        updatedAt: now,
      });

      mockPrisma._addAccount({
        id: 'account-3',
        userId: userId,
        accountNumber: '3333333333',
        accountType: 'MONEY_MARKET',
        balance: { toString: () => '10000' },
        createdAt: now,
        updatedAt: now,
      });

      await userController.listUserAccounts(mockRequest as Request, mockResponse as Response);

      const response = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(response.accounts).toHaveLength(3);
      expect(response.accounts.map((a: any) => a.accountType)).toContain('CHECKING');
      expect(response.accounts.map((a: any) => a.accountType)).toContain('SAVINGS');
      expect(response.accounts.map((a: any) => a.accountType)).toContain('MONEY_MARKET');
    });

    it('should not return accounts from other users', async () => {
      const userId = 'user-id-123';
      const now = new Date();

      mockPrisma._addUser({
        id: userId,
        fiUserRef: testFiUserRef,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: null,
        address: null,
        city: null,
        state: null,
        postalCode: null,
        country: null,
        dateOfBirth: null,
      });

      // Add account for our user
      mockPrisma._addAccount({
        id: 'account-1',
        userId: userId,
        accountNumber: '1234567890',
        accountType: 'CHECKING',
        balance: { toString: () => '1000' },
        createdAt: now,
        updatedAt: now,
      });

      // Add account for different user
      mockPrisma._addAccount({
        id: 'account-2',
        userId: 'other-user-id',
        accountNumber: '0987654321',
        accountType: 'SAVINGS',
        balance: { toString: () => '5000' },
        createdAt: now,
        updatedAt: now,
      });

      await userController.listUserAccounts(mockRequest as Request, mockResponse as Response);

      const response = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(response.accounts).toHaveLength(1);
      expect(response.accounts[0].accountId).toBe('account-1');
    });
  });
});
