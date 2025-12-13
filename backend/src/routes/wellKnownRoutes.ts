import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

export function createWellKnownRoutes(prisma: PrismaClient): Router {
  const router = Router();

  // GET /.well-known/webauthn
  // Returns WebAuthn Related Origin Requests configuration
  // See: https://w3c.github.io/webauthn/#sctn-related-origins
  router.get('/webauthn', async (req: Request, res: Response) => {
    try {
      // Fetch all active related origins from database, ordered by sortOrder
      const relatedOrigins = await prisma.webAuthnRelatedOrigin.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: { origin: true },
      });

      // Return in WebAuthn Related Origins format
      res.json({
        origins: relatedOrigins.map((o) => o.origin),
      });
    } catch (error) {
      console.error('Failed to fetch WebAuthn related origins:', error);
      // Return empty origins array on error to avoid breaking passkey flows
      res.json({ origins: [] });
    }
  });

  return router;
}
