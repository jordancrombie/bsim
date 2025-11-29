import { Router } from 'express';
import { CreditCardController } from '../controllers/creditCardController';
import { authMiddleware } from '../middleware/auth';

export const createCreditCardTransactionRoutes = (creditCardController: CreditCardController): Router => {
  const router = Router();

  // All routes require authentication
  router.use(authMiddleware);

  router.post('/charge', creditCardController.charge);
  router.post('/payment', creditCardController.payment);
  router.post('/refund', creditCardController.refund);

  return router;
};
