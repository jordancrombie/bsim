import { Request, Response, NextFunction } from 'express';
import {
  createAdminToken,
  verifyAdminToken,
  createAdminAuthMiddleware,
  setAdminCookie,
  clearAdminCookie,
  AdminSession,
} from '../../middleware/adminAuth';
import { createMockPrismaClient, MockPrismaClient } from '../mocks/mockPrisma';
import { PrismaClient } from '@prisma/client';

describe('Admin Auth Middleware', () => {
  let mockPrisma: MockPrismaClient;

  const testAdmin = {
    id: 'admin-123',
    email: 'admin@banksim.ca',
    firstName: 'Test',
    lastName: 'Admin',
    role: 'admin',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockPrisma = createMockPrismaClient();
  });

  afterEach(() => {
    mockPrisma._clear();
  });

  describe('createAdminToken / verifyAdminToken', () => {
    it('should create and verify a valid JWT token', async () => {
      const session: AdminSession = {
        userId: 'admin-123',
        email: 'admin@banksim.ca',
        role: 'admin',
      };

      const token = await createAdminToken(session);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const verified = await verifyAdminToken(token);
      expect(verified).not.toBeNull();
      expect(verified?.userId).toBe('admin-123');
      expect(verified?.email).toBe('admin@banksim.ca');
      expect(verified?.role).toBe('admin');
    });

    it('should return null for invalid token', async () => {
      const result = await verifyAdminToken('invalid-token');
      expect(result).toBeNull();
    });

    it('should return null for malformed JWT', async () => {
      const result = await verifyAdminToken('not.a.jwt');
      expect(result).toBeNull();
    });

    it('should return null for tampered token', async () => {
      const session: AdminSession = {
        userId: 'admin-123',
        email: 'admin@banksim.ca',
        role: 'admin',
      };

      const token = await createAdminToken(session);
      // Tamper with the token
      const tamperedToken = token.slice(0, -5) + 'XXXXX';

      const result = await verifyAdminToken(tamperedToken);
      expect(result).toBeNull();
    });
  });

  describe('createAdminAuthMiddleware', () => {
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
      mockRequest = {
        cookies: {},
      };

      mockResponse = {
        redirect: jest.fn(),
        clearCookie: jest.fn(),
      };

      mockNext = jest.fn();
    });

    it('should redirect to login when no token cookie exists', async () => {
      mockRequest.cookies = {};

      const middleware = createAdminAuthMiddleware(mockPrisma as unknown as PrismaClient);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.redirect).toHaveBeenCalledWith('/administration/login');
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should redirect to login and clear cookie for invalid token', async () => {
      mockRequest.cookies = { auth_admin_token: 'invalid-token' };

      const middleware = createAdminAuthMiddleware(mockPrisma as unknown as PrismaClient);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.clearCookie).toHaveBeenCalledWith('auth_admin_token');
      expect(mockResponse.redirect).toHaveBeenCalledWith('/administration/login');
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should redirect to login when admin no longer exists in database', async () => {
      const session: AdminSession = {
        userId: 'deleted-admin',
        email: 'deleted@banksim.ca',
        role: 'admin',
      };
      const token = await createAdminToken(session);
      mockRequest.cookies = { auth_admin_token: token };

      const middleware = createAdminAuthMiddleware(mockPrisma as unknown as PrismaClient);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.clearCookie).toHaveBeenCalledWith('auth_admin_token');
      expect(mockResponse.redirect).toHaveBeenCalledWith('/administration/login');
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call next and attach admin to request for valid token', async () => {
      mockPrisma._addAdminUser(testAdmin);

      const session: AdminSession = {
        userId: testAdmin.id,
        email: testAdmin.email,
        role: testAdmin.role,
      };
      const token = await createAdminToken(session);
      mockRequest.cookies = { auth_admin_token: token };

      const middleware = createAdminAuthMiddleware(mockPrisma as unknown as PrismaClient);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect((mockRequest as any).admin).toBeDefined();
      expect((mockRequest as any).admin.id).toBe(testAdmin.id);
      expect((mockRequest as any).admin.email).toBe(testAdmin.email);
    });

    it('should select correct fields from admin user', async () => {
      mockPrisma._addAdminUser(testAdmin);

      const session: AdminSession = {
        userId: testAdmin.id,
        email: testAdmin.email,
        role: testAdmin.role,
      };
      const token = await createAdminToken(session);
      mockRequest.cookies = { auth_admin_token: token };

      const middleware = createAdminAuthMiddleware(mockPrisma as unknown as PrismaClient);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockPrisma.adminUser.findUnique).toHaveBeenCalledWith({
        where: { id: testAdmin.id },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
        },
      });
    });
  });

  describe('setAdminCookie', () => {
    it('should set cookie with correct options', () => {
      const mockRes = {
        cookie: jest.fn(),
      };

      setAdminCookie(mockRes as unknown as Response, 'test-token');

      expect(mockRes.cookie).toHaveBeenCalledWith('auth_admin_token', 'test-token', {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/',
      });
    });
  });

  describe('clearAdminCookie', () => {
    it('should clear cookie with correct options', () => {
      const mockRes = {
        clearCookie: jest.fn(),
      };

      clearAdminCookie(mockRes as unknown as Response);

      expect(mockRes.clearCookie).toHaveBeenCalledWith('auth_admin_token', {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
      });
    });
  });
});
