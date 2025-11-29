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

  return router;
}
