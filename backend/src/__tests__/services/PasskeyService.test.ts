import { PasskeyService } from '../../services/PasskeyService';
import { MockUserRepository } from '../mocks/MockUserRepository';
import { PrismaClient } from '@prisma/client';

// Mock @simplewebauthn/server
jest.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: jest.fn(),
  verifyRegistrationResponse: jest.fn(),
  generateAuthenticationOptions: jest.fn(),
  verifyAuthenticationResponse: jest.fn(),
}));

// Mock @simplewebauthn/server/helpers
jest.mock('@simplewebauthn/server/helpers', () => ({
  isoBase64URL: {
    toBuffer: jest.fn((str: string) => Buffer.from(str, 'base64url')),
    fromBuffer: jest.fn((buf: Buffer) => buf.toString('base64url')),
  },
  isoUint8Array: {},
}));

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';

const mockGenerateRegistrationOptions = generateRegistrationOptions as jest.MockedFunction<
  typeof generateRegistrationOptions
>;
const mockVerifyRegistrationResponse = verifyRegistrationResponse as jest.MockedFunction<
  typeof verifyRegistrationResponse
>;
const mockGenerateAuthenticationOptions = generateAuthenticationOptions as jest.MockedFunction<
  typeof generateAuthenticationOptions
>;
const mockVerifyAuthenticationResponse = verifyAuthenticationResponse as jest.MockedFunction<
  typeof verifyAuthenticationResponse
>;

// Mock Prisma client
const mockPrismaPasskey = {
  findMany: jest.fn(),
  findUnique: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  deleteMany: jest.fn(),
};

const mockPrisma = {
  passkey: mockPrismaPasskey,
} as unknown as PrismaClient;

