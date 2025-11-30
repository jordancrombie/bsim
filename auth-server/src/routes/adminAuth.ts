import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import {
  createAdminToken,
  setAdminCookie,
  clearAdminCookie,
  verifyAdminToken,
} from '../middleware/adminAuth';

// Configuration
const RP_NAME = 'BSIM Auth Server Admin';
const RP_ID = process.env.AUTH_RP_ID || process.env.RP_ID || 'banksim.ca';
const ORIGIN = process.env.AUTH_ORIGIN || 'https://auth.banksim.ca';

// Challenge store (in production, use Redis or database)
const challenges = new Map<string, string>();

export function createAdminAuthRoutes(prisma: PrismaClient): Router {
  const router = Router();

  // GET /administration/login - Show login page
  router.get('/login', async (req: Request, res: Response) => {
    // Check if already logged in
    const token = req.cookies['auth_admin_token'];
    if (token) {
      const session = await verifyAdminToken(token);
      if (session) {
        return res.redirect('/administration');
      }
    }

    res.render('admin/login', {
      error: req.query.error,
    });
  });

  // POST /administration/login-options - Generate authentication options
  router.post('/login-options', async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      let allowCredentials: any[] = [];

      if (email) {
        const admin = await prisma.adminUser.findUnique({
          where: { email },
          include: {
            passkeys: {
              select: {
                credentialId: true,
                transports: true,
              },
            },
          },
        });

        if (admin && admin.passkeys.length > 0) {
          allowCredentials = admin.passkeys.map((passkey) => ({
            id: isoBase64URL.toBuffer(passkey.credentialId),
            type: 'public-key' as const,
            transports: passkey.transports as any[],
          }));
        }
      }

      const options = await generateAuthenticationOptions({
        rpID: RP_ID,
        allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
        userVerification: 'preferred',
      });

      // Store challenge
      const challengeKey = email || 'global';
      challenges.set(challengeKey, options.challenge);

      res.json({ options });
    } catch (error) {
      console.error('Failed to generate login options:', error);
      res.status(500).json({ error: 'Failed to generate login options' });
    }
  });

  // POST /administration/login-verify - Verify authentication
  router.post('/login-verify', async (req: Request, res: Response) => {
    try {
      const { credential, email } = req.body;

      // Find the passkey
      const passkey = await prisma.adminPasskey.findUnique({
        where: { credentialId: credential.id },
        include: { adminUser: true },
      });

      if (!passkey) {
        return res.status(401).json({ error: 'Passkey not found' });
      }

      // Get challenge
      const challengeKey = email || 'global';
      const challenge = challenges.get(challengeKey);
      if (!challenge) {
        return res.status(401).json({ error: 'Challenge expired' });
      }

      const verification = await verifyAuthenticationResponse({
        response: credential,
        expectedChallenge: challenge,
        expectedOrigin: [ORIGIN, 'https://localhost', `https://${RP_ID}`],
        expectedRPID: RP_ID,
        authenticator: {
          credentialID: isoBase64URL.toBuffer(passkey.credentialId),
          credentialPublicKey: new Uint8Array(passkey.credentialPublicKey),
          counter: Number(passkey.counter),
        },
      });

      if (!verification.verified) {
        return res.status(401).json({ error: 'Authentication failed' });
      }

      // Update counter and last used
      await prisma.adminPasskey.update({
        where: { id: passkey.id },
        data: {
          counter: BigInt(verification.authenticationInfo.newCounter),
          lastUsedAt: new Date(),
        },
      });

      // Clean up challenge
      challenges.delete(challengeKey);

      // Create JWT token
      const token = await createAdminToken({
        userId: passkey.adminUser.id,
        email: passkey.adminUser.email,
        role: passkey.adminUser.role,
      });

      // Set cookie
      setAdminCookie(res, token);

      res.json({
        success: true,
        admin: {
          id: passkey.adminUser.id,
          email: passkey.adminUser.email,
          firstName: passkey.adminUser.firstName,
          lastName: passkey.adminUser.lastName,
          role: passkey.adminUser.role,
        },
      });
    } catch (error) {
      console.error('Failed to verify login:', error);
      res.status(500).json({ error: 'Failed to verify login' });
    }
  });

  // POST /administration/logout - Logout
  router.post('/logout', (req: Request, res: Response) => {
    clearAdminCookie(res);
    res.redirect('/administration/login');
  });

  // GET /administration/logout - Logout (for link-based logout)
  router.get('/logout', (req: Request, res: Response) => {
    clearAdminCookie(res);
    res.redirect('/administration/login');
  });

  return router;
}
