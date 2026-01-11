import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { EscrowService } from '../services/EscrowService';
import { EscrowController } from '../controllers/escrowController';
import { escrowApiKeyAuth } from '../middleware/escrowAuth';

export const createEscrowRoutes = (prisma: PrismaClient): Router => {
  const router = Router();
  const escrowService = new EscrowService(prisma);
  const escrowController = new EscrowController(escrowService);

  // All escrow routes require API key authentication (service-to-service from ContractSim)
  router.use(escrowApiKeyAuth);

  // Create escrow hold
  router.post('/hold', escrowController.createHold);

  // Get escrow by ID
  router.get('/:id', escrowController.getById);

  // Release escrow (settlement)
  router.post('/:id/release', escrowController.release);

  // Return escrow (cancel/expire)
  router.post('/:id/return', escrowController.returnEscrow);

  return router;
};
