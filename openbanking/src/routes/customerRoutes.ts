import { Router } from 'express';
import { CustomerController } from '../controllers/customerController';
import { validateToken, requireScope } from '../middleware/tokenValidator';

export function createCustomerRoutes(controller: CustomerController): Router {
  const router = Router();

  // GET /customers/current - Get current customer info
  // Requires: openid scope (minimum)
  router.get(
    '/current',
    validateToken,
    requireScope('openid'),
    (req, res) => controller.getCurrentCustomer(req, res)
  );

  return router;
}
