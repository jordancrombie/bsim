import { createCreditCardRoutes } from '../../routes/creditCardRoutes';
import { CreditCardController } from '../../controllers/creditCardController';

// Mock the auth middleware
jest.mock('../../middleware/auth', () => ({
  authMiddleware: jest.fn((req, res, next) => next()),
}));

describe('creditCardRoutes', () => {
  let mockCreditCardController: Partial<CreditCardController>;

  beforeEach(() => {
    mockCreditCardController = {
      createCreditCard: jest.fn(),
      getCreditCards: jest.fn(),
      getCreditCard: jest.fn(),
      getTransactions: jest.fn(),
    };
  });

  describe('createCreditCardRoutes', () => {
    it('should create a router with all credit card routes', () => {
      const router = createCreditCardRoutes(mockCreditCardController as CreditCardController);

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
      expect(routes).toContainEqual({ path: '/:cardNumber', methods: ['get'] });
      expect(routes).toContainEqual({ path: '/:cardNumber/transactions', methods: ['get'] });
    });

    it('should apply auth middleware to all routes', () => {
      const router = createCreditCardRoutes(mockCreditCardController as CreditCardController);

      // The first item in stack should be the auth middleware
      const middlewareLayer = router.stack.find((layer: any) => !layer.route);
      expect(middlewareLayer).toBeDefined();
    });

    it('should register POST / for createCreditCard', () => {
      const router = createCreditCardRoutes(mockCreditCardController as CreditCardController);

      const createRoute = router.stack.find(
        (layer: any) => layer.route?.path === '/' && layer.route?.methods?.post
      );
      expect(createRoute).toBeDefined();
    });

    it('should register GET / for getCreditCards', () => {
      const router = createCreditCardRoutes(mockCreditCardController as CreditCardController);

      const listRoute = router.stack.find(
        (layer: any) => layer.route?.path === '/' && layer.route?.methods?.get
      );
      expect(listRoute).toBeDefined();
    });

    it('should register GET /:cardNumber for getCreditCard', () => {
      const router = createCreditCardRoutes(mockCreditCardController as CreditCardController);

      const getRoute = router.stack.find(
        (layer: any) => layer.route?.path === '/:cardNumber' && layer.route?.methods?.get
      );
      expect(getRoute).toBeDefined();
    });

    it('should register GET /:cardNumber/transactions for getTransactions', () => {
      const router = createCreditCardRoutes(mockCreditCardController as CreditCardController);

      const transactionsRoute = router.stack.find(
        (layer: any) => layer.route?.path === '/:cardNumber/transactions' && layer.route?.methods?.get
      );
      expect(transactionsRoute).toBeDefined();
    });
  });
});
