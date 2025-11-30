import { Router } from 'express';
import { UserController } from '../controllers/userController';
import { validateToken, requireScope } from '../middleware/tokenValidator';

export function createUserRoutes(controller: UserController): Router {
  const router = Router();

  // GET /users/:fiUserRef/accounts - List all accounts for a user
  // Requires: fdx:accountdetailed:read scope
  // Authorization: Token sub must match fiUserRef
  router.get(
    '/:fiUserRef/accounts',
    validateToken,
    requireScope('fdx:accountdetailed:read'),
    (req, res) => controller.listUserAccounts(req, res)
  );

  return router;
}
