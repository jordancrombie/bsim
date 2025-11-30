import { Request, Response, NextFunction } from 'express';
import { createInteractionRoutes } from '../../routes/interaction';
import { createMockPrismaClient, MockPrismaClient } from '../mocks/mockPrisma';
import { PrismaClient } from '@prisma/client';
import { Provider } from 'oidc-provider';

// Mock the verifyUserPassword function
jest.mock('../../config/oidc', () => ({
  verifyUserPassword: jest.fn(),
}));

import { verifyUserPassword } from '../../config/oidc';
const mockVerifyUserPassword = verifyUserPassword as jest.MockedFunction<typeof verifyUserPassword>;

describe('Interaction Routes', () => {
  let mockPrisma: MockPrismaClient;
  let mockProvider: Partial<Provider>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let interactionDetailsCallback: jest.Mock;
  let interactionFinishedCallback: jest.Mock;
  let clientFindCallback: jest.Mock;

  const testUser = {
    id: 'user-123',
    fiUserRef: 'fi-user-ref-123',
    email: 'test@example.com',
    password: 'hashed-password',
    firstName: 'John',
    lastName: 'Doe',
    phone: null,
    address: null,
    city: null,
    state: null,
    postalCode: null,
    country: null,
    dateOfBirth: null,
    accounts: [
      { id: 'account-1', accountNumber: '1234567890', balance: { toString: () => '1000.00' } },
      { id: 'account-2', accountNumber: '0987654321', balance: { toString: () => '5000.00' } },
    ],
  };

  const testClient = {
    clientId: 'test-client',
    clientName: 'Test Application',
    logoUri: 'https://example.com/logo.png',
  };

  beforeEach(() => {
    mockPrisma = createMockPrismaClient();

    interactionDetailsCallback = jest.fn();
    interactionFinishedCallback = jest.fn();
    clientFindCallback = jest.fn();

    mockProvider = {
      interactionDetails: interactionDetailsCallback,
      interactionFinished: interactionFinishedCallback,
      Client: {
        find: clientFindCallback,
      } as any,
      Grant: jest.fn().mockImplementation(() => ({
        addOIDCScope: jest.fn(),
        addResourceScope: jest.fn(),
        save: jest.fn().mockResolvedValue('grant-id-123'),
      })) as any,
    };

    mockRequest = {
      params: { uid: 'interaction-uid-123' },
      body: {},
    };

    mockResponse = {
      render: jest.fn(),
      redirect: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  afterEach(() => {
    mockPrisma._clear();
    jest.clearAllMocks();
  });

  describe('GET /interaction/:uid', () => {
    it('should return 400 when interaction details not found', async () => {
      interactionDetailsCallback.mockRejectedValue(new Error('Not found'));

      const router = createInteractionRoutes(
        mockProvider as Provider,
        mockPrisma as unknown as PrismaClient
      );
      const handler = router.stack.find(
        (layer: any) => layer.route?.path === '/:uid' && layer.route?.methods?.get
      )?.route?.stack[0]?.handle;

      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.send).toHaveBeenCalledWith('Invalid interaction');
    });

    it('should render login page for login prompt', async () => {
      interactionDetailsCallback.mockResolvedValue({
        uid: 'interaction-uid-123',
        prompt: { name: 'login' },
        params: { client_id: 'test-client' },
        session: null,
      });
      clientFindCallback.mockResolvedValue(testClient);

      const router = createInteractionRoutes(
        mockProvider as Provider,
        mockPrisma as unknown as PrismaClient
      );
      const handler = router.stack.find(
        (layer: any) => layer.route?.path === '/:uid' && layer.route?.methods?.get
      )?.route?.stack[0]?.handle;

      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.render).toHaveBeenCalledWith('login', {
        uid: 'interaction-uid-123',
        clientName: 'Test Application',
        clientLogo: 'https://example.com/logo.png',
        error: null,
      });
    });

    it('should render consent page for consent prompt', async () => {
      mockPrisma._addUser(testUser);
      interactionDetailsCallback.mockResolvedValue({
        uid: 'interaction-uid-123',
        prompt: { name: 'consent' },
        params: {
          client_id: 'test-client',
          scope: 'openid profile email fdx:accountdetailed:read',
        },
        session: { accountId: 'fi-user-ref-123' },
      });
      clientFindCallback.mockResolvedValue(testClient);

      const router = createInteractionRoutes(
        mockProvider as Provider,
        mockPrisma as unknown as PrismaClient
      );
      const handler = router.stack.find(
        (layer: any) => layer.route?.path === '/:uid' && layer.route?.methods?.get
      )?.route?.stack[0]?.handle;

      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.render).toHaveBeenCalledWith('consent', {
        uid: 'interaction-uid-123',
        clientName: 'Test Application',
        clientLogo: 'https://example.com/logo.png',
        scopes: expect.arrayContaining([
          expect.objectContaining({ name: 'openid' }),
          expect.objectContaining({ name: 'profile' }),
          expect.objectContaining({ name: 'email' }),
          expect.objectContaining({ name: 'fdx:accountdetailed:read' }),
        ]),
        accounts: testUser.accounts,
        user: {
          name: 'John Doe',
          email: 'test@example.com',
        },
      });
    });

    it('should use Unknown Application when client not found', async () => {
      interactionDetailsCallback.mockResolvedValue({
        uid: 'interaction-uid-123',
        prompt: { name: 'login' },
        params: { client_id: 'unknown-client' },
        session: null,
      });
      clientFindCallback.mockResolvedValue(null);

      const router = createInteractionRoutes(
        mockProvider as Provider,
        mockPrisma as unknown as PrismaClient
      );
      const handler = router.stack.find(
        (layer: any) => layer.route?.path === '/:uid' && layer.route?.methods?.get
      )?.route?.stack[0]?.handle;

      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.render).toHaveBeenCalledWith('login', {
        uid: 'interaction-uid-123',
        clientName: 'Unknown Application',
        clientLogo: null,
        error: null,
      });
    });

    it('should return 400 for unknown prompt type', async () => {
      interactionDetailsCallback.mockResolvedValue({
        uid: 'interaction-uid-123',
        prompt: { name: 'unknown_prompt' },
        params: { client_id: 'test-client' },
        session: null,
      });
      clientFindCallback.mockResolvedValue(testClient);

      const router = createInteractionRoutes(
        mockProvider as Provider,
        mockPrisma as unknown as PrismaClient
      );
      const handler = router.stack.find(
        (layer: any) => layer.route?.path === '/:uid' && layer.route?.methods?.get
      )?.route?.stack[0]?.handle;

      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.send).toHaveBeenCalledWith('Unknown interaction prompt');
    });
  });

  describe('POST /interaction/:uid/login', () => {
    it('should return 400 when interaction not found', async () => {
      interactionDetailsCallback.mockRejectedValue(new Error('Not found'));

      const router = createInteractionRoutes(
        mockProvider as Provider,
        mockPrisma as unknown as PrismaClient
      );
      const handler = router.stack.find(
        (layer: any) => layer.route?.path === '/:uid/login' && layer.route?.methods?.post
      )?.route?.stack[0]?.handle;

      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.send).toHaveBeenCalledWith('Invalid interaction');
    });

    it('should render login with error for invalid credentials', async () => {
      interactionDetailsCallback.mockResolvedValue({
        uid: 'interaction-uid-123',
        params: { client_id: 'test-client' },
      });
      clientFindCallback.mockResolvedValue(testClient);
      mockVerifyUserPassword.mockResolvedValue(null);
      mockRequest.body = { email: 'wrong@example.com', password: 'wrongpassword' };

      const router = createInteractionRoutes(
        mockProvider as Provider,
        mockPrisma as unknown as PrismaClient
      );
      const handler = router.stack.find(
        (layer: any) => layer.route?.path === '/:uid/login' && layer.route?.methods?.post
      )?.route?.stack[0]?.handle;

      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.render).toHaveBeenCalledWith('login', {
        uid: 'interaction-uid-123',
        clientName: 'Test Application',
        clientLogo: 'https://example.com/logo.png',
        error: 'Invalid email or password',
      });
    });

    it('should finish interaction with login result for valid credentials', async () => {
      interactionDetailsCallback.mockResolvedValue({
        uid: 'interaction-uid-123',
        params: { client_id: 'test-client' },
      });
      mockVerifyUserPassword.mockResolvedValue({
        id: 'user-123',
        fiUserRef: 'fi-user-ref-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      });
      mockRequest.body = { email: 'test@example.com', password: 'correctpassword' };

      const router = createInteractionRoutes(
        mockProvider as Provider,
        mockPrisma as unknown as PrismaClient
      );
      const handler = router.stack.find(
        (layer: any) => layer.route?.path === '/:uid/login' && layer.route?.methods?.post
      )?.route?.stack[0]?.handle;

      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(interactionFinishedCallback).toHaveBeenCalledWith(
        mockRequest,
        mockResponse,
        {
          login: {
            accountId: 'fi-user-ref-123',
            remember: false,
          },
        },
        { mergeWithLastSubmission: false }
      );
    });

    it('should set remember flag when checkbox checked', async () => {
      interactionDetailsCallback.mockResolvedValue({
        uid: 'interaction-uid-123',
        params: { client_id: 'test-client' },
      });
      mockVerifyUserPassword.mockResolvedValue({
        id: 'user-123',
        fiUserRef: 'fi-user-ref-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      });
      mockRequest.body = {
        email: 'test@example.com',
        password: 'correctpassword',
        remember: 'on',
      };

      const router = createInteractionRoutes(
        mockProvider as Provider,
        mockPrisma as unknown as PrismaClient
      );
      const handler = router.stack.find(
        (layer: any) => layer.route?.path === '/:uid/login' && layer.route?.methods?.post
      )?.route?.stack[0]?.handle;

      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(interactionFinishedCallback).toHaveBeenCalledWith(
        mockRequest,
        mockResponse,
        {
          login: {
            accountId: 'fi-user-ref-123',
            remember: true,
          },
        },
        { mergeWithLastSubmission: false }
      );
    });
  });

  describe('POST /interaction/:uid/confirm', () => {
    beforeEach(() => {
      mockPrisma._addUser(testUser);
    });

    it('should return 400 when interaction not found', async () => {
      interactionDetailsCallback.mockRejectedValue(new Error('Not found'));

      const router = createInteractionRoutes(
        mockProvider as Provider,
        mockPrisma as unknown as PrismaClient
      );
      const handler = router.stack.find(
        (layer: any) => layer.route?.path === '/:uid/confirm' && layer.route?.methods?.post
      )?.route?.stack[0]?.handle;

      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.send).toHaveBeenCalledWith('Invalid interaction');
    });

    it('should create consent and finish interaction', async () => {
      interactionDetailsCallback.mockResolvedValue({
        uid: 'interaction-uid-123',
        prompt: { name: 'consent' },
        params: {
          client_id: 'test-client',
          scope: 'openid profile fdx:accountdetailed:read',
        },
        session: { accountId: 'fi-user-ref-123' },
      });
      mockRequest.body = {
        selectedAccounts: ['account-1', 'account-2'],
      };

      const router = createInteractionRoutes(
        mockProvider as Provider,
        mockPrisma as unknown as PrismaClient
      );
      const handler = router.stack.find(
        (layer: any) => layer.route?.path === '/:uid/confirm' && layer.route?.methods?.post
      )?.route?.stack[0]?.handle;

      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      // Should create consent in database
      expect(mockPrisma.consent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          clientId: 'test-client',
          scopes: ['openid', 'profile', 'fdx:accountdetailed:read'],
          accountIds: ['account-1', 'account-2'],
        }),
      });

      // Should finish interaction with grant
      expect(interactionFinishedCallback).toHaveBeenCalledWith(
        mockRequest,
        mockResponse,
        {
          consent: {
            grantId: 'grant-id-123',
          },
        },
        { mergeWithLastSubmission: true }
      );
    });

    it('should return 400 when user not found', async () => {
      mockPrisma._clear(); // Remove test user
      interactionDetailsCallback.mockResolvedValue({
        uid: 'interaction-uid-123',
        prompt: { name: 'consent' },
        params: {
          client_id: 'test-client',
          scope: 'openid',
        },
        session: { accountId: 'nonexistent-user-ref' },
      });

      const router = createInteractionRoutes(
        mockProvider as Provider,
        mockPrisma as unknown as PrismaClient
      );
      const handler = router.stack.find(
        (layer: any) => layer.route?.path === '/:uid/confirm' && layer.route?.methods?.post
      )?.route?.stack[0]?.handle;

      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.send).toHaveBeenCalledWith('User not found');
    });

    it('should handle single account selection', async () => {
      interactionDetailsCallback.mockResolvedValue({
        uid: 'interaction-uid-123',
        prompt: { name: 'consent' },
        params: {
          client_id: 'test-client',
          scope: 'openid',
        },
        session: { accountId: 'fi-user-ref-123' },
      });
      mockRequest.body = {
        selectedAccounts: 'account-1', // Single string, not array
      };

      const router = createInteractionRoutes(
        mockProvider as Provider,
        mockPrisma as unknown as PrismaClient
      );
      const handler = router.stack.find(
        (layer: any) => layer.route?.path === '/:uid/confirm' && layer.route?.methods?.post
      )?.route?.stack[0]?.handle;

      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockPrisma.consent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          accountIds: ['account-1'],
        }),
      });
    });

    it('should handle empty account selection', async () => {
      interactionDetailsCallback.mockResolvedValue({
        uid: 'interaction-uid-123',
        prompt: { name: 'consent' },
        params: {
          client_id: 'test-client',
          scope: 'openid profile',
        },
        session: { accountId: 'fi-user-ref-123' },
      });
      mockRequest.body = {
        // No selectedAccounts
      };

      const router = createInteractionRoutes(
        mockProvider as Provider,
        mockPrisma as unknown as PrismaClient
      );
      const handler = router.stack.find(
        (layer: any) => layer.route?.path === '/:uid/confirm' && layer.route?.methods?.post
      )?.route?.stack[0]?.handle;

      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockPrisma.consent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          accountIds: [],
        }),
      });
    });
  });

  describe('POST /interaction/:uid/abort', () => {
    it('should finish interaction with access_denied error', async () => {
      const router = createInteractionRoutes(
        mockProvider as Provider,
        mockPrisma as unknown as PrismaClient
      );
      const handler = router.stack.find(
        (layer: any) => layer.route?.path === '/:uid/abort' && layer.route?.methods?.post
      )?.route?.stack[0]?.handle;

      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(interactionFinishedCallback).toHaveBeenCalledWith(
        mockRequest,
        mockResponse,
        {
          error: 'access_denied',
          error_description: 'User denied the authorization request',
        },
        { mergeWithLastSubmission: false }
      );
    });
  });
});
