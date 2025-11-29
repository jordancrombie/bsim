import { Router } from 'express';
import { CreditCardController } from '../controllers/creditCardController';
import { authMiddleware } from '../middleware/auth';

export const createCreditCardRoutes = (creditCardController: CreditCardController): Router => {
  const router = Router();

  // All routes require authentication
  router.use(authMiddleware);

  router.post('/', creditCardController.createCreditCard);
  router.get('/', creditCardController.getCreditCards);
  router.get('/:cardNumber', creditCardController.getCreditCard);
  router.get('/:cardNumber/transactions', creditCardController.getTransactions);

  return router;
};
