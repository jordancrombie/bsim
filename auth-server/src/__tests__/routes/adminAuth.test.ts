import { Request, Response, NextFunction } from 'express';
import { createAdminAuthRoutes } from '../../routes/adminAuth';
import { createMockPrismaClient, MockPrismaClient } from '../mocks/mockPrisma';
import { PrismaClient } from '@prisma/client';
import { createAdminToken } from '../../middleware/adminAuth';

// Mock @simplewebauthn/server
jest.mock('@simplewebauthn/server', () => ({
  generateAuthenticationOptions: jest.fn().mockResolvedValue({
    challenge: 'mock-challenge-base64url',
    timeout: 60000,
    rpId: 'banksim.ca',
    allowCredentials: [],
    userVerification: 'preferred',
  }),
  verifyAuthenticationResponse: jest.fn().mockResolvedValue({
    verified: true,
    authenticationInfo: {
      newCounter: 1,
    },
  }),
}));

jest.mock('@simplewebauthn/server/helpers', () => ({
  isoBase64URL: {
    toBuffer: jest.fn().mockReturnValue(Buffer.from('mock-credential-id')),
  },
}));

describe('Admin Auth Routes', () => {
  let mockPrisma: MockPrismaClient;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  const testAdmin = {
    id: 'admin-123',
    email: 'admin@banksim.ca',
    firstName: 'Test',
    lastName: 'Admin',
    role: 'admin',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const testPasskey = {
    id: 'passkey-123',
    adminUserId: 'admin-123',
    credentialId: 'cred-id-base64url',
    credentialPublicKey: Buffer.from('mock-public-key'),
    counter: BigInt(0),
    transports: ['usb', 'nfc'],
    createdAt: new Date(),
    lastUsedAt: null,
  };

  beforeEach(() => {
    mockPrisma = createMockPrismaClient();
    jest.clearAllMocks();

    mockRequest = {
      params: {},
      query: {},
      body: {},
      cookies: {},
    };

    mockResponse = {
      render: jest.fn(),
      redirect: jest.fn(),
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    };

    mockNext = jest.fn();
  });

  afterEach(() => {
    mockPrisma._clear();
  });

  describe('GET /administration/login', () => {
    it('should render login page when not logged in', async () => {
      mockRequest.cookies = {};
      mockRequest.query = {};

      const router = createAdminAuthRoutes(mockPrisma as unknown as PrismaClient);
      const handler = router.stack.find(
        (layer: any) => layer.route?.path === '/login' && layer.route?.methods?.get
      )?.route?.stack[0]?.handle;

      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.render).toHaveBeenCalledWith('admin/login', {
        error: undefined,
      });
    });

    it('should pass error query param to login page', async () => {
      mockRequest.cookies = {};
      mockRequest.query = { error: 'Authentication failed' };

      const router = createAdminAuthRoutes(mockPrisma as unknown as PrismaClient);
      const handler = router.stack.find(
        (layer: any) => layer.route?.path === '/login' && layer.route?.methods?.get
      )?.route?.stack[0]?.handle;

      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.render).toHaveBeenCalledWith('admin/login', {
        error: 'Authentication failed',
      });
    });

    it('should redirect to /administration if already logged in with valid token', async () => {
      mockPrisma._addAdminUser(testAdmin);
      const token = await createAdminToken({
        userId: testAdmin.id,
        email: testAdmin.email,
        role: testAdmin.role,
      });
      mockRequest.cookies = { auth_admin_token: token };

      const router = createAdminAuthRoutes(mockPrisma as unknown as PrismaClient);
      const handler = router.stack.find(
        (layer: any) => layer.route?.path === '/login' && layer.route?.methods?.get
      )?.route?.stack[0]?.handle;

      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.redirect).toHaveBeenCalledWith('/administration');
      expect(mockResponse.render).not.toHaveBeenCalled();
    });

    it('should render login if token is invalid', async () => {
      mockRequest.cookies = { auth_admin_token: 'invalid-token' };
      mockRequest.query = {};

      const router = createAdminAuthRoutes(mockPrisma as unknown as PrismaClient);
      const handler = router.stack.find(
        (layer: any) => layer.route?.path === '/login' && layer.route?.methods?.get
      )?.route?.stack[0]?.handle;

      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.render).toHaveBeenCalledWith('admin/login', {
        error: undefined,
      });
    });
  });

  describe('POST /administration/login-options', () => {
    it('should generate authentication options', async () => {
      mockRequest.body = { email: 'admin@banksim.ca' };

      const router = createAdminAuthRoutes(mockPrisma as unknown as PrismaClient);
      const handler = router.stack.find(
        (layer: any) => layer.route?.path === '/login-options' && layer.route?.methods?.post
      )?.route?.stack[0]?.handle;

      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith({
        options: expect.objectContaining({
          challenge: 'mock-challenge-base64url',
        }),
      });
    });

    it('should include allowCredentials when admin has passkeys', async () => {
      mockPrisma._addAdminUser({ ...testAdmin, passkeys: [testPasskey] });
      mockPrisma._addAdminPasskey(testPasskey);
      mockRequest.body = { email: 'admin@banksim.ca' };

      const router = createAdminAuthRoutes(mockPrisma as unknown as PrismaClient);
      const handler = router.stack.find(
        (layer: any) => layer.route?.path === '/login-options' && layer.route?.methods?.post
      )?.route?.stack[0]?.handle;

      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockPrisma.adminUser.findUnique).toHaveBeenCalledWith({
        where: { email: 'admin@banksim.ca' },
        include: {
          passkeys: {
            select: {
              credentialId: true,
              transports: true,
            },
          },
        },
      });
    });

    it('should handle missing email gracefully', async () => {
      mockRequest.body = {};

      const router = createAdminAuthRoutes(mockPrisma as unknown as PrismaClient);
      const handler = router.stack.find(
        (layer: any) => layer.route?.path === '/login-options' && layer.route?.methods?.post
      )?.route?.stack[0]?.handle;

      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith({
        options: expect.objectContaining({
          challenge: expect.any(String),
        }),
      });
    });
  });

  describe('POST /administration/login-verify', () => {
    it('should return 401 if passkey not found', async () => {
      mockRequest.body = {
        credential: { id: 'nonexistent-cred' },
        email: 'admin@banksim.ca',
      };

      const router = createAdminAuthRoutes(mockPrisma as unknown as PrismaClient);
      const handler = router.stack.find(
        (layer: any) => layer.route?.path === '/login-verify' && layer.route?.methods?.post
      )?.route?.stack[0]?.handle;

      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Passkey not found' });
    });
  });

  describe('POST /administration/logout', () => {
    it('should clear cookie and redirect to login', async () => {
      const router = createAdminAuthRoutes(mockPrisma as unknown as PrismaClient);
      const handler = router.stack.find(
        (layer: any) => layer.route?.path === '/logout' && layer.route?.methods?.post
      )?.route?.stack[0]?.handle;

      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.clearCookie).toHaveBeenCalled();
      expect(mockResponse.redirect).toHaveBeenCalledWith('/administration/login');
    });
  });

  describe('GET /administration/logout', () => {
    it('should clear cookie and redirect to login', async () => {
      const router = createAdminAuthRoutes(mockPrisma as unknown as PrismaClient);
      const handler = router.stack.find(
        (layer: any) => layer.route?.path === '/logout' && layer.route?.methods?.get
      )?.route?.stack[0]?.handle;

      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.clearCookie).toHaveBeenCalled();
      expect(mockResponse.redirect).toHaveBeenCalledWith('/administration/login');
    });
  });
});
