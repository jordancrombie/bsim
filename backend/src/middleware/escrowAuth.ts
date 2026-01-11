import { Request, Response, NextFunction } from 'express';

export interface EscrowRequest extends Request {
  serviceId?: string;
}

/**
 * Middleware to authenticate service-to-service calls from ContractSim.
 * Validates the X-API-Key header against configured CONTRACTSIM_API_KEY.
 */
export const escrowApiKeyAuth = (req: EscrowRequest, res: Response, next: NextFunction): void => {
  try {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      res.status(401).json({ error: 'Missing API key' });
      return;
    }

    const expectedApiKey = process.env.CONTRACTSIM_API_KEY;

    if (!expectedApiKey) {
      console.error('CONTRACTSIM_API_KEY not configured');
      res.status(500).json({ error: 'Service not configured for escrow' });
      return;
    }

    if (apiKey !== expectedApiKey) {
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }

    req.serviceId = 'contractsim';
    next();
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed' });
  }
};
