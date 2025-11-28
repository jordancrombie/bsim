import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  VerifiedRegistrationResponse,
  VerifiedAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/server/script/deps';
import { isoBase64URL, isoUint8Array } from '@simplewebauthn/server/helpers';
import { IUserRepository } from '../repositories/interfaces/IUserRepository';
import { PrismaClient } from '@prisma/client';

// Configuration
const RP_NAME = 'BSIM Banking Simulator';
const DOMAIN = process.env.DOMAIN || 'localhost';
const FRONTEND_PORT = process.env.FRONTEND_PORT || '3000';
const RP_ID = process.env.RP_ID || DOMAIN;
const ORIGIN = process.env.ORIGIN || `https://${DOMAIN}:${FRONTEND_PORT}`;

// Build allowed origins dynamically from domain
const ALLOWED_ORIGINS = [
  `https://localhost:${FRONTEND_PORT}`,
  `https://${DOMAIN}:${FRONTEND_PORT}`,
  `http://localhost:${FRONTEND_PORT}`, // Fallback for development
].filter((origin, index, self) => self.indexOf(origin) === index); // Remove duplicates

interface StoredPasskey {
  id: string;
  credentialId: string;
  credentialPublicKey: Buffer;
  counter: bigint;
  deviceType: string;
  backedUp: boolean;
  transports: string[];
}

export class PasskeyService {
  private challenges = new Map<string, string>(); // In production, use Redis or database

  constructor(
    private userRepository: IUserRepository,
    private prisma: PrismaClient
  ) {}

  /**
   * Generate registration options for creating a new passkey
   */
  async generateRegistrationOptions(
    userId: string
  ): Promise<PublicKeyCredentialCreationOptionsJSON> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Get existing passkeys for this user
    const existingPasskeys = await this.prisma.passkey.findMany({
      where: { userId },
      select: {
        credentialId: true,
        transports: true,
      },
    });

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: userId,
      userName: user.email,
      userDisplayName: `${user.firstName} ${user.lastName}`,
      attestationType: 'none',
      excludeCredentials: existingPasskeys.map((passkey) => ({
        id: isoBase64URL.toBuffer(passkey.credentialId),
        type: 'public-key' as const,
        transports: passkey.transports as AuthenticatorTransport[],
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform',
      },
    });

    // Store challenge for verification
    this.challenges.set(userId, options.challenge);

    return options;
  }

  /**
   * Verify registration response and store the passkey
   */
  async verifyRegistration(
    userId: string,
    response: RegistrationResponseJSON
  ): Promise<{ verified: boolean; passkey?: any }> {
    const challenge = this.challenges.get(userId);
    if (!challenge) {
      throw new Error('Challenge not found or expired');
    }

    let verification: VerifiedRegistrationResponse;
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: challenge,
        expectedOrigin: ALLOWED_ORIGINS,
        expectedRPID: RP_ID,
      });
    } catch (error) {
      console.error('Registration verification failed:', error);
      throw new Error('Failed to verify registration');
    }

    const { verified, registrationInfo } = verification;

    if (!verified || !registrationInfo) {
      return { verified: false };
    }

    // Store the passkey in database
    // Convert credentialID (Uint8Array) to base64url string for storage
    const passkey = await this.prisma.passkey.create({
      data: {
        userId,
        credentialId: isoBase64URL.fromBuffer(registrationInfo.credentialID),
        credentialPublicKey: Buffer.from(registrationInfo.credentialPublicKey),
        counter: BigInt(registrationInfo.counter),
        deviceType: registrationInfo.credentialDeviceType,
        backedUp: registrationInfo.credentialBackedUp,
        transports: response.response.transports || [],
      },
    });

    // Clean up challenge
    this.challenges.delete(userId);

    return { verified: true, passkey };
  }

  /**
   * Generate authentication options for logging in with a passkey
   */
  async generateAuthenticationOptions(
    email?: string
  ): Promise<PublicKeyCredentialRequestOptionsJSON> {
    let allowCredentials: { id: Uint8Array; type: 'public-key'; transports?: AuthenticatorTransport[] }[] = [];

    // If email provided, get user's passkeys
    if (email) {
      const user = await this.userRepository.findByEmail(email);
      if (user) {
        const passkeys = await this.prisma.passkey.findMany({
          where: { userId: user.id },
          select: {
            credentialId: true,
            transports: true,
          },
        });

        allowCredentials = passkeys.map((passkey) => ({
          id: isoBase64URL.toBuffer(passkey.credentialId),
          type: 'public-key' as const,
          transports: passkey.transports as AuthenticatorTransport[],
        }));
      }
    }

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
      userVerification: 'preferred',
    });

    // Store challenge with email or 'global' key
    const challengeKey = email || 'global';
    this.challenges.set(challengeKey, options.challenge);

    return options;
  }

  /**
   * Verify authentication response and return user if successful
   */
  async verifyAuthentication(
    response: AuthenticationResponseJSON,
    email?: string
  ): Promise<{ verified: boolean; user?: any }> {
    // Find the passkey
    const passkey = await this.prisma.passkey.findUnique({
      where: { credentialId: response.id },
      include: { user: true },
    });

    if (!passkey) {
      throw new Error('Passkey not found');
    }

    // Get challenge
    const challengeKey = email || 'global';
    const challenge = this.challenges.get(challengeKey);
    if (!challenge) {
      throw new Error('Challenge not found or expired');
    }

    let verification: VerifiedAuthenticationResponse;
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: challenge,
        expectedOrigin: ALLOWED_ORIGINS,
        expectedRPID: RP_ID,
        authenticator: {
          // Convert base64url string back to Uint8Array for verification
          credentialID: isoBase64URL.toBuffer(passkey.credentialId),
          credentialPublicKey: new Uint8Array(passkey.credentialPublicKey),
          counter: Number(passkey.counter),
        },
      });
    } catch (error) {
      console.error('Authentication verification failed:', error);
      throw new Error('Failed to verify authentication');
    }

    const { verified, authenticationInfo } = verification;

    if (!verified) {
      return { verified: false };
    }

    // Update counter and last used timestamp
    await this.prisma.passkey.update({
      where: { id: passkey.id },
      data: {
        counter: BigInt(authenticationInfo.newCounter),
        lastUsedAt: new Date(),
      },
    });

    // Clean up challenge
    this.challenges.delete(challengeKey);

    return { verified: true, user: passkey.user };
  }

  /**
   * Get all passkeys for a user
   */
  async getUserPasskeys(userId: string) {
    return this.prisma.passkey.findMany({
      where: { userId },
      select: {
        id: true,
        createdAt: true,
        lastUsedAt: true,
        deviceType: true,
        backedUp: true,
        transports: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Delete a passkey
   */
  async deletePasskey(passkeyId: string, userId: string): Promise<boolean> {
    const result = await this.prisma.passkey.deleteMany({
      where: {
        id: passkeyId,
        userId: userId,
      },
    });

    return result.count > 0;
  }
}
