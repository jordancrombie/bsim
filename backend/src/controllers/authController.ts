import { Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';
import { PasskeyService } from '../services/PasskeyService';
import { AuthRequest } from '../middleware/auth';
import { z } from 'zod';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/server/script/deps';

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  // Customer Information File (CIF) fields - optional
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  dateOfBirth: z.string().optional(), // ISO date string
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export class AuthController {
  constructor(
    private authService: AuthService,
    private passkeyService: PasskeyService
  ) {}

  register = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validatedData = registerSchema.parse(req.body);
      const result = await this.authService.register(validatedData);

      res.status(201).json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors[0].message });
        return;
      }
      next(error);
    }
  };

  login = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validatedData = loginSchema.parse(req.body);
      const result = await this.authService.login(validatedData);

      res.status(200).json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors[0].message });
        return;
      }
      next(error);
    }
  };

  me = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const user = await this.authService.getUserById(req.user.userId);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.status(200).json({ user });
    } catch (error) {
      next(error);
    }
  };

  // Passkey registration - Generate options
  generatePasskeyRegistrationOptions = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const options = await this.passkeyService.generateRegistrationOptions(req.user.userId);
      res.status(200).json(options);
    } catch (error) {
      next(error);
    }
  };

  // Passkey registration - Verify response
  verifyPasskeyRegistration = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const result = await this.passkeyService.verifyRegistration(
        req.user.userId,
        req.body as RegistrationResponseJSON
      );

      if (!result.verified) {
        res.status(400).json({ error: 'Failed to verify passkey registration' });
        return;
      }

      res.status(201).json({
        verified: true,
        message: 'Passkey registered successfully',
        passkey: result.passkey,
      });
    } catch (error) {
      next(error);
    }
  };

  // Passkey authentication - Generate options
  generatePasskeyAuthenticationOptions = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { email } = req.body;
      const options = await this.passkeyService.generateAuthenticationOptions(email);
      res.status(200).json(options);
    } catch (error) {
      next(error);
    }
  };

  // Passkey authentication - Verify response
  verifyPasskeyAuthentication = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { email, response } = req.body;
      const result = await this.passkeyService.verifyAuthentication(
        response as AuthenticationResponseJSON,
        email
      );

      if (!result.verified || !result.user) {
        res.status(401).json({ error: 'Failed to verify passkey authentication' });
        return;
      }

      // Generate JWT token for the authenticated user
      const token = this.authService.generateToken(result.user.id);

      res.status(200).json({
        token,
        user: {
          id: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // Get user's passkeys
  getUserPasskeys = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const passkeys = await this.passkeyService.getUserPasskeys(req.user.userId);
      res.status(200).json({ passkeys });
    } catch (error) {
      next(error);
    }
  };

  // Delete a passkey
  deletePasskey = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { passkeyId } = req.params;
      const deleted = await this.passkeyService.deletePasskey(passkeyId, req.user.userId);

      if (!deleted) {
        res.status(404).json({ error: 'Passkey not found' });
        return;
      }

      res.status(200).json({ message: 'Passkey deleted successfully' });
    } catch (error) {
      next(error);
    }
  };
}
