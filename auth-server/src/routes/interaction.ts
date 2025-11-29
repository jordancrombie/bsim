import { Router, Request, Response, NextFunction } from 'express';
import { Provider, interactionFinished } from 'oidc-provider';
import { PrismaClient } from '@prisma/client';
import { verifyUserPassword } from '../config/oidc';
import crypto from 'crypto';

export function createInteractionRoutes(provider: Provider, prisma: PrismaClient): Router {
  const router = Router();

  // Helper to get interaction details
  const getInteractionDetails = async (req: Request, res: Response) => {
    try {
      const details = await provider.interactionDetails(req, res);
      return details;
    } catch (err) {
      return null;
    }
  };

  // Scope descriptions for consent screen
  const scopeDescriptions: Record<string, string> = {
    openid: 'Verify your identity',
    profile: 'View your name and date of birth',
    email: 'View your email address',
    'fdx:accountdetailed:read': 'View your account details and balances',
    'fdx:transactions:read': 'View your transaction history',
    'fdx:customercontact:read': 'View your contact information (address, phone)',
  };

  // GET /interaction/:uid - Show login or consent page
  router.get('/:uid', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const details = await getInteractionDetails(req, res);
      if (!details) {
        return res.status(400).send('Invalid interaction');
      }

      const { uid, prompt, params, session } = details;

      // Get client info
      const client = await provider.Client.find(params.client_id as string);

      if (prompt.name === 'login') {
        // Show login page
        return res.render('login', {
          uid,
          clientName: client?.client_name || 'Unknown Application',
          clientLogo: client?.logo_uri || null,
          error: null,
        });
      }

      if (prompt.name === 'consent') {
        // Get user's accounts for selection
        const user = await prisma.user.findUnique({
          where: { id: session?.accountId },
          include: {
            accounts: {
              select: {
                id: true,
                accountNumber: true,
                balance: true,
              },
            },
          },
        });

        // Parse requested scopes
        const requestedScopes = (params.scope as string)?.split(' ') || [];
        const scopeDetails = requestedScopes
          .filter((s) => scopeDescriptions[s])
          .map((s) => ({
            name: s,
            description: scopeDescriptions[s],
          }));

        // Show consent page
        return res.render('consent', {
          uid,
          clientName: client?.client_name || 'Unknown Application',
          clientLogo: client?.logo_uri || null,
          scopes: scopeDetails,
          accounts: user?.accounts || [],
          user: {
            name: user ? `${user.firstName} ${user.lastName}` : 'Unknown',
            email: user?.email,
          },
        });
      }

      // Unknown prompt
      return res.status(400).send('Unknown interaction prompt');
    } catch (err) {
      next(err);
    }
  });

  // POST /interaction/:uid/login - Handle login submission
  router.post('/:uid/login', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const details = await getInteractionDetails(req, res);
      if (!details) {
        return res.status(400).send('Invalid interaction');
      }

      const { uid, params } = details;
      const { email, password } = req.body;

      // Verify credentials
      const user = await verifyUserPassword(prisma, email, password);

      if (!user) {
        const client = await provider.Client.find(params.client_id as string);
        return res.render('login', {
          uid,
          clientName: client?.client_name || 'Unknown Application',
          clientLogo: client?.logo_uri || null,
          error: 'Invalid email or password',
        });
      }

      // Login successful
      const result = {
        login: {
          accountId: user.id,
          remember: req.body.remember === 'on',
        },
      };

      await provider.interactionFinished(req, res, result, { mergeWithLastSubmission: false });
    } catch (err) {
      next(err);
    }
  });

  // POST /interaction/:uid/confirm - Handle consent confirmation
  router.post('/:uid/confirm', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const details = await getInteractionDetails(req, res);
      if (!details) {
        return res.status(400).send('Invalid interaction');
      }

      const { prompt, params, session } = details;
      const { selectedAccounts } = req.body;

      // Get the requested scopes
      const requestedScopes = (params.scope as string)?.split(' ') || [];

      // Generate a grant ID
      const grantId = crypto.randomUUID();

      // Store the consent in our database
      await prisma.consent.create({
        data: {
          grantId,
          userId: session?.accountId as string,
          clientId: params.client_id as string,
          scopes: requestedScopes,
          accountIds: Array.isArray(selectedAccounts) ? selectedAccounts : [selectedAccounts].filter(Boolean),
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        },
      });

      // Consent granted
      const grant = new provider.Grant({
        accountId: session?.accountId as string,
        clientId: params.client_id as string,
      });

      // Add scopes to grant
      grant.addOIDCScope(requestedScopes.join(' '));

      // Add resource server scopes
      grant.addResourceScope(
        'https://openbanking.banksim.ca',
        requestedScopes.filter((s) => s.startsWith('fdx:')).join(' ')
      );

      const savedGrant = await grant.save();

      const result = {
        consent: {
          grantId: savedGrant,
        },
      };

      await provider.interactionFinished(req, res, result, { mergeWithLastSubmission: true });
    } catch (err) {
      next(err);
    }
  });

  // POST /interaction/:uid/abort - Handle consent denial
  router.post('/:uid/abort', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = {
        error: 'access_denied',
        error_description: 'User denied the authorization request',
      };

      await provider.interactionFinished(req, res, result, { mergeWithLastSubmission: false });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
