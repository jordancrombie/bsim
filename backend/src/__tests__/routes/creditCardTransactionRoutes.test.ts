import { createCreditCardTransactionRoutes } from '../../routes/creditCardTransactionRoutes';
import { CreditCardController } from '../../controllers/creditCardController';

// Mock the auth middleware
jest.mock('../../middleware/auth', () => ({
  authMiddleware: jest.fn((req, res, next) => next()),
}));

describe('creditCardTransactionRoutes', () => {
  let mockCreditCardController: Partial<CreditCardController>;

  beforeEach(() => {
    mockCreditCardController = {
      charge: jest.fn(),
      payment: jest.fn(),
      refund: jest.fn(),
    };
  });

  describe('createCreditCardTransactionRoutes', () => {
    it('should create a router with all credit card transaction routes', () => {
      const router = createCreditCardTransactionRoutes(mockCreditCardController as CreditCardController);

      expect(router).toBeDefined();

      // Check that all expected routes are registered
      const routes = router.stack
        .filter((layer: any) => layer.route)
        .map((layer: any) => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }));

      expect(routes).toContainEqual({ path: '/charge', methods: ['post'] });
      expect(routes).toContainEqual({ path: '/payment', methods: ['post'] });
      expect(routes).toContainEqual({ path: '/refund', methods: ['post'] });
    });

    it('should apply auth middleware to all routes', () => {
      const router = createCreditCardTransactionRoutes(mockCreditCardController as CreditCardController);

      // The first item in stack should be the auth middleware
      const middlewareLayer = router.stack.find((layer: any) => !layer.route);
      expect(middlewareLayer).toBeDefined();
    });

    it('should register POST /charge for charge', () => {
      const router = createCreditCardTransactionRoutes(mockCreditCardController as CreditCardController);

      const chargeRoute = router.stack.find(
        (layer: any) => layer.route?.path === '/charge' && layer.route?.methods?.post
      );
      expect(chargeRoute).toBeDefined();
    });

    it('should register POST /payment for payment', () => {
      const router = createCreditCardTransactionRoutes(mockCreditCardController as CreditCardController);

      const paymentRoute = router.stack.find(
        (layer: any) => layer.route?.path === '/payment' && layer.route?.methods?.post
      );
      expect(paymentRoute).toBeDefined();
    });

    it('should register POST /refund for refund', () => {
      const router = createCreditCardTransactionRoutes(mockCreditCardController as CreditCardController);

      const refundRoute = router.stack.find(
        (layer: any) => layer.route?.path === '/refund' && layer.route?.methods?.post
      );
      expect(refundRoute).toBeDefined();
    });
  });
});
