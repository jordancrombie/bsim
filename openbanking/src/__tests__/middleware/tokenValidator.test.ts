import { Request, Response, NextFunction } from 'express';
import { validateToken, requireScope } from '../../middleware/tokenValidator';
import jwt from 'jsonwebtoken';

// Mock jsonwebtoken
jest.mock('jsonwebtoken');
const mockJwt = jwt as jest.Mocked<typeof jwt>;

// Mock jwks-rsa
jest.mock('jwks-rsa', () => {
  return jest.fn().mockImplementation(() => ({
    getSigningKey: jest.fn(),
  }));
});

// Mock config
jest.mock('../../config/env', () => ({
  config: {
    auth: {
      issuer: 'https://auth.banksim.ca',
      jwksUri: 'https://auth.banksim.ca/.well-known/jwks.json',
      audience: 'https://openbanking.banksim.ca',
    },
  },
}));

describe('tokenValidator middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe('validateToken', () => {
    it('should return 401 when no authorization header is present', () => {
      validateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'unauthorized',
        error_description: 'No access token provided',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when authorization header does not start with Bearer', () => {
      mockRequest.headers = { authorization: 'Basic some-credentials' };

      validateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'unauthorized',
        error_description: 'No access token provided',
      });
    });

    it('should return 401 when token verification fails', () => {
      mockRequest.headers = { authorization: 'Bearer invalid-token' };

      // Mock jwt.verify to call callback with error
      mockJwt.verify.mockImplementation((token, getKey, options, callback) => {
        if (typeof callback === 'function') {
          const error = { name: 'JsonWebTokenError', message: 'Token verification failed' } as jwt.VerifyErrors;
          callback(error, undefined);
        }
      });

      validateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'invalid_token',
        error_description: 'Token verification failed',
      });
    });

    it('should populate req.token and call next on valid token', () => {
      mockRequest.headers = { authorization: 'Bearer valid-token' };

      const mockPayload = {
        sub: 'user-123',
        scope: 'fdx:accounts:read fdx:transactions:read profile',
        aud: 'https://openbanking.banksim.ca',
        iss: 'https://auth.banksim.ca',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

      mockJwt.verify.mockImplementation((token, getKey, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, mockPayload);
        }
      });

      validateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect((mockRequest as any).token).toEqual({
        sub: 'user-123',
        scope: 'fdx:accounts:read fdx:transactions:read profile',
        scopes: ['fdx:accounts:read', 'fdx:transactions:read', 'profile'],
        aud: 'https://openbanking.banksim.ca',
        iss: 'https://auth.banksim.ca',
        exp: mockPayload.exp,
        iat: mockPayload.iat,
      });
    });

    it('should handle empty scope correctly', () => {
      mockRequest.headers = { authorization: 'Bearer valid-token' };

      const mockPayload = {
        sub: 'user-123',
        // No scope
        aud: 'https://openbanking.banksim.ca',
        iss: 'https://auth.banksim.ca',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

      mockJwt.verify.mockImplementation((token, getKey, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, mockPayload);
        }
      });

      validateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect((mockRequest as any).token.scopes).toEqual([]);
      expect((mockRequest as any).token.scope).toBe('');
    });

    it('should handle missing sub claim', () => {
      mockRequest.headers = { authorization: 'Bearer valid-token' };

      const mockPayload = {
        // No sub
        scope: 'openid',
        aud: 'https://openbanking.banksim.ca',
        iss: 'https://auth.banksim.ca',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

      mockJwt.verify.mockImplementation((token, getKey, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, mockPayload);
        }
      });

      validateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect((mockRequest as any).token.sub).toBe('');
    });

    it('should extract token from Authorization header correctly', () => {
      const testToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.test';
      mockRequest.headers = { authorization: `Bearer ${testToken}` };

      mockJwt.verify.mockImplementation((token, getKey, options, callback) => {
        expect(token).toBe(testToken);
        if (typeof callback === 'function') {
          callback(null, { sub: 'user-1', aud: '', iss: '' });
        }
      });

      validateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockJwt.verify).toHaveBeenCalledWith(
        testToken,
        expect.any(Function),
        expect.objectContaining({
          issuer: 'https://auth.banksim.ca',
          audience: 'https://openbanking.banksim.ca',
        }),
        expect.any(Function)
      );
    });
  });

  describe('requireScope', () => {
    it('should return 401 when no token is present', () => {
      const middleware = requireScope('fdx:accounts:read');

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'unauthorized',
        error_description: 'No token information available',
      });
    });

    it('should return 403 when required scope is missing', () => {
      (mockRequest as any).token = {
        sub: 'user-123',
        scopes: ['openid', 'profile'],
      };

      const middleware = requireScope('fdx:accounts:read');

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'insufficient_scope',
        error_description: 'Required scopes: fdx:accounts:read',
        scope: 'fdx:accounts:read',
      });
    });

    it('should call next when single required scope is present', () => {
      (mockRequest as any).token = {
        sub: 'user-123',
        scopes: ['fdx:accounts:read', 'profile'],
      };

      const middleware = requireScope('fdx:accounts:read');

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should call next when all required scopes are present', () => {
      (mockRequest as any).token = {
        sub: 'user-123',
        scopes: ['fdx:accounts:read', 'fdx:transactions:read', 'profile'],
      };

      const middleware = requireScope('fdx:accounts:read', 'fdx:transactions:read');

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 403 when only some required scopes are present', () => {
      (mockRequest as any).token = {
        sub: 'user-123',
        scopes: ['fdx:accounts:read'],
      };

      const middleware = requireScope('fdx:accounts:read', 'fdx:transactions:read');

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'insufficient_scope',
        error_description: 'Required scopes: fdx:accounts:read, fdx:transactions:read',
        scope: 'fdx:accounts:read fdx:transactions:read',
      });
    });

    it('should handle empty required scopes (allow all)', () => {
      (mockRequest as any).token = {
        sub: 'user-123',
        scopes: [],
      };

      const middleware = requireScope();

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 403 when token has empty scopes', () => {
      (mockRequest as any).token = {
        sub: 'user-123',
        scopes: [],
      };

      const middleware = requireScope('fdx:accounts:read');

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });

    it('should handle multiple scopes in error message', () => {
      (mockRequest as any).token = {
        sub: 'user-123',
        scopes: ['openid'],
      };

      const middleware = requireScope('profile', 'email', 'fdx:accounts:read');

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'insufficient_scope',
        error_description: 'Required scopes: profile, email, fdx:accounts:read',
        scope: 'profile email fdx:accounts:read',
      });
    });
  });
});
