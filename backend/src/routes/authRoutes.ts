import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { authMiddleware } from '../middleware/auth';

export const createAuthRoutes = (authController: AuthController): Router => {
  const router = Router();

  // Traditional authentication
  router.post('/register', authController.register);
  router.post('/login', authController.login);
  router.get('/me', authMiddleware, authController.me);

  // Passkey registration (requires authentication)
  router.post(
    '/passkey/register-options',
    authMiddleware,
    authController.generatePasskeyRegistrationOptions
  );
  router.post(
    '/passkey/register-verify',
    authMiddleware,
    authController.verifyPasskeyRegistration
  );

  // Passkey authentication (public endpoints)
  router.post('/passkey/login-options', authController.generatePasskeyAuthenticationOptions);
  router.post('/passkey/login-verify', authController.verifyPasskeyAuthentication);

  // Passkey management (requires authentication)
  router.get('/passkeys', authMiddleware, authController.getUserPasskeys);
  router.delete('/passkeys/:passkeyId', authMiddleware, authController.deletePasskey);

  return router;
};
