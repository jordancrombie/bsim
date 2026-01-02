import { Router, Request, Response, NextFunction } from 'express';
import { Provider, interactionFinished } from 'oidc-provider';
import { PrismaClient } from '@prisma/client';
import { verifyUserPassword } from '../config/oidc';
import { config } from '../config/env';
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
    'payment:authorize': 'Authorize a payment with your selected card',
    'wallet:enroll': 'Enroll your cards in a digital wallet',
  };

  // Check if this is a payment authorization flow
  const isPaymentFlow = (scopes: string[]) => scopes.includes('payment:authorize');

  // Check if this is a wallet enrollment flow
  const isWalletFlow = (scopes: string[]) => scopes.includes('wallet:enroll');

  // GET /interaction/:uid - Show login or consent page
  router.get('/:uid', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const details = await getInteractionDetails(req, res);
      if (!details) {
        return res.status(400).send('Invalid interaction');
      }

      const { uid, prompt, params, session } = details;

      // Get client info - oidc-provider converts snake_case to camelCase (e.g., client_name → clientName)
      const client = await provider.Client.find(params.client_id as string) as any;

      // Helper to get client display properties
      const getClientName = () => client?.clientName || 'Unknown Application';
      const getClientLogo = () => client?.logoUri || null;

      if (prompt.name === 'login') {
        // Show login page
        return res.render('login', {
          uid,
          clientName: getClientName(),
          clientLogo: getClientLogo(),
          error: null,
        });
      }

      if (prompt.name === 'consent') {
        // Parse requested scopes
        const requestedScopes = (params.scope as string)?.split(' ') || [];
        const scopeDetails = requestedScopes
          .filter((s) => scopeDescriptions[s])
          .map((s) => ({
            name: s,
            description: scopeDescriptions[s],
          }));

        // Check if this is a payment flow or wallet flow
        const paymentFlow = isPaymentFlow(requestedScopes);
        const walletFlow = isWalletFlow(requestedScopes);

        // Get user with accounts OR credit cards depending on flow
        // Note: session.accountId is now the fiUserRef (external identifier)
        const user = await prisma.user.findUnique({
          where: { fiUserRef: session?.accountId },
          include: {
            accounts: (!paymentFlow && !walletFlow) ? {
              select: {
                id: true,
                accountNumber: true,
                balance: true,
              },
            } : false,
            creditCards: (paymentFlow || walletFlow) ? {
              select: {
                id: true,
                cardNumber: true,
                cardType: true,
                cardHolder: true,
                availableCredit: true,
                expiryMonth: true,
                expiryYear: true,
              },
            } : false,
          },
        });

        // For wallet enrollment flow, show wallet consent page with card selection
        if (walletFlow) {
          const walletName = getClientName();

          return res.render('wallet-consent', {
            uid,
            clientName: walletName,
            clientLogo: getClientLogo(),
            scopes: scopeDetails,
            creditCards: (user as any)?.creditCards || [],
            user: {
              name: user ? `${user.firstName} ${user.lastName}` : 'Unknown',
              email: user?.email,
            },
          });
        }

        // For payment flow, show payment consent page with card selection
        if (paymentFlow) {
          // Extract payment details from request params (passed via state or custom params)
          const merchantName = getClientName();
          const amount = params.amount as string || null;
          const orderId = params.order_id as string || params.state as string || null;

          return res.render('payment-consent', {
            uid,
            clientName: merchantName,
            clientLogo: getClientLogo(),
            scopes: scopeDetails,
            creditCards: (user as any)?.creditCards || [],
            amount,
            orderId,
            user: {
              name: user ? `${user.firstName} ${user.lastName}` : 'Unknown',
              email: user?.email,
            },
          });
        }

        // Show regular consent page for Open Banking
        return res.render('consent', {
          uid,
          clientName: getClientName(),
          clientLogo: getClientLogo(),
          scopes: scopeDetails,
          accounts: (user as any)?.accounts || [],
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
        const client = await provider.Client.find(params.client_id as string) as any;
        return res.render('login', {
          uid,
          clientName: client?.clientName || client?.client_name || 'Unknown Application',
          clientLogo: client?.logoUri || client?.logo_uri || null,
          error: 'Invalid email or password',
        });
      }

      // Login successful - use fiUserRef as accountId for consistent external identity
      const result = {
        login: {
          accountId: user.fiUserRef,
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
    console.log('[Interaction] POST /confirm called');
    console.log('[Interaction] Request body:', req.body);
    try {
      const details = await getInteractionDetails(req, res);
      console.log('[Interaction] Details:', details ? 'found' : 'not found');
      if (!details) {
        return res.status(400).send('Invalid interaction');
      }

      const { prompt, params, session } = details;
      const { selectedAccounts, selectedCard, selectedCards, walletEnrollment } = req.body;

      // Get the requested scopes
      const requestedScopes = (params.scope as string)?.split(' ') || [];
      const paymentFlow = isPaymentFlow(requestedScopes);
      const walletFlow = isWalletFlow(requestedScopes);

      // Generate a grant ID
      const grantId = crypto.randomUUID();

      // session.accountId is now the fiUserRef (external identifier)
      console.log('[Interaction] Session accountId (fiUserRef):', session?.accountId);
      console.log('[Interaction] Client ID:', params.client_id);
      console.log('[Interaction] Requested scopes:', requestedScopes);
      console.log('[Interaction] Payment flow:', paymentFlow);
      console.log('[Interaction] Wallet flow:', walletFlow);

      // Look up user by fiUserRef to get internal ID for consent storage
      const user = await prisma.user.findUnique({
        where: { fiUserRef: session?.accountId },
        select: { id: true, fiUserRef: true },
      });

      if (!user) {
        console.error('[Interaction] User not found for fiUserRef:', session?.accountId);
        return res.status(400).send('User not found');
      }

      let cardToken: string | null = null;
      let walletCredentialToken: string | null = null;
      let walletCredentialId: string | null = null;

      // Handle wallet enrollment - create WalletCredential
      if (walletFlow && selectedCards) {
        console.log('[Interaction] Creating WalletCredential for cards:', selectedCards);

        // Get wallet info from client
        const client = await provider.Client.find(params.client_id as string) as any;
        const walletName = client?.clientName || 'Digital Wallet';

        // Normalize selectedCards to array
        const cardIds = Array.isArray(selectedCards) ? selectedCards : [selectedCards];

        // Generate unique wallet credential token (long-lived, 90 days)
        walletCredentialToken = `wcred_${crypto.randomUUID().replace(/-/g, '')}`;

        // Create WalletCredential record
        const credential = await prisma.walletCredential.create({
          data: {
            credentialToken: walletCredentialToken,
            userId: user.id,
            walletId: params.client_id as string,
            walletName,
            permittedCards: cardIds,
            scopes: ['cards:read', 'payments:create'],
            expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
          },
        });

        walletCredentialId = credential.id;
        console.log('[Interaction] WalletCredential created with token:', walletCredentialToken.substring(0, 15) + '...');
      }

      // Handle payment consent - create PaymentConsent with card token
      if (paymentFlow && selectedCard) {
        console.log('[Interaction] Creating PaymentConsent for card:', selectedCard);

        // Generate unique card token
        cardToken = `ctok_${crypto.randomUUID().replace(/-/g, '')}`;

        // Get merchant info from client
        const client = await provider.Client.find(params.client_id as string) as any;
        const merchantName = client?.clientName || 'Unknown Merchant';

        // Create PaymentConsent record
        await prisma.paymentConsent.create({
          data: {
            cardToken,
            userId: user.id,
            creditCardId: selectedCard,
            merchantId: params.client_id as string,
            merchantName,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours for payment consent
          },
        });

        console.log('[Interaction] PaymentConsent created with token:', cardToken);
      }

      // Get selected items for consent storage
      let consentAccountIds: string[] = [];
      if (walletFlow && selectedCards) {
        consentAccountIds = Array.isArray(selectedCards) ? selectedCards : [selectedCards];
      } else if (paymentFlow && selectedCard) {
        consentAccountIds = [selectedCard];
      } else if (selectedAccounts) {
        consentAccountIds = Array.isArray(selectedAccounts) ? selectedAccounts : [selectedAccounts].filter(Boolean);
      }

      // Store the consent in our database (for all flows)
      console.log('[Interaction] Creating consent in database...');
      await prisma.consent.create({
        data: {
          grantId,
          userId: user.id, // Use internal ID for database relation
          clientId: params.client_id as string,
          scopes: requestedScopes,
          accountIds: consentAccountIds,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        },
      });
      console.log('[Interaction] Consent created successfully');

      // Consent granted
      console.log('[Interaction] Creating OIDC grant...');
      const grant = new provider.Grant({
        accountId: session?.accountId as string,
        clientId: params.client_id as string,
      });

      // Add scopes to grant
      grant.addOIDCScope(requestedScopes.join(' '));

      // Add resource server scopes - must include ALL scopes for the resource indicator
      // When using resource indicators, oidc-provider expects all requested scopes
      // to be granted for that resource, not just the FDX-specific ones
      grant.addResourceScope(
        config.openbanking.audience,
        requestedScopes.join(' ')
      );

      console.log('[Interaction] Saving grant...');
      const savedGrant = await grant.save();
      console.log('[Interaction] Grant saved:', savedGrant);

      // Store flow-specific data in grant payload for inclusion in token claims
      if ((paymentFlow && cardToken) || (walletFlow && walletCredentialToken)) {
        // oidc-provider stores grants with 'Grant:' prefix in the database
        const grantDbId = `Grant:${savedGrant}`;
        const grantData = await prisma.oidcPayload.findFirst({
          where: { id: grantDbId },
        });
        if (grantData) {
          const payload = grantData.payload as any;
          if (cardToken) {
            payload.cardToken = cardToken;
            console.log('[Interaction] Card token stored in grant payload:', cardToken);
          }
          if (walletCredentialToken) {
            payload.walletCredentialToken = walletCredentialToken;
            payload.walletCredentialId = walletCredentialId;
            payload.fiUserRef = user.fiUserRef;
            // Include internal user ID for P2P transfers - BSIM accounts are owned by this ID
            payload.bsimUserId = user.id;
            console.log('[Interaction] Wallet credential stored in grant payload');
          }
          await prisma.oidcPayload.update({
            where: { id: grantDbId },
            data: { payload },
          });
        } else {
          console.log('[Interaction] Grant not found in database with id:', grantDbId);
        }
      }

      const result = {
        consent: {
          grantId: savedGrant,
        },
      };

      console.log('[Interaction] Finishing interaction...');
      await provider.interactionFinished(req, res, result, { mergeWithLastSubmission: true });
      console.log('[Interaction] Interaction finished successfully');
    } catch (err) {
      console.error('[Interaction] ERROR:', err);
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