describe('PasskeyService', () => {
  let passkeyService: PasskeyService;
  let mockUserRepository: MockUserRepository;

  const testUserId = 'user-123';
  const testEmail = 'test@example.com';

  beforeEach(() => {
    mockUserRepository = new MockUserRepository();
    passkeyService = new PasskeyService(mockUserRepository, mockPrisma);

    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    mockUserRepository.clear();
  });

  describe('generateRegistrationOptions', () => {
    it('should generate registration options for existing user', async () => {
      const user = await mockUserRepository.create({
        email: testEmail,
        password: 'hashedpassword',
        firstName: 'Test',
        lastName: 'User',
      });

      mockPrismaPasskey.findMany.mockResolvedValue([]);
      mockGenerateRegistrationOptions.mockResolvedValue({
        challenge: 'test-challenge-123',
        rp: { name: 'BSIM Banking Simulator', id: 'localhost' },
        user: { id: user.id, name: testEmail, displayName: 'Test User' },
        pubKeyCredParams: [],
        timeout: 60000,
        attestation: 'none',
        excludeCredentials: [],
        authenticatorSelection: {
          residentKey: 'preferred',
          userVerification: 'preferred',
          authenticatorAttachment: 'platform',
        },
      } as any);

      const options = await passkeyService.generateRegistrationOptions(user.id);

      expect(options).toBeDefined();
      expect(options.challenge).toBe('test-challenge-123');
      expect(mockGenerateRegistrationOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          rpName: 'BSIM Banking Simulator',
          userID: user.id,
          userName: testEmail,
          userDisplayName: 'Test User',
        })
      );
    });

    it('should throw error when user not found', async () => {
      await expect(passkeyService.generateRegistrationOptions('nonexistent-user')).rejects.toThrow('User not found');
    });

    it('should exclude existing passkeys from registration options', async () => {
      const user = await mockUserRepository.create({
        email: testEmail,
        password: 'hashedpassword',
        firstName: 'Test',
        lastName: 'User',
      });

      const existingPasskeys = [
        { credentialId: 'existing-credential-1', transports: ['internal'] },
        { credentialId: 'existing-credential-2', transports: ['usb', 'nfc'] },
      ];
      mockPrismaPasskey.findMany.mockResolvedValue(existingPasskeys);
      mockGenerateRegistrationOptions.mockResolvedValue({
        challenge: 'test-challenge',
        excludeCredentials: existingPasskeys.map((p) => ({ id: p.credentialId, type: 'public-key' })),
      } as any);

      await passkeyService.generateRegistrationOptions(user.id);

      expect(mockPrismaPasskey.findMany).toHaveBeenCalledWith({
        where: { userId: user.id },
        select: { credentialId: true, transports: true },
      });
      expect(mockGenerateRegistrationOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          excludeCredentials: expect.arrayContaining([
            expect.objectContaining({ type: 'public-key' }),
          ]),
        })
      );
    });

    it('should store challenge for later verification', async () => {
      const user = await mockUserRepository.create({
        email: testEmail,
        password: 'hashedpassword',
        firstName: 'Test',
        lastName: 'User',
      });

      mockPrismaPasskey.findMany.mockResolvedValue([]);
      mockGenerateRegistrationOptions.mockResolvedValue({
        challenge: 'unique-challenge-456',
      } as any);

      await passkeyService.generateRegistrationOptions(user.id);

      // The challenge should be stored internally - we verify this by testing verifyRegistration
      // Since challenges map is private, we test indirectly through the verification flow
      expect(mockGenerateRegistrationOptions).toHaveBeenCalled();
    });
  });

  describe('verifyRegistration', () => {
    it('should verify registration and store passkey', async () => {
      const user = await mockUserRepository.create({
        email: testEmail,
        password: 'hashedpassword',
        firstName: 'Test',
        lastName: 'User',
      });

      // First generate options to store challenge
      mockPrismaPasskey.findMany.mockResolvedValue([]);
      mockGenerateRegistrationOptions.mockResolvedValue({
        challenge: 'test-challenge',
      } as any);
      await passkeyService.generateRegistrationOptions(user.id);

      // Now verify registration
      const mockRegistrationResponse = {
        id: 'credential-id-123',
        rawId: 'credential-id-123',
        response: {
          clientDataJSON: 'client-data',
          attestationObject: 'attestation-object',
          transports: ['internal'],
        },
        type: 'public-key',
        clientExtensionResults: {},
      };

      mockVerifyRegistrationResponse.mockResolvedValue({
        verified: true,
        registrationInfo: {
          credentialID: Buffer.from('credential-id-123'),
          credentialPublicKey: Buffer.from('public-key-data'),
          counter: 0,
          credentialDeviceType: 'singleDevice',
          credentialBackedUp: false,
        },
      } as any);

      const createdPasskey = {
        id: 'passkey-uuid',
        userId: user.id,
        credentialId: 'credential-id-123',
        credentialPublicKey: Buffer.from('public-key-data'),
        counter: BigInt(0),
        deviceType: 'singleDevice',
        backedUp: false,
        transports: ['internal'],
        createdAt: new Date(),
        lastUsedAt: null,
      };
      mockPrismaPasskey.create.mockResolvedValue(createdPasskey);

      const result = await passkeyService.verifyRegistration(user.id, mockRegistrationResponse as any);

      expect(result.verified).toBe(true);
      expect(result.passkey).toBeDefined();
      expect(mockVerifyRegistrationResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          response: mockRegistrationResponse,
          expectedChallenge: 'test-challenge',
        })
      );
      expect(mockPrismaPasskey.create).toHaveBeenCalled();
    });

    it('should throw error when challenge not found', async () => {
      const mockResponse = { id: 'test', response: {} };

      await expect(passkeyService.verifyRegistration('user-123', mockResponse as any)).rejects.toThrow(
        'Challenge not found or expired'
      );
    });

    it('should return verified false when verification fails', async () => {
      const user = await mockUserRepository.create({
        email: testEmail,
        password: 'hashedpassword',
        firstName: 'Test',
        lastName: 'User',
      });

      // Generate options to store challenge
      mockPrismaPasskey.findMany.mockResolvedValue([]);
      mockGenerateRegistrationOptions.mockResolvedValue({ challenge: 'test-challenge' } as any);
      await passkeyService.generateRegistrationOptions(user.id);

      // Verification returns not verified
      mockVerifyRegistrationResponse.mockResolvedValue({
        verified: false,
        registrationInfo: null,
      } as any);

      const result = await passkeyService.verifyRegistration(user.id, { id: 'test', response: {} } as any);

      expect(result.verified).toBe(false);
      expect(result.passkey).toBeUndefined();
      expect(mockPrismaPasskey.create).not.toHaveBeenCalled();
    });

    it('should throw error when verification throws', async () => {
      const user = await mockUserRepository.create({
        email: testEmail,
        password: 'hashedpassword',
        firstName: 'Test',
        lastName: 'User',
      });

      mockPrismaPasskey.findMany.mockResolvedValue([]);
      mockGenerateRegistrationOptions.mockResolvedValue({ challenge: 'test-challenge' } as any);
      await passkeyService.generateRegistrationOptions(user.id);

      mockVerifyRegistrationResponse.mockRejectedValue(new Error('Verification error'));

      await expect(passkeyService.verifyRegistration(user.id, { id: 'test', response: {} } as any)).rejects.toThrow(
        'Failed to verify registration'
      );
    });
  });

  describe('generateAuthenticationOptions', () => {
    it('should generate authentication options without email (discoverable credentials)', async () => {
      mockGenerateAuthenticationOptions.mockResolvedValue({
        challenge: 'auth-challenge-123',
        timeout: 60000,
        rpId: 'localhost',
        allowCredentials: undefined,
        userVerification: 'preferred',
      } as any);

      const options = await passkeyService.generateAuthenticationOptions();

      expect(options).toBeDefined();
      expect(options.challenge).toBe('auth-challenge-123');
      expect(mockGenerateAuthenticationOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          allowCredentials: undefined,
          userVerification: 'preferred',
        })
      );
    });

    it('should generate authentication options with user passkeys when email provided', async () => {
      const user = await mockUserRepository.create({
        email: testEmail,
        password: 'hashedpassword',
        firstName: 'Test',
        lastName: 'User',
      });

      const userPasskeys = [
        { credentialId: 'cred-1', transports: ['internal'] },
        { credentialId: 'cred-2', transports: ['usb'] },
      ];
      mockPrismaPasskey.findMany.mockResolvedValue(userPasskeys);
      mockGenerateAuthenticationOptions.mockResolvedValue({
        challenge: 'auth-challenge-456',
        allowCredentials: userPasskeys.map((p) => ({ id: p.credentialId, type: 'public-key' })),
      } as any);

      const options = await passkeyService.generateAuthenticationOptions(testEmail);

      expect(options).toBeDefined();
      expect(mockPrismaPasskey.findMany).toHaveBeenCalledWith({
        where: { userId: user.id },
        select: { credentialId: true, transports: true },
      });
      expect(mockGenerateAuthenticationOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          allowCredentials: expect.arrayContaining([expect.objectContaining({ type: 'public-key' })]),
        })
      );
    });

    it('should generate options with empty allowCredentials when user not found', async () => {
      mockGenerateAuthenticationOptions.mockResolvedValue({
        challenge: 'auth-challenge',
        allowCredentials: undefined,
      } as any);

      const options = await passkeyService.generateAuthenticationOptions('nonexistent@example.com');

      expect(options).toBeDefined();
      expect(mockGenerateAuthenticationOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          allowCredentials: undefined,
        })
      );
    });
  });

  describe('verifyAuthentication', () => {
    it('should verify authentication and return user', async () => {
      const user = await mockUserRepository.create({
        email: testEmail,
        password: 'hashedpassword',
        firstName: 'Test',
        lastName: 'User',
      });

      // Generate auth options to store challenge
      mockPrismaPasskey.findMany.mockResolvedValue([]);
      mockGenerateAuthenticationOptions.mockResolvedValue({ challenge: 'auth-challenge' } as any);
      await passkeyService.generateAuthenticationOptions(testEmail);

      // Mock passkey lookup
      const storedPasskey = {
        id: 'passkey-uuid',
        userId: user.id,
        credentialId: 'cred-id-123',
        credentialPublicKey: Buffer.from('public-key'),
        counter: BigInt(5),
        deviceType: 'singleDevice',
        backedUp: false,
        transports: ['internal'],
        user: {
          id: user.id,
          email: testEmail,
          firstName: 'Test',
          lastName: 'User',
        },
      };
      mockPrismaPasskey.findUnique.mockResolvedValue(storedPasskey);

      // Mock verification success
      mockVerifyAuthenticationResponse.mockResolvedValue({
        verified: true,
        authenticationInfo: {
          newCounter: 6,
        },
      } as any);

      mockPrismaPasskey.update.mockResolvedValue({});

      const authResponse = {
        id: 'cred-id-123',
        rawId: 'cred-id-123',
        response: {
          authenticatorData: 'auth-data',
          clientDataJSON: 'client-data',
          signature: 'signature',
        },
        type: 'public-key',
        clientExtensionResults: {},
      };

      const result = await passkeyService.verifyAuthentication(authResponse as any, testEmail);

      expect(result.verified).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(testEmail);
      expect(mockPrismaPasskey.update).toHaveBeenCalledWith({
        where: { id: 'passkey-uuid' },
        data: {
          counter: BigInt(6),
          lastUsedAt: expect.any(Date),
        },
      });
    });

    it('should throw error when passkey not found', async () => {
      mockPrismaPasskey.findUnique.mockResolvedValue(null);

      const authResponse = { id: 'unknown-cred', response: {} };

      await expect(passkeyService.verifyAuthentication(authResponse as any)).rejects.toThrow('Passkey not found');
    });

    it('should throw error when challenge not found', async () => {
      const storedPasskey = {
        id: 'passkey-uuid',
        credentialId: 'cred-id',
        credentialPublicKey: Buffer.from('key'),
        counter: BigInt(0),
        user: { id: 'user-id' },
      };
      mockPrismaPasskey.findUnique.mockResolvedValue(storedPasskey);

      const authResponse = { id: 'cred-id', response: {} };

      await expect(passkeyService.verifyAuthentication(authResponse as any)).rejects.toThrow(
        'Challenge not found or expired'
      );
    });

    it('should return verified false when authentication fails', async () => {
      const user = await mockUserRepository.create({
        email: testEmail,
        password: 'hashedpassword',
        firstName: 'Test',
        lastName: 'User',
      });

      // Generate auth options
      mockPrismaPasskey.findMany.mockResolvedValue([]);
      mockGenerateAuthenticationOptions.mockResolvedValue({ challenge: 'auth-challenge' } as any);
      await passkeyService.generateAuthenticationOptions(testEmail);

      const storedPasskey = {
        id: 'passkey-uuid',
        userId: user.id,
        credentialId: 'cred-id',
        credentialPublicKey: Buffer.from('key'),
        counter: BigInt(0),
        user: { id: user.id },
      };
      mockPrismaPasskey.findUnique.mockResolvedValue(storedPasskey);

      mockVerifyAuthenticationResponse.mockResolvedValue({
        verified: false,
        authenticationInfo: null,
      } as any);

      const result = await passkeyService.verifyAuthentication({ id: 'cred-id', response: {} } as any, testEmail);

      expect(result.verified).toBe(false);
      expect(result.user).toBeUndefined();
    });

    it('should use global challenge key when email not provided', async () => {
      // Generate auth options without email
      mockGenerateAuthenticationOptions.mockResolvedValue({ challenge: 'global-challenge' } as any);
      await passkeyService.generateAuthenticationOptions();

      const storedPasskey = {
        id: 'passkey-uuid',
        credentialId: 'cred-id',
        credentialPublicKey: Buffer.from('key'),
        counter: BigInt(0),
        user: { id: 'user-id', email: 'user@example.com' },
      };
      mockPrismaPasskey.findUnique.mockResolvedValue(storedPasskey);

      mockVerifyAuthenticationResponse.mockResolvedValue({
        verified: true,
        authenticationInfo: { newCounter: 1 },
      } as any);
      mockPrismaPasskey.update.mockResolvedValue({});

      const result = await passkeyService.verifyAuthentication({ id: 'cred-id', response: {} } as any);

      expect(result.verified).toBe(true);
      expect(mockVerifyAuthenticationResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          expectedChallenge: 'global-challenge',
        })
      );
    });
  });

  describe('getUserPasskeys', () => {
    it('should return passkeys for user', async () => {
      const passkeys = [
        {
          id: 'passkey-1',
          createdAt: new Date('2024-01-01'),
          lastUsedAt: new Date('2024-01-15'),
          deviceType: 'singleDevice',
          backedUp: false,
          transports: ['internal'],
        },
        {
          id: 'passkey-2',
          createdAt: new Date('2024-02-01'),
          lastUsedAt: null,
          deviceType: 'multiDevice',
          backedUp: true,
          transports: ['hybrid'],
        },
      ];
      mockPrismaPasskey.findMany.mockResolvedValue(passkeys);

      const result = await passkeyService.getUserPasskeys(testUserId);

      expect(result).toEqual(passkeys);
      expect(mockPrismaPasskey.findMany).toHaveBeenCalledWith({
        where: { userId: testUserId },
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
    });

    it('should return empty array when user has no passkeys', async () => {
      mockPrismaPasskey.findMany.mockResolvedValue([]);

      const result = await passkeyService.getUserPasskeys(testUserId);

      expect(result).toEqual([]);
    });
  });

  describe('deletePasskey', () => {
    it('should delete passkey and return true', async () => {
      mockPrismaPasskey.deleteMany.mockResolvedValue({ count: 1 });

      const result = await passkeyService.deletePasskey('passkey-123', testUserId);

      expect(result).toBe(true);
      expect(mockPrismaPasskey.deleteMany).toHaveBeenCalledWith({
        where: {
          id: 'passkey-123',
          userId: testUserId,
        },
      });
    });

    it('should return false when passkey not found or not owned by user', async () => {
      mockPrismaPasskey.deleteMany.mockResolvedValue({ count: 0 });

      const result = await passkeyService.deletePasskey('nonexistent', testUserId);

      expect(result).toBe(false);
    });

    it('should only delete passkey owned by the specified user', async () => {
      mockPrismaPasskey.deleteMany.mockResolvedValue({ count: 1 });

      await passkeyService.deletePasskey('passkey-id', 'owner-user-id');

      expect(mockPrismaPasskey.deleteMany).toHaveBeenCalledWith({
        where: {
          id: 'passkey-id',
          userId: 'owner-user-id',
        },
      });
    });
  });
});
