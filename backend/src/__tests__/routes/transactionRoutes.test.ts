import { createTransactionRoutes } from '../../routes/transactionRoutes';
import { AccountController } from '../../controllers/accountController';

// Mock the auth middleware
jest.mock('../../middleware/auth', () => ({
  authMiddleware: jest.fn((req, res, next) => next()),
}));

describe('transactionRoutes', () => {
  let mockAccountController: Partial<AccountController>;

  beforeEach(() => {
    mockAccountController = {
      deposit: jest.fn(),
      withdraw: jest.fn(),
      transfer: jest.fn(),
    };
  });

  describe('createTransactionRoutes', () => {
    it('should create a router with all transaction routes', () => {
      const router = createTransactionRoutes(mockAccountController as AccountController);

      expect(router).toBeDefined();

      // Check that all expected routes are registered
      const routes = router.stack
        .filter((layer: any) => layer.route)
        .map((layer: any) => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }));

      expect(routes).toContainEqual({ path: '/deposit', methods: ['post'] });
      expect(routes).toContainEqual({ path: '/withdraw', methods: ['post'] });
      expect(routes).toContainEqual({ path: '/transfer', methods: ['post'] });
    });

    it('should apply auth middleware to all routes', () => {
      const router = createTransactionRoutes(mockAccountController as AccountController);

      // The first item in stack should be the auth middleware
      const middlewareLayer = router.stack.find((layer: any) => !layer.route);
      expect(middlewareLayer).toBeDefined();
    });

    it('should register POST /deposit for deposit', () => {
      const router = createTransactionRoutes(mockAccountController as AccountController);

      const depositRoute = router.stack.find(
        (layer: any) => layer.route?.path === '/deposit' && layer.route?.methods?.post
      );
      expect(depositRoute).toBeDefined();
    });

    it('should register POST /withdraw for withdraw', () => {
      const router = createTransactionRoutes(mockAccountController as AccountController);

      const withdrawRoute = router.stack.find(
        (layer: any) => layer.route?.path === '/withdraw' && layer.route?.methods?.post
      );
      expect(withdrawRoute).toBeDefined();
    });

    it('should register POST /transfer for transfer', () => {
      const router = createTransactionRoutes(mockAccountController as AccountController);

      const transferRoute = router.stack.find(
        (layer: any) => layer.route?.path === '/transfer' && layer.route?.methods?.post
      );
      expect(transferRoute).toBeDefined();
    });
  });
});
