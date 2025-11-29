import { Router } from 'express';
import { AccountController } from '../controllers/accountController';
import { validateToken, requireScope } from '../middleware/tokenValidator';

export function createAccountRoutes(controller: AccountController): Router {
  const router = Router();

  // GET /accounts - List accounts
  // Requires: fdx:accountdetailed:read scope
  router.get(
    '/',
    validateToken,
    requireScope('fdx:accountdetailed:read'),
    (req, res) => controller.listAccounts(req, res)
  );

  // GET /accounts/:accountId - Get account details
  // Requires: fdx:accountdetailed:read scope
  router.get(
    '/:accountId',
    validateToken,
    requireScope('fdx:accountdetailed:read'),
    (req, res) => controller.getAccount(req, res)
  );

  // GET /accounts/:accountId/transactions - Get transaction history
  // Requires: fdx:transactions:read scope
  router.get(
    '/:accountId/transactions',
    validateToken,
    requireScope('fdx:transactions:read'),
    (req, res) => controller.getTransactions(req, res)
  );

  return router;
}
