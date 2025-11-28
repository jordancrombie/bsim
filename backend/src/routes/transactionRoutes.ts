import { Router } from 'express';
import { AccountController } from '../controllers/accountController';
import { authMiddleware } from '../middleware/auth';

export const createTransactionRoutes = (accountController: AccountController): Router => {
  const router = Router();

  // All routes require authentication
  router.use(authMiddleware);

  router.post('/deposit', accountController.deposit);
  router.post('/withdraw', accountController.withdraw);
  router.post('/transfer', accountController.transfer);

  return router;
};
