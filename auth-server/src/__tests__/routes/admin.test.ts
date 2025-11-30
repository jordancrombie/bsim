import { Request, Response, NextFunction } from 'express';
import { createAdminRoutes } from '../../routes/admin';
import { createMockPrismaClient, MockPrismaClient } from '../mocks/mockPrisma';
import { PrismaClient } from '@prisma/client';

describe('Admin Routes', () => {
  let mockPrisma: MockPrismaClient;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  const testClient = {
    id: 'client-id-123',
    clientId: 'test-client',
    clientSecret: 'secret-123',
    clientName: 'Test Application',
    redirectUris: ['https://example.com/callback'],
    postLogoutRedirectUris: [],
    grantTypes: ['authorization_code'],
    responseTypes: ['code'],
    scope: 'openid profile email',
    logoUri: null,
    policyUri: null,
    tosUri: null,
    contacts: [],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const testAdmin = {
    id: 'admin-123',
    email: 'admin@banksim.ca',
    firstName: 'Test',
    lastName: 'Admin',
    role: 'admin',
  };

  beforeEach(() => {
    mockPrisma = createMockPrismaClient();

    mockRequest = {
      params: {},
      query: {},
      body: {},
      admin: testAdmin, // Set by auth middleware
    } as any;

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
  });

  describe('GET /administration', () => {
    it('should render clients list with all clients', async () => {
      mockPrisma._addOAuthClient(testClient);
      mockRequest.query = {};

      const router = createAdminRoutes(mockPrisma as unknown as PrismaClient);
      const handler = router.stack.find(
        (layer: any) => layer.route?.path === '/' && layer.route?.methods?.get
      )?.route?.stack[0]?.handle;

      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.render).toHaveBeenCalledWith('admin/clients', {
        clients: expect.arrayContaining([
          expect.objectContaining({ clientId: 'test-client' }),
        ]),
        admin: testAdmin,
        message: undefined,
        error: undefined,
      });
    });

    it('should pass message query param to template', async () => {
      mockRequest.query = { message: 'Client created successfully' };

      const router = createAdminRoutes(mockPrisma as unknown as PrismaClient);
      const handler = router.stack.find(
        (layer: any) => layer.route?.path === '/' && layer.route?.methods?.get
      )?.route?.stack[0]?.handle;

      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.render).toHaveBeenCalledWith(
        'admin/clients',
        expect.objectContaining({
          message: 'Client created successfully',
        })
      );
    });

    it('should pass error query param to template', async () => {
      mockRequest.query = { error: 'Something went wrong' };

      const router = createAdminRoutes(mockPrisma as unknown as PrismaClient);
      const handler = router.stack.find(
        (layer: any) => layer.route?.path === '/' && layer.route?.methods?.get
      )?.route?.stack[0]?.handle;

      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.render).toHaveBeenCalledWith(
        'admin/clients',
        expect.objectContaining({
          error: 'Something went wrong',
        })
      );
    });
  });

  describe('GET /administration/clients/new', () => {
    it('should render new client form', async () => {
      const router = createAdminRoutes(mockPrisma as unknown as PrismaClient);
      const handler = router.stack.find(
        (layer: any) => layer.route?.path === '/clients/new' && layer.route?.methods?.get
      )?.route?.stack[0]?.handle;

      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.render).toHaveBeenCalledWith('admin/client-form', {
        client: null,
        admin: testAdmin,
        isNew: true,
        error: null,
      });
    });
  });

  describe('POST /administration/clients', () => {
    it('should create a new OAuth client', async () => {
      mockRequest.body = {
        clientId: 'new-client',
        clientName: 'New Application',
        redirectUris: 'https://newapp.com/callback\nhttps://newapp.com/callback2',
        postLogoutRedirectUris: '',
        scope: 'openid profile',
        logoUri: '',
        policyUri: '',
        tosUri: '',
        contacts: 'admin@newapp.com',
      };

      const router = createAdminRoutes(mockPrisma as unknown as PrismaClient);
      const handler = router.stack.find(
        (layer: any) => layer.route?.path === '/clients' && layer.route?.methods?.post
      )?.route?.stack[0]?.handle;

      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockPrisma.oAuthClient.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          clientId: 'new-client',
          clientName: 'New Application',
          redirectUris: ['https://newapp.com/callback', 'https://newapp.com/callback2'],
          scope: 'openid profile',
          contacts: ['admin@newapp.com'],
          grantTypes: ['authorization_code'],
          responseTypes: ['code'],
          isActive: true,
        }),
      });

      expect(mockResponse.redirect).toHaveBeenCalledWith(
        expect.stringContaining('/administration?message=Client')
      );
    });

    it('should generate a secure client secret', async () => {
      mockRequest.body = {
        clientId: 'new-client',
        clientName: 'New App',
        redirectUris: 'https://app.com/callback',
        scope: 'openid',
      };

      const router = createAdminRoutes(mockPrisma as unknown as PrismaClient);
      const handler = router.stack.find(
        (layer: any) => layer.route?.path === '/clients' && layer.route?.methods?.post
      )?.route?.stack[0]?.handle;

      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      const createCall = mockPrisma.oAuthClient.create.mock.calls[0][0];
      expect(createCall.data.clientSecret).toBeDefined();
      expect(createCall.data.clientSecret.length).toBe(64); // 32 bytes = 64 hex chars
    });

    it('should handle duplicate clientId error', async () => {
      mockPrisma._addOAuthClient(testClient);
      mockRequest.body = {
        clientId: 'test-client', // Already exists
        clientName: 'Duplicate',
        redirectUris: 'https://dup.com/callback',
        scope: 'openid',
      };

      const router = createAdminRoutes(mockPrisma as unknown as PrismaClient);
      const handler = router.stack.find(
        (layer: any) => layer.route?.path === '/clients' && layer.route?.methods?.post
      )?.route?.stack[0]?.handle;

      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.render).toHaveBeenCalledWith('admin/client-form', {
        client: mockRequest.body,
        admin: testAdmin,
        isNew: true,
        error: 'A client with this ID already exists',
      });
    });

    it('should trim whitespace from input fields', async () => {
      mockRequest.body = {
        clientId: '  trimmed-client  ',
        clientName: '  Trimmed App  ',
        redirectUris: '  https://app.com/callback  ',
        scope: '  openid profile  ',
      };

      const router = createAdminRoutes(mockPrisma as unknown as PrismaClient);
      const handler = router.stack.find(
        (layer: any) => layer.route?.path === '/clients' && layer.route?.methods?.post
      )?.route?.stack[0]?.handle;

      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      const createCall = mockPrisma.oAuthClient.create.mock.calls[0][0];
      expect(createCall.data.clientId).toBe('trimmed-client');
      expect(createCall.data.clientName).toBe('Trimmed App');
      expect(createCall.data.scope).toBe('openid profile');
    });
  });

  describe('GET /administration/clients/:id', () => {
    it('should render edit form for existing client', async () => {
      mockPrisma._addOAuthClient(testClient);
      mockRequest.params = { id: 'client-id-123' };

      const router = createAdminRoutes(mockPrisma as unknown as PrismaClient);
      const handler = router.stack.find(
        (layer: any) => layer.route?.path === '/clients/:id' && layer.route?.methods?.get
      )?.route?.stack[0]?.handle;

      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.render).toHaveBeenCalledWith('admin/client-form', {
        client: expect.objectContaining({ clientId: 'test-client' }),
        admin: testAdmin,
        isNew: false,
        error: null,
      });
    });

    it('should redirect with error when client not found', async () => {
      mockRequest.params = { id: 'nonexistent' };

      const router = createAdminRoutes(mockPrisma as unknown as PrismaClient);
      const handler = router.stack.find(
        (layer: any) => layer.route?.path === '/clients/:id' && layer.route?.methods?.get
      )?.route?.stack[0]?.handle;

      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.redirect).toHaveBeenCalledWith('/administration?error=Client not found');
    });
  });

  describe('POST /administration/clients/:id', () => {
    it('should update existing client', async () => {
      mockPrisma._addOAuthClient(testClient);
      mockRequest.params = { id: 'client-id-123' };
      mockRequest.body = {
        clientName: 'Updated Name',
        redirectUris: 'https://updated.com/callback',
        postLogoutRedirectUris: '',
        scope: 'openid profile email',
        logoUri: 'https://logo.com/logo.png',
        policyUri: '',
        tosUri: '',
        contacts: '',
        isActive: 'on',
      };

      const router = createAdminRoutes(mockPrisma as unknown as PrismaClient);
      const handler = router.stack.find(
        (layer: any) => layer.route?.path === '/clients/:id' && layer.route?.methods?.post
      )?.route?.stack[0]?.handle;

      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockPrisma.oAuthClient.update).toHaveBeenCalledWith({
        where: { id: 'client-id-123' },
        data: expect.objectContaining({
          clientName: 'Updated Name',
          redirectUris: ['https://updated.com/callback'],
          logoUri: 'https://logo.com/logo.png',
          isActive: true,
        }),
      });

      expect(mockResponse.redirect).toHaveBeenCalledWith(
        expect.stringContaining('/administration?message=')
      );
    });

    it('should regenerate secret when requested', async () => {
      mockPrisma._addOAuthClient(testClient);
      mockRequest.params = { id: 'client-id-123' };
      mockRequest.body = {
        clientName: 'Test',
        redirectUris: 'https://test.com/callback',
        scope: 'openid',
        regenerateSecret: 'on',
      };

      const router = createAdminRoutes(mockPrisma as unknown as PrismaClient);
      const handler = router.stack.find(
        (layer: any) => layer.route?.path === '/clients/:id' && layer.route?.methods?.post
      )?.route?.stack[0]?.handle;

      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      const updateCall = mockPrisma.oAuthClient.update.mock.calls[0][0];
      expect(updateCall.data.clientSecret).toBeDefined();
      expect(updateCall.data.clientSecret.length).toBe(64);

      // The redirect URL will have URL-encoded message
      const redirectCall = (mockResponse.redirect as jest.Mock).mock.calls[0][0];
      expect(decodeURIComponent(redirectCall)).toContain('New secret:');
    });

    it('should not regenerate secret when not requested', async () => {
      mockPrisma._addOAuthClient(testClient);
      mockRequest.params = { id: 'client-id-123' };
      mockRequest.body = {
        clientName: 'Test',
        redirectUris: 'https://test.com/callback',
        scope: 'openid',
        // regenerateSecret not set
      };

      const router = createAdminRoutes(mockPrisma as unknown as PrismaClient);
      const handler = router.stack.find(
        (layer: any) => layer.route?.path === '/clients/:id' && layer.route?.methods?.post
      )?.route?.stack[0]?.handle;

      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      const updateCall = mockPrisma.oAuthClient.update.mock.calls[0][0];
      expect(updateCall.data.clientSecret).toBeUndefined();
    });

    it('should set isActive to false when checkbox unchecked', async () => {
      mockPrisma._addOAuthClient(testClient);
      mockRequest.params = { id: 'client-id-123' };
      mockRequest.body = {
        clientName: 'Test',
        redirectUris: 'https://test.com/callback',
        scope: 'openid',
        // isActive not set (checkbox unchecked)
      };

      const router = createAdminRoutes(mockPrisma as unknown as PrismaClient);
      const handler = router.stack.find(
        (layer: any) => layer.route?.path === '/clients/:id' && layer.route?.methods?.post
      )?.route?.stack[0]?.handle;

      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      const updateCall = mockPrisma.oAuthClient.update.mock.calls[0][0];
      expect(updateCall.data.isActive).toBe(false);
    });
  });

  describe('POST /administration/clients/:id/delete', () => {
    it('should delete existing client', async () => {
      mockPrisma._addOAuthClient(testClient);
      mockRequest.params = { id: 'client-id-123' };

      const router = createAdminRoutes(mockPrisma as unknown as PrismaClient);
      const handler = router.stack.find(
        (layer: any) => layer.route?.path === '/clients/:id/delete' && layer.route?.methods?.post
      )?.route?.stack[0]?.handle;

      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockPrisma.oAuthClient.delete).toHaveBeenCalledWith({
        where: { id: 'client-id-123' },
      });

      expect(mockResponse.redirect).toHaveBeenCalledWith(
        expect.stringContaining('/administration?message=Client "Test Application" deleted')
      );
    });

    it('should redirect with error when client not found', async () => {
      mockRequest.params = { id: 'nonexistent' };

      const router = createAdminRoutes(mockPrisma as unknown as PrismaClient);
      const handler = router.stack.find(
        (layer: any) => layer.route?.path === '/clients/:id/delete' && layer.route?.methods?.post
      )?.route?.stack[0]?.handle;

      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.redirect).toHaveBeenCalledWith('/administration?error=Client not found');
      expect(mockPrisma.oAuthClient.delete).not.toHaveBeenCalled();
    });
  });
});
