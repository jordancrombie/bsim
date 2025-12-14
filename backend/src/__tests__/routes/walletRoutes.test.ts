import { Request, Response, NextFunction } from 'express';
import { createWalletRoutes } from '../../routes/walletRoutes';

// Mock jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
  verify: jest.fn(),
}));

// Mock crypto
jest.mock('crypto', () => ({
  randomBytes: jest.fn().mockReturnValue({
    toString: jest.fn().mockReturnValue('mock-token-id'),
  }),
}));

// Mock PrismaClient
const mockWalletCredentialFindUnique = jest.fn();
const mockWalletCredentialUpdate = jest.fn();
const mockCreditCardFindMany = jest.fn();
const mockCreditCardFindUnique = jest.fn();
const mockPaymentConsentCreate = jest.fn();

const mockPrisma = {
  walletCredential: {
    findUnique: mockWalletCredentialFindUnique,
    update: mockWalletCredentialUpdate,
  },
  creditCard: {
    findMany: mockCreditCardFindMany,
    findUnique: mockCreditCardFindUnique,
  },
  paymentConsent: {
    create: mockPaymentConsentCreate,
  },
} as any;

// Helper function to extract route handler from router
function getRouteHandler(prisma: any, method: string, path: string) {
  const router = createWalletRoutes(prisma);
  const route = router.stack.find(
    (layer: any) => layer.route?.path === path && layer.route?.stack?.some((s: any) => s.method === method)
  );
  if (!route?.route?.stack) {
    throw new Error(`Route ${method.toUpperCase()} ${path} not found`);
  }
  // Return all middleware and handlers in order
  return route.route.stack.map((s: any) => s.handle);
}

