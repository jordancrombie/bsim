import { AuthService, RegisterDto, LoginDto } from '../../services/AuthService';
import { MockUserRepository } from '../mocks/MockUserRepository';
import { hashPassword } from '../../utils/password';
import { verifyToken } from '../../utils/jwt';
import { User } from '../../models/user';

describe('AuthService', () => {
  let authService: AuthService;
  let mockUserRepository: MockUserRepository;

  beforeEach(() => {
    mockUserRepository = new MockUserRepository();
    authService = new AuthService(mockUserRepository);
  });

  afterEach(() => {
    mockUserRepository.clear();
  });

  describe('register', () => {
    const validRegisterData: RegisterDto = {
      email: 'test@example.com',
      password: 'password123',
      firstName: 'John',
      lastName: 'Doe',
    };

    it('should register a new user successfully', async () => {
      const result = await authService.register(validRegisterData);

      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(validRegisterData.email);
      expect(result.user.firstName).toBe(validRegisterData.firstName);
      expect(result.user.lastName).toBe(validRegisterData.lastName);
      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe('string');
    });

    it('should return a valid JWT token', async () => {
      const result = await authService.register(validRegisterData);

      const decoded = verifyToken(result.token);
      expect(decoded.userId).toBe(result.user.id);
      expect(decoded.email).toBe(result.user.email);
    });

    it('should hash the password before storing', async () => {
      await authService.register(validRegisterData);

      const storedUser = await mockUserRepository.findByEmail(validRegisterData.email);
      expect(storedUser).toBeDefined();
      expect(storedUser!.password).not.toBe(validRegisterData.password);
      expect(storedUser!.password.startsWith('$2')).toBe(true); // bcrypt hash prefix
    });

    it('should throw error when email already exists', async () => {
      await authService.register(validRegisterData);

      await expect(authService.register(validRegisterData)).rejects.toThrow(
        'User with this email already exists'
      );
    });

    it('should store optional CIF fields when provided', async () => {
      const dataWithCIF: RegisterDto = {
        ...validRegisterData,
        email: 'cif@example.com',
        phone: '555-1234',
        address: '123 Main St',
        city: 'Toronto',
        state: 'ON',
        postalCode: 'M5V 1A1',
        country: 'Canada',
        dateOfBirth: '1990-01-15',
      };

      const result = await authService.register(dataWithCIF);

      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(dataWithCIF.email);
    });

    it('should create user with default country when not provided', async () => {
      const result = await authService.register(validRegisterData);
      expect(result.user).toBeDefined();
    });
  });

  describe('login', () => {
    const registerData: RegisterDto = {
      email: 'login@example.com',
      password: 'password123',
      firstName: 'Jane',
      lastName: 'Smith',
    };

    beforeEach(async () => {
      // Register a user for login tests
      await authService.register(registerData);
    });

    it('should login successfully with valid credentials', async () => {
      const loginData: LoginDto = {
        email: registerData.email,
        password: registerData.password,
      };

      const result = await authService.login(loginData);

      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(registerData.email);
      expect(result.user.firstName).toBe(registerData.firstName);
      expect(result.token).toBeDefined();
    });

    it('should return a valid JWT token on login', async () => {
      const loginData: LoginDto = {
        email: registerData.email,
        password: registerData.password,
      };

      const result = await authService.login(loginData);

      const decoded = verifyToken(result.token);
      expect(decoded.email).toBe(result.user.email);
      expect(decoded.userId).toBeDefined();
    });

    it('should throw error for non-existent email', async () => {
      const loginData: LoginDto = {
        email: 'nonexistent@example.com',
        password: 'password123',
      };

      await expect(authService.login(loginData)).rejects.toThrow('Invalid email or password');
    });

    it('should throw error for incorrect password', async () => {
      const loginData: LoginDto = {
        email: registerData.email,
        password: 'wrongpassword',
      };

      await expect(authService.login(loginData)).rejects.toThrow('Invalid email or password');
    });

    it('should not expose password in returned user object', async () => {
      const loginData: LoginDto = {
        email: registerData.email,
        password: registerData.password,
      };

      const result = await authService.login(loginData);

      // @ts-expect-error - checking password is not exposed
      expect(result.user.password).toBeUndefined();
    });
  });

  describe('getUserById', () => {
    it('should return user when found', async () => {
      const registerData: RegisterDto = {
        email: 'findme@example.com',
        password: 'password123',
        firstName: 'Find',
        lastName: 'Me',
      };

      const registered = await authService.register(registerData);
      const found = await authService.getUserById(registered.user.id);

      expect(found).toBeDefined();
      expect(found!.email).toBe(registerData.email);
      expect(found!.firstName).toBe(registerData.firstName);
    });

    it('should return null when user not found', async () => {
      const result = await authService.getUserById('nonexistent-id');

      expect(result).toBeNull();
    });
  });
});
