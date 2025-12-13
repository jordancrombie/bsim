import { Request, Response, NextFunction } from 'express';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import { generateToken } from '../../utils/jwt';

describe('authMiddleware', () => {
  let mockRequest: Partial<AuthRequest>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnThis();
    mockRequest = {
      headers: {},
    };
    mockResponse = {
      status: mockStatus,
      json: mockJson,
    };
    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should call next() with valid token', () => {
    const token = generateToken({ userId: 'user-123', email: 'test@example.com' });
    mockRequest.headers = {
      authorization: `Bearer ${token}`,
    };

    authMiddleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRequest.user).toBeDefined();
    expect(mockRequest.user?.userId).toBe('user-123');
    expect(mockRequest.user?.email).toBe('test@example.com');
  });

  it('should return 401 when no authorization header', () => {
    mockRequest.headers = {};

    authMiddleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

    expect(mockStatus).toHaveBeenCalledWith(401);
    expect(mockJson).toHaveBeenCalledWith({ error: 'No token provided' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 when authorization header is empty', () => {
    mockRequest.headers = {
      authorization: '',
    };

    authMiddleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

    expect(mockStatus).toHaveBeenCalledWith(401);
    expect(mockJson).toHaveBeenCalledWith({ error: 'No token provided' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 when authorization header does not start with Bearer', () => {
    mockRequest.headers = {
      authorization: 'Basic some-token',
    };

    authMiddleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

    expect(mockStatus).toHaveBeenCalledWith(401);
    expect(mockJson).toHaveBeenCalledWith({ error: 'No token provided' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 when token is invalid', () => {
    mockRequest.headers = {
      authorization: 'Bearer invalid-token',
    };

    authMiddleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

    expect(mockStatus).toHaveBeenCalledWith(401);
    expect(mockJson).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 when token is malformed', () => {
    mockRequest.headers = {
      authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.invalid-payload.signature',
    };

    authMiddleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

    expect(mockStatus).toHaveBeenCalledWith(401);
    expect(mockJson).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should handle token with only "Bearer " prefix (no actual token)', () => {
    mockRequest.headers = {
      authorization: 'Bearer ',
    };

    authMiddleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

    expect(mockStatus).toHaveBeenCalledWith(401);
    expect(mockJson).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should extract token correctly by removing Bearer prefix', () => {
    const token = generateToken({ userId: 'user-456', email: 'user@test.com' });
    mockRequest.headers = {
      authorization: `Bearer ${token}`,
    };

    authMiddleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRequest.user?.userId).toBe('user-456');
  });
});
