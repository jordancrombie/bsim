import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../utils/jwt';

export interface P2PRequest extends Request {
  user?: JwtPayload;
  serviceId?: string;
}

/**
 * Middleware to authenticate service-to-service calls from TransferSim.
 * Validates the X-API-Key header against configured TRANSFERSIM_API_KEY.
 */
export const p2pApiKeyAuth = (req: P2PRequest, res: Response, next: NextFunction): void => {
  try {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      res.status(401).json({ error: 'Missing API key' });
      return;
    }

    const expectedApiKey = process.env.TRANSFERSIM_API_KEY;

    if (!expectedApiKey) {
      console.error('TRANSFERSIM_API_KEY not configured');
      res.status(500).json({ error: 'Service not configured for P2P' });
      return;
    }

    if (apiKey !== expectedApiKey) {
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }

    req.serviceId = 'transfersim';
    next();
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed' });
  }
};

/**
 * Middleware to optionally extract user context from JWT.
 * Used after p2pApiKeyAuth to identify which user the operation is for.
 * Does not reject if no JWT is provided (some endpoints don't need user context).
 */
export const p2pUserContext = (req: P2PRequest, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = verifyToken(token);
      req.user = payload;
    }

    next();
  } catch (error) {
    // JWT validation failed, but we continue without user context
    // The endpoint can decide if user context is required
    next();
  }
};

/**
 * Combined middleware that requires both API key and user JWT.
 * Use this for endpoints that require user context (debit, credit).
 */
export const p2pAuthWithUser = (req: P2PRequest, res: Response, next: NextFunction): void => {
  p2pApiKeyAuth(req, res, (err) => {
    if (err) return next(err);
    if (res.headersSent) return; // API key auth already sent a response

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'User JWT required for this operation' });
      return;
    }

    try {
      const token = authHeader.substring(7);
      const payload = verifyToken(token);
      req.user = payload;
      next();
    } catch (error) {
      res.status(401).json({ error: 'Invalid or expired user token' });
    }
  });
};
