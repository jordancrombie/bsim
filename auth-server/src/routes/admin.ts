import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

export function createAdminRoutes(prisma: PrismaClient): Router {
  const router = Router();

  // GET /administration - List all OAuth clients
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clients = await prisma.oAuthClient.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          clientId: true,
          clientName: true,
          redirectUris: true,
          scope: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      res.render('admin/clients', {
        clients,
        admin: (req as any).admin,
        message: req.query.message,
        error: req.query.error,
      });
    } catch (err) {
      next(err);
    }
  });

  // GET /administration/clients/new - Show create client form
  router.get('/clients/new', async (req: Request, res: Response) => {
    res.render('admin/client-form', {
      client: null,
      admin: (req as any).admin,
      isNew: true,
      error: null,
    });
  });

  // POST /administration/clients - Create new client
  router.post('/clients', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        clientId,
        clientName,
        redirectUris,
        postLogoutRedirectUris,
        scope,
        logoUri,
        policyUri,
        tosUri,
        contacts,
      } = req.body;

      // Generate a secure client secret
      const clientSecret = crypto.randomBytes(32).toString('hex');

      // Parse arrays from form input (newline-separated)
      const parseArray = (str: string) =>
        str
          ? str
              .split('\n')
              .map((s: string) => s.trim())
              .filter(Boolean)
          : [];

      await prisma.oAuthClient.create({
        data: {
          clientId: clientId.trim(),
          clientSecret,
          clientName: clientName.trim(),
          redirectUris: parseArray(redirectUris),
          postLogoutRedirectUris: parseArray(postLogoutRedirectUris),
          grantTypes: ['authorization_code'],
          responseTypes: ['code'],
          scope: scope.trim(),
          logoUri: logoUri?.trim() || null,
          policyUri: policyUri?.trim() || null,
          tosUri: tosUri?.trim() || null,
          contacts: parseArray(contacts),
          isActive: true,
        },
      });

      res.redirect(`/administration?message=Client "${clientName}" created successfully. Secret: ${clientSecret}`);
    } catch (err: any) {
      if (err.code === 'P2002') {
        res.render('admin/client-form', {
          client: req.body,
          admin: (req as any).admin,
          isNew: true,
          error: 'A client with this ID already exists',
        });
      } else {
        next(err);
      }
    }
  });

  // GET /administration/clients/:id - Show edit client form
  router.get('/clients/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const client = await prisma.oAuthClient.findUnique({
        where: { id: req.params.id },
      });

      if (!client) {
        return res.redirect('/administration?error=Client not found');
      }

      res.render('admin/client-form', {
        client,
        admin: (req as any).admin,
        isNew: false,
        error: null,
      });
    } catch (err) {
      next(err);
    }
  });

  // POST /administration/clients/:id - Update client
  router.post('/clients/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        clientName,
        redirectUris,
        postLogoutRedirectUris,
        scope,
        logoUri,
        policyUri,
        tosUri,
        contacts,
        isActive,
        regenerateSecret,
      } = req.body;

      // Parse arrays from form input (newline-separated)
      const parseArray = (str: string) =>
        str
          ? str
              .split('\n')
              .map((s: string) => s.trim())
              .filter(Boolean)
          : [];

      const updateData: any = {
        clientName: clientName.trim(),
        redirectUris: parseArray(redirectUris),
        postLogoutRedirectUris: parseArray(postLogoutRedirectUris),
        scope: scope.trim(),
        logoUri: logoUri?.trim() || null,
        policyUri: policyUri?.trim() || null,
        tosUri: tosUri?.trim() || null,
        contacts: parseArray(contacts),
        isActive: isActive === 'on',
      };

      // Optionally regenerate secret
      let newSecret: string | null = null;
      if (regenerateSecret === 'on') {
        newSecret = crypto.randomBytes(32).toString('hex');
        updateData.clientSecret = newSecret;
      }

      await prisma.oAuthClient.update({
        where: { id: req.params.id },
        data: updateData,
      });

      const message = newSecret
        ? `Client updated. New secret: ${newSecret}`
        : 'Client updated successfully';

      res.redirect(`/administration?message=${encodeURIComponent(message)}`);
    } catch (err) {
      next(err);
    }
  });

  // POST /administration/clients/:id/delete - Delete client
  router.post('/clients/:id/delete', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const client = await prisma.oAuthClient.findUnique({
        where: { id: req.params.id },
        select: { clientName: true },
      });

      if (!client) {
        return res.redirect('/administration?error=Client not found');
      }

      await prisma.oAuthClient.delete({
        where: { id: req.params.id },
      });

      res.redirect(`/administration?message=Client "${client.clientName}" deleted`);
    } catch (err) {
      next(err);
    }
  });

  // GET /administration/sessions - List all active sessions (consents)
  router.get('/sessions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const consents = await prisma.consent.findMany({
        where: {
          revokedAt: null, // Only active (non-revoked) consents
        },
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          client: {
            select: {
              clientId: true,
              clientName: true,
              logoUri: true,
            },
          },
        },
      });

      // For each consent, count active tokens
      const consentsWithTokenCounts = await Promise.all(
        consents.map(async (consent) => {
          const tokenCount = await prisma.oidcPayload.count({
            where: {
              grantId: consent.grantId,
              expiresAt: { gt: new Date() },
            },
          });
          return { ...consent, activeTokenCount: tokenCount };
        })
      );

      res.render('admin/sessions', {
        consents: consentsWithTokenCounts,
        admin: (req as any).admin,
        message: req.query.message,
        error: req.query.error,
      });
    } catch (err) {
      next(err);
    }
  });

  // POST /administration/sessions/:id/revoke - Revoke a session (consent)
  router.post('/sessions/:id/revoke', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const consent = await prisma.consent.findUnique({
        where: { id: req.params.id },
        include: {
          user: { select: { email: true } },
          client: { select: { clientName: true } },
        },
      });

      if (!consent) {
        return res.redirect('/administration/sessions?error=Session not found');
      }

      // Delete all OIDC tokens associated with this grant
      await prisma.oidcPayload.deleteMany({
        where: { grantId: consent.grantId },
      });

      // Mark consent as revoked
      await prisma.consent.update({
        where: { id: req.params.id },
        data: { revokedAt: new Date() },
      });

      res.redirect(
        `/administration/sessions?message=${encodeURIComponent(
          `Session for ${consent.user.email} (${consent.client.clientName}) has been revoked`
        )}`
      );
    } catch (err) {
      next(err);
    }
  });

  // POST /administration/sessions/revoke-all - Revoke all sessions for a user
  router.post('/sessions/revoke-all', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.body;

      if (!userId) {
        return res.redirect('/administration/sessions?error=User ID required');
      }

      // Find all active consents for this user
      const consents = await prisma.consent.findMany({
        where: {
          userId,
          revokedAt: null,
        },
        include: {
          user: { select: { email: true } },
        },
      });

      if (consents.length === 0) {
        return res.redirect('/administration/sessions?error=No active sessions found for this user');
      }

      // Revoke all consents and delete associated tokens
      for (const consent of consents) {
        await prisma.oidcPayload.deleteMany({
          where: { grantId: consent.grantId },
        });
      }

      await prisma.consent.updateMany({
        where: {
          userId,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });

      const userEmail = consents[0]?.user?.email || 'Unknown';
      res.redirect(
        `/administration/sessions?message=${encodeURIComponent(
          `All ${consents.length} session(s) for ${userEmail} have been revoked`
        )}`
      );
    } catch (err) {
      next(err);
    }
  });

  return router;
}
