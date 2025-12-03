import { Router, Request, Response, NextFunction } from 'express';
import { SimNetHandler } from '../payment-network';
import { PrismaClient } from '@prisma/client';

/**
 * Payment Network Routes
 *
 * Internal API endpoints for NSIM to communicate with BSIM.
 * These endpoints are called by the payment network (NSIM) to:
 * - Authorize payments against user credit cards
 * - Capture authorized payments
 * - Void pending authorizations
 * - Process refunds
 *
 * Authentication: API key in X-API-Key header
 */
export function createPaymentNetworkRoutes(prisma: PrismaClient): Router {
  const router = Router();
  const handler = new SimNetHandler(prisma);

  // API key authentication middleware
  const authenticateApiKey = (req: Request, res: Response, next: NextFunction) => {
    const apiKey = req.headers['x-api-key'];
    const expectedKey = process.env.BSIM_PAYMENT_API_KEY || 'dev-payment-api-key';

    if (!apiKey || apiKey !== expectedKey) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    next();
  };

  router.use(authenticateApiKey);

  /**
   * POST /api/payment-network/authorize
   * Authorize a payment request from NSIM
   */
  router.post('/authorize', async (req: Request, res: Response) => {
    try {
      const { cardToken, amount, currency, merchantId, merchantName, orderId, description } = req.body;

      // Validate required fields
      if (!cardToken || !amount || !merchantId || !orderId) {
        return res.status(400).json({
          error: 'Missing required fields: cardToken, amount, merchantId, orderId',
        });
      }

      console.log(`[PaymentNetwork] Authorization request:`, {
        merchantId,
        merchantName,
        orderId,
        amount,
        cardToken: cardToken.substring(0, 10) + '...',
      });

      const result = await handler.authorize({
        cardToken,
        amount: Number(amount),
        currency: currency || 'CAD',
        merchantId,
        merchantName: merchantName || merchantId,
        orderId,
        description,
      });

      console.log(`[PaymentNetwork] Authorization result:`, {
        status: result.status,
        authorizationCode: result.authorizationCode,
        declineReason: result.declineReason,
      });

      res.json(result);
    } catch (error) {
      console.error('[PaymentNetwork] Authorization error:', error);
      res.status(500).json({ status: 'error', error: 'Internal server error' });
    }
  });

  /**
   * POST /api/payment-network/capture
   * Capture an authorized payment
   */
  router.post('/capture', async (req: Request, res: Response) => {
    try {
      const { authorizationCode, amount } = req.body;

      if (!authorizationCode || amount === undefined) {
        return res.status(400).json({
          error: 'Missing required fields: authorizationCode, amount',
        });
      }

      console.log(`[PaymentNetwork] Capture request:`, {
        authorizationCode,
        amount,
      });

      const result = await handler.capture({
        authorizationCode,
        amount: Number(amount),
      });

      console.log(`[PaymentNetwork] Capture result:`, result);

      res.json(result);
    } catch (error) {
      console.error('[PaymentNetwork] Capture error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });

  /**
   * POST /api/payment-network/void
   * Void an authorization
   */
  router.post('/void', async (req: Request, res: Response) => {
    try {
      const { authorizationCode } = req.body;

      if (!authorizationCode) {
        return res.status(400).json({
          error: 'Missing required field: authorizationCode',
        });
      }

      console.log(`[PaymentNetwork] Void request:`, { authorizationCode });

      const result = await handler.void({ authorizationCode });

      console.log(`[PaymentNetwork] Void result:`, result);

      res.json(result);
    } catch (error) {
      console.error('[PaymentNetwork] Void error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });

  /**
   * POST /api/payment-network/refund
   * Refund a captured payment
   */
  router.post('/refund', async (req: Request, res: Response) => {
    try {
      const { authorizationCode, amount } = req.body;

      if (!authorizationCode || amount === undefined) {
        return res.status(400).json({
          error: 'Missing required fields: authorizationCode, amount',
        });
      }

      console.log(`[PaymentNetwork] Refund request:`, {
        authorizationCode,
        amount,
      });

      const result = await handler.refund({
        authorizationCode,
        amount: Number(amount),
      });

      console.log(`[PaymentNetwork] Refund result:`, result);

      res.json(result);
    } catch (error) {
      console.error('[PaymentNetwork] Refund error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });

  /**
   * POST /api/payment-network/validate-token
   * Validate a card token (for pre-flight checks)
   */
  router.post('/validate-token', async (req: Request, res: Response) => {
    try {
      const { cardToken } = req.body;

      if (!cardToken) {
        return res.status(400).json({ error: 'Missing required field: cardToken' });
      }

      const valid = await handler.validateCardToken(cardToken);

      res.json({ valid });
    } catch (error) {
      console.error('[PaymentNetwork] Token validation error:', error);
      res.status(500).json({ valid: false, error: 'Internal server error' });
    }
  });

  return router;
}
