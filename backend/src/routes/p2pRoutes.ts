import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { P2PController } from '../controllers/p2pController';
import { p2pApiKeyAuth } from '../middleware/p2pAuth';

export const createP2PRoutes = (prisma: PrismaClient): Router => {
  const router = Router();
  const p2pController = new P2PController(prisma);

  // All P2P routes require API key authentication (service-to-service)
  router.use(p2pApiKeyAuth);

  // Transfer endpoints
  router.post('/transfer/debit', p2pController.debit);
  router.post('/transfer/credit', p2pController.credit);

  // User verification endpoint
  router.post('/user/verify', p2pController.verify);

  // Fee account configuration (for Micro Merchant support)
  router.get('/config/fee-account', p2pController.getFeeAccount);
  router.put('/config/fee-account', p2pController.setFeeAccount);

  return router;
};
