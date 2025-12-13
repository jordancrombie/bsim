import { createAuthRoutes } from '../../routes/authRoutes';
import { AuthController } from '../../controllers/authController';

// Mock the auth middleware
jest.mock('../../middleware/auth', () => ({
  authMiddleware: jest.fn((req, res, next) => next()),
}));

describe('authRoutes', () => {
  let mockAuthController: Partial<AuthController>;

  beforeEach(() => {
    mockAuthController = {
      register: jest.fn(),
      login: jest.fn(),
      me: jest.fn(),
      generatePasskeyRegistrationOptions: jest.fn(),
      verifyPasskeyRegistration: jest.fn(),
      generatePasskeyAuthenticationOptions: jest.fn(),
      verifyPasskeyAuthentication: jest.fn(),
      getUserPasskeys: jest.fn(),
      deletePasskey: jest.fn(),
    };
  });

  describe('createAuthRoutes', () => {
    it('should create a router with all auth routes', () => {
      const router = createAuthRoutes(mockAuthController as AuthController);

      expect(router).toBeDefined();

      // Check that all expected routes are registered
      const routes = router.stack
        .filter((layer: any) => layer.route)
        .map((layer: any) => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }));

      // Traditional auth
      expect(routes).toContainEqual({ path: '/register', methods: ['post'] });
      expect(routes).toContainEqual({ path: '/login', methods: ['post'] });
      expect(routes).toContainEqual({ path: '/me', methods: ['get'] });

      // Passkey registration
      expect(routes).toContainEqual({ path: '/passkey/register-options', methods: ['post'] });
      expect(routes).toContainEqual({ path: '/passkey/register-verify', methods: ['post'] });

      // Passkey authentication
      expect(routes).toContainEqual({ path: '/passkey/login-options', methods: ['post'] });
      expect(routes).toContainEqual({ path: '/passkey/login-verify', methods: ['post'] });

      // Passkey management
      expect(routes).toContainEqual({ path: '/passkeys', methods: ['get'] });
      expect(routes).toContainEqual({ path: '/passkeys/:passkeyId', methods: ['delete'] });
    });

    it('should register POST /register for user registration', () => {
      const router = createAuthRoutes(mockAuthController as AuthController);

      const registerRoute = router.stack.find(
        (layer: any) => layer.route?.path === '/register' && layer.route?.methods?.post
      );
      expect(registerRoute).toBeDefined();
    });

    it('should register POST /login for user login', () => {
      const router = createAuthRoutes(mockAuthController as AuthController);

      const loginRoute = router.stack.find(
        (layer: any) => layer.route?.path === '/login' && layer.route?.methods?.post
      );
      expect(loginRoute).toBeDefined();
    });

    it('should register GET /me for current user info', () => {
      const router = createAuthRoutes(mockAuthController as AuthController);

      const meRoute = router.stack.find(
        (layer: any) => layer.route?.path === '/me' && layer.route?.methods?.get
      );
      expect(meRoute).toBeDefined();
    });

    it('should register passkey registration routes', () => {
      const router = createAuthRoutes(mockAuthController as AuthController);

      const registerOptionsRoute = router.stack.find(
        (layer: any) => layer.route?.path === '/passkey/register-options' && layer.route?.methods?.post
      );
      const registerVerifyRoute = router.stack.find(
        (layer: any) => layer.route?.path === '/passkey/register-verify' && layer.route?.methods?.post
      );

      expect(registerOptionsRoute).toBeDefined();
      expect(registerVerifyRoute).toBeDefined();
    });

    it('should register passkey authentication routes', () => {
      const router = createAuthRoutes(mockAuthController as AuthController);

      const loginOptionsRoute = router.stack.find(
        (layer: any) => layer.route?.path === '/passkey/login-options' && layer.route?.methods?.post
      );
      const loginVerifyRoute = router.stack.find(
        (layer: any) => layer.route?.path === '/passkey/login-verify' && layer.route?.methods?.post
      );

      expect(loginOptionsRoute).toBeDefined();
      expect(loginVerifyRoute).toBeDefined();
    });

    it('should register passkey management routes', () => {
      const router = createAuthRoutes(mockAuthController as AuthController);

      const listPasskeysRoute = router.stack.find(
        (layer: any) => layer.route?.path === '/passkeys' && layer.route?.methods?.get
      );
      const deletePasskeyRoute = router.stack.find(
        (layer: any) => layer.route?.path === '/passkeys/:passkeyId' && layer.route?.methods?.delete
      );

      expect(listPasskeysRoute).toBeDefined();
      expect(deletePasskeyRoute).toBeDefined();
    });
  });
});
