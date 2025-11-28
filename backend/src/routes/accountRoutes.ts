import { Router } from 'express';
import { AccountController } from '../controllers/accountController';
import { authMiddleware } from '../middleware/auth';

export const createAccountRoutes = (accountController: AccountController): Router => {
  const router = Router();

  // All routes require authentication
  router.use(authMiddleware);

  router.post('/', accountController.createAccount);
  router.get('/', accountController.getAccounts);
  router.get('/:accountNumber', accountController.getAccount);
  router.get('/:accountNumber/transactions', accountController.getTransactions);

  return router;
};
