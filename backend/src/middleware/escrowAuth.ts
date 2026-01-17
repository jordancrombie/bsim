import { Request, Response, NextFunction } from 'express';

export interface EscrowRequest extends Request {
  serviceId?: string;
}

/**
 * Middleware to authenticate service-to-service calls from ContractSim or TransferSim.
 * Validates the X-API-Key header against configured API keys.
 * - ContractSim: creates/manages escrow holds
 * - TransferSim: releases escrow during settlement
 */
export const escrowApiKeyAuth = (req: EscrowRequest, res: Response, next: NextFunction): void => {
  try {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      res.status(401).json({ error: 'Missing API key' });
      return;
    }

    const contractSimKey = process.env.CONTRACTSIM_API_KEY;
    const transferSimKey = process.env.TRANSFERSIM_API_KEY;

    if (!contractSimKey && !transferSimKey) {
      console.error('No escrow API keys configured (CONTRACTSIM_API_KEY or TRANSFERSIM_API_KEY)');
      res.status(500).json({ error: 'Service not configured for escrow' });
      return;
    }

    if (apiKey === contractSimKey) {
      req.serviceId = 'contractsim';
      next();
      return;
    }

    if (apiKey === transferSimKey) {
      req.serviceId = 'transfersim';
      next();
      return;
    }

    res.status(401).json({ error: 'Invalid API key' });
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed' });
  }
};
