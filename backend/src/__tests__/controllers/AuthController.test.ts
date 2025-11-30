import { Request, Response, NextFunction } from 'express';
import { AuthController } from '../../controllers/authController';
import { AuthService } from '../../services/AuthService';
import { PasskeyService } from '../../services/PasskeyService';
import { MockUserRepository } from '../mocks/MockUserRepository';
import { AuthRequest } from '../../middleware/auth';

// Mock PasskeyService since we're not testing passkeys here
const mockPasskeyService = {
  generateRegistrationOptions: jest.fn(),
  verifyRegistration: jest.fn(),
  generateAuthenticationOptions: jest.fn(),
  verifyAuthentication: jest.fn(),
  getUserPasskeys: jest.fn(),
  deletePasskey: jest.fn(),
} as unknown as PasskeyService;

describe('AuthController', () => {
  let authController: AuthController;
  let authService: AuthService;
  let mockUserRepository: MockUserRepository;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockUserRepository = new MockUserRepository();
    authService = new AuthService(mockUserRepository);
    authController = new AuthController(authService, mockPasskeyService);

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  afterEach(() => {
    mockUserRepository.clear();
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a user and return 201 with user and token', async () => {
      const mockRequest = {
        body: {
          email: 'test@example.com',
          password: 'password123',
          firstName: 'John',
          lastName: 'Doe',
        },
      } as AuthRequest;

      await authController.register(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({
            email: 'test@example.com',
            firstName: 'John',
            lastName: 'Doe',
          }),
          token: expect.any(String),
        })
      );
    });

    it('should return 400 for invalid email', async () => {
      const mockRequest = {
        body: {
          email: 'invalid-email',
          password: 'password123',
          firstName: 'John',
          lastName: 'Doe',
        },
      } as AuthRequest;

      await authController.register(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('email'),
        })
      );
    });

    it('should return 400 for password too short', async () => {
      const mockRequest = {
        body: {
          email: 'test@example.com',
          password: '12345', // Less than 6 characters
          firstName: 'John',
          lastName: 'Doe',
        },
      } as AuthRequest;

      await authController.register(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('6 characters'),
        })
      );
    });

    it('should return 400 for missing first name', async () => {
      const mockRequest = {
        body: {
          email: 'test@example.com',
          password: 'password123',
          firstName: '',
          lastName: 'Doe',
        },
      } as AuthRequest;

      await authController.register(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('First name'),
        })
      );
    });

    it('should return 400 for missing last name', async () => {
      const mockRequest = {
        body: {
          email: 'test@example.com',
          password: 'password123',
          firstName: 'John',
          lastName: '',
        },
      } as AuthRequest;

      await authController.register(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('Last name'),
        })
      );
    });

    it('should call next with error when user already exists', async () => {
      const mockRequest = {
        body: {
          email: 'duplicate@example.com',
          password: 'password123',
          firstName: 'John',
          lastName: 'Doe',
        },
      } as AuthRequest;

      // Register first user
      await authController.register(mockRequest, mockResponse as Response, mockNext);

      // Reset mocks
      jest.clearAllMocks();
      mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };

      // Try to register same email again
      await authController.register(mockRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should accept optional CIF fields', async () => {
      const mockRequest = {
        body: {
          email: 'cif@example.com',
          password: 'password123',
          firstName: 'John',
          lastName: 'Doe',
          phone: '555-1234',
          address: '123 Main St',
          city: 'Toronto',
          state: 'ON',
          postalCode: 'M5V 1A1',
          country: 'Canada',
          dateOfBirth: '1990-01-15',
        },
      } as AuthRequest;

      await authController.register(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({
            email: 'cif@example.com',
          }),
        })
      );
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      // Create a user for login tests
      const registerRequest = {
        body: {
          email: 'login@example.com',
          password: 'password123',
          firstName: 'Jane',
          lastName: 'Smith',
        },
      } as AuthRequest;

      await authController.register(registerRequest, mockResponse as Response, mockNext);
      jest.clearAllMocks();
      mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
    });

    it('should login successfully with valid credentials', async () => {
      const mockRequest = {
        body: {
          email: 'login@example.com',
          password: 'password123',
        },
      } as AuthRequest;

      await authController.login(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({
            email: 'login@example.com',
            firstName: 'Jane',
            lastName: 'Smith',
          }),
          token: expect.any(String),
        })
      );
    });

    it('should return 400 for invalid email format', async () => {
      const mockRequest = {
        body: {
          email: 'not-an-email',
          password: 'password123',
        },
      } as AuthRequest;

      await authController.login(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('email'),
        })
      );
    });

    it('should return 400 for empty password', async () => {
      const mockRequest = {
        body: {
          email: 'login@example.com',
          password: '',
        },
      } as AuthRequest;

      await authController.login(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('Password'),
        })
      );
    });

    it('should call next with error for invalid credentials', async () => {
      const mockRequest = {
        body: {
          email: 'login@example.com',
          password: 'wrongpassword',
        },
      } as AuthRequest;

      await authController.login(mockRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should call next with error for non-existent user', async () => {
      const mockRequest = {
        body: {
          email: 'nonexistent@example.com',
          password: 'password123',
        },
      } as AuthRequest;

      await authController.login(mockRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('me', () => {
    let registeredUserId: string;

    beforeEach(async () => {
      // Create a user for /me tests
      const registerRequest = {
        body: {
          email: 'me@example.com',
          password: 'password123',
          firstName: 'Current',
          lastName: 'User',
        },
      } as AuthRequest;

      await authController.register(registerRequest, mockResponse as Response, mockNext);

      // Get the user ID from the response
      const jsonCall = (mockResponse.json as jest.Mock).mock.calls[0][0];
      registeredUserId = jsonCall.user.id;

      jest.clearAllMocks();
      mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
    });

    it('should return current user when authenticated', async () => {
      const mockRequest = {
        user: {
          userId: registeredUserId,
          email: 'me@example.com',
        },
      } as AuthRequest;

      await authController.me(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({
            email: 'me@example.com',
            firstName: 'Current',
            lastName: 'User',
          }),
        })
      );
    });

    it('should return 401 when not authenticated', async () => {
      const mockRequest = {} as AuthRequest; // No user object

      await authController.me(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Unauthorized',
        })
      );
    });

    it('should return 404 when user not found', async () => {
      const mockRequest = {
        user: {
          userId: 'nonexistent-id',
          email: 'me@example.com',
        },
      } as AuthRequest;

      await authController.me(mockRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'User not found',
        })
      );
    });
  });
});
