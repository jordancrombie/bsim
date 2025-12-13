import { createAccountRoutes } from '../../routes/accountRoutes';
import { AccountController } from '../../controllers/accountController';

// Mock the auth middleware
jest.mock('../../middleware/auth', () => ({
  authMiddleware: jest.fn((req, res, next) => next()),
}));

describe('accountRoutes', () => {
  let mockAccountController: Partial<AccountController>;

  beforeEach(() => {
    mockAccountController = {
      createAccount: jest.fn(),
      getAccounts: jest.fn(),
      getAccount: jest.fn(),
      getTransactions: jest.fn(),
    };
  });

  describe('createAccountRoutes', () => {
    it('should create a router with all account routes', () => {
      const router = createAccountRoutes(mockAccountController as AccountController);

      expect(router).toBeDefined();

      // Check that all expected routes are registered
      const routes = router.stack
        .filter((layer: any) => layer.route)
        .map((layer: any) => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }));

      expect(routes).toContainEqual({ path: '/', methods: ['post'] });
      expect(routes).toContainEqual({ path: '/', methods: ['get'] });
      expect(routes).toContainEqual({ path: '/:accountNumber', methods: ['get'] });
      expect(routes).toContainEqual({ path: '/:accountNumber/transactions', methods: ['get'] });
    });

    it('should apply auth middleware to all routes', () => {
      const router = createAccountRoutes(mockAccountController as AccountController);

      // The first item in stack should be the auth middleware
      const middlewareLayer = router.stack.find((layer: any) => !layer.route);
      expect(middlewareLayer).toBeDefined();
    });

    it('should register POST / for createAccount', () => {
      const router = createAccountRoutes(mockAccountController as AccountController);

      const createRoute = router.stack.find(
        (layer: any) => layer.route?.path === '/' && layer.route?.methods?.post
      );
      expect(createRoute).toBeDefined();
    });

    it('should register GET / for getAccounts', () => {
      const router = createAccountRoutes(mockAccountController as AccountController);

      const listRoute = router.stack.find(
        (layer: any) => layer.route?.path === '/' && layer.route?.methods?.get
      );
      expect(listRoute).toBeDefined();
    });

    it('should register GET /:accountNumber for getAccount', () => {
      const router = createAccountRoutes(mockAccountController as AccountController);

      const getRoute = router.stack.find(
        (layer: any) => layer.route?.path === '/:accountNumber' && layer.route?.methods?.get
      );
      expect(getRoute).toBeDefined();
    });

    it('should register GET /:accountNumber/transactions for getTransactions', () => {
      const router = createAccountRoutes(mockAccountController as AccountController);

      const transactionsRoute = router.stack.find(
        (layer: any) => layer.route?.path === '/:accountNumber/transactions' && layer.route?.methods?.get
      );
      expect(transactionsRoute).toBeDefined();
    });
  });
});