describe('walletRoutes', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;
  let mockNext: NextFunction;

  const validCredential = {
    id: 'cred-123',
    userId: 'user-123',
    walletId: 'wallet-123',
    permittedCards: ['card-123', 'card-456'],
    scopes: ['cards:read', 'payments:create'],
    revokedAt: null,
    expiresAt: new Date(Date.now() + 86400000), // 1 day from now
    credentialToken: 'valid-token',
  };

  const mockCard = {
    id: 'card-123',
    userId: 'user-123',
    cardNumber: '4111111111111234',
    cardType: 'VISA',
    cardHolder: 'Test User',
    expiryMonth: 12,
    expiryYear: 2025,
    user: { fiUserRef: 'fi-user-ref-123' },
  };

  beforeEach(() => {
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnThis();
    mockRequest = {
      headers: {
        authorization: 'Bearer valid-token',
      },
      body: {},
      params: {},
    };
    mockResponse = {
      json: mockJson,
      status: mockStatus,
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('POST /request-token', () => {
    const runRequestTokenHandler = async (req: any, res: any, next: any) => {
      const handlers = getRouteHandler(mockPrisma, 'post', '/request-token');
      // Run middleware first (authenticateWalletCredential)
      for (const handler of handlers) {
        await handler(req, res, next);
        // If response was sent (status called), stop
        if (mockStatus.mock.calls.length > 0 || mockJson.mock.calls.length > 0) {
          return;
        }
      }
    };

    it('should return 401 if no authorization header', async () => {
      mockRequest.headers = {};

      await runRequestTokenHandler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({ error: 'No wallet credential provided' });
    });

    it('should return 401 if authorization header does not start with Bearer', async () => {
      mockRequest.headers = { authorization: 'Basic invalid' };

      await runRequestTokenHandler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({ error: 'No wallet credential provided' });
    });

    it('should return 401 if credential not found', async () => {
      mockWalletCredentialFindUnique.mockResolvedValue(null);

      await runRequestTokenHandler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Invalid wallet credential' });
    });

    it('should return 401 if credential is revoked', async () => {
      mockWalletCredentialFindUnique.mockResolvedValue({
        ...validCredential,
        revokedAt: new Date(),
      });

      await runRequestTokenHandler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Wallet credential has been revoked' });
    });

    it('should return 401 if credential is expired', async () => {
      mockWalletCredentialFindUnique.mockResolvedValue({
        ...validCredential,
        expiresAt: new Date(Date.now() - 1000), // Expired
      });

      await runRequestTokenHandler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Wallet credential has expired' });
    });

    it('should return 403 if wallet does not have payments:create scope', async () => {
      mockWalletCredentialFindUnique.mockResolvedValue({
        ...validCredential,
        scopes: ['cards:read'], // No payments:create
      });
      mockWalletCredentialUpdate.mockResolvedValue({});
      mockRequest.body = { cardId: 'card-123' };

      await runRequestTokenHandler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(403);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Wallet does not have permission to create payments' });
    });

    it('should return 400 if cardId is not provided', async () => {
      mockWalletCredentialFindUnique.mockResolvedValue(validCredential);
      mockWalletCredentialUpdate.mockResolvedValue({});
      mockRequest.body = {}; // No cardId

      await runRequestTokenHandler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({ error: 'cardId is required' });
    });

    it('should return 403 if card is not in permitted cards', async () => {
      mockWalletCredentialFindUnique.mockResolvedValue(validCredential);
      mockWalletCredentialUpdate.mockResolvedValue({});
      mockRequest.body = { cardId: 'card-not-permitted' };

      await runRequestTokenHandler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(403);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Card is not enrolled in this wallet' });
    });

    it('should return 404 if card not found in database', async () => {
      mockWalletCredentialFindUnique.mockResolvedValue(validCredential);
      mockWalletCredentialUpdate.mockResolvedValue({});
      mockCreditCardFindUnique.mockResolvedValue(null);
      mockRequest.body = { cardId: 'card-123' };

      await runRequestTokenHandler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Card not found' });
    });

    it('should return cardToken on success', async () => {
      mockWalletCredentialFindUnique.mockResolvedValue(validCredential);
      mockWalletCredentialUpdate.mockResolvedValue({});
      mockCreditCardFindUnique.mockResolvedValue(mockCard);
      mockPaymentConsentCreate.mockResolvedValue({});
      mockRequest.body = { cardId: 'card-123' };

      await runRequestTokenHandler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockJson).toHaveBeenCalledWith({
        cardToken: 'mock-jwt-token',
      });
    });

    it('should create PaymentConsent record', async () => {
      mockWalletCredentialFindUnique.mockResolvedValue(validCredential);
      mockWalletCredentialUpdate.mockResolvedValue({});
      mockCreditCardFindUnique.mockResolvedValue(mockCard);
      mockPaymentConsentCreate.mockResolvedValue({});
      mockRequest.body = { cardId: 'card-123', merchantId: 'ssim-merchant' };

      await runRequestTokenHandler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockPaymentConsentCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          cardToken: 'mock-token-id',
          userId: 'user-123',
          creditCardId: 'card-123',
          merchantId: 'ssim-merchant',
          merchantName: 'Mobile Wallet Payment',
        }),
      });
    });

    it('should use default merchantId if not provided', async () => {
      mockWalletCredentialFindUnique.mockResolvedValue(validCredential);
      mockWalletCredentialUpdate.mockResolvedValue({});
      mockCreditCardFindUnique.mockResolvedValue(mockCard);
      mockPaymentConsentCreate.mockResolvedValue({});
      mockRequest.body = { cardId: 'card-123' };

      await runRequestTokenHandler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockPaymentConsentCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          merchantId: 'mobile-payment',
        }),
      });
    });

    it('should update lastUsedAt on credential', async () => {
      mockWalletCredentialFindUnique.mockResolvedValue(validCredential);
      mockWalletCredentialUpdate.mockResolvedValue({});
      mockCreditCardFindUnique.mockResolvedValue(mockCard);
      mockPaymentConsentCreate.mockResolvedValue({});
      mockRequest.body = { cardId: 'card-123' };

      await runRequestTokenHandler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockWalletCredentialUpdate).toHaveBeenCalledWith({
        where: { id: 'cred-123' },
        data: { lastUsedAt: expect.any(Date) },
      });
    });

    it('should return 500 on database error', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockWalletCredentialFindUnique.mockResolvedValue(validCredential);
      mockWalletCredentialUpdate.mockResolvedValue({});
      mockCreditCardFindUnique.mockResolvedValue(mockCard);
      mockPaymentConsentCreate.mockRejectedValue(new Error('Database error'));
      mockRequest.body = { cardId: 'card-123' };

      await runRequestTokenHandler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Internal server error' });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('createWalletRoutes', () => {
    it('should create a router with request-token route', () => {
      const router = createWalletRoutes(mockPrisma);

      expect(router).toBeDefined();
      const requestTokenRoute = router.stack.find(
        (layer: any) => layer.route?.path === '/request-token'
      );
      expect(requestTokenRoute).toBeDefined();
    });

    it('should register POST method for request-token route', () => {
      const router = createWalletRoutes(mockPrisma);
      const requestTokenRoute = router.stack.find(
        (layer: any) => layer.route?.path === '/request-token'
      );

      // Check that the route has a POST handler
      const hasPostHandler = requestTokenRoute?.route?.stack?.some(
        (s: any) => s.method === 'post'
      );
      expect(hasPostHandler).toBe(true);
    });

    it('should create all expected routes', () => {
      const router = createWalletRoutes(mockPrisma);
      const paths = router.stack
        .filter((layer: any) => layer.route)
        .map((layer: any) => layer.route.path);

      expect(paths).toContain('/cards');
      expect(paths).toContain('/cards/enroll');
      expect(paths).toContain('/tokens');
      expect(paths).toContain('/request-token');
      expect(paths).toContain('/credentials/:id/status');
      expect(paths).toContain('/credentials/:id/revoke');
    });
  });
});
