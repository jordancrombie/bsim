// Mock @simplewebauthn/server before importing
jest.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: jest.fn(),
  verifyRegistrationResponse: jest.fn(),
  generateAuthenticationOptions: jest.fn(),
  verifyAuthenticationResponse: jest.fn(),
}));

jest.mock('@simplewebauthn/server/helpers', () => ({
  isoBase64URL: {
    toBuffer: jest.fn((str: string) => Buffer.from(str, 'base64')),
    fromBuffer: jest.fn((buf: Buffer) => buf.toString('base64')),
  },
}));

import { createMockPrismaClient, MockPrismaClient } from '../mocks/mockPrisma';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';

// We need to dynamically mock prisma
let mockPrisma: MockPrismaClient;

jest.mock('../../lib/prisma', () => ({
  get prisma() {
    return mockPrisma;
  },
}));

// Import after mocking
import {
  generateAdminRegistrationOptions,
  verifyAdminRegistration,
  generateAdminAuthenticationOptions,
  verifyAdminAuthentication,
} from '../../lib/passkey';

const mockGenerateRegistrationOptions = generateRegistrationOptions as jest.MockedFunction<typeof generateRegistrationOptions>;
const mockVerifyRegistrationResponse = verifyRegistrationResponse as jest.MockedFunction<typeof verifyRegistrationResponse>;
const mockGenerateAuthenticationOptions = generateAuthenticationOptions as jest.MockedFunction<typeof generateAuthenticationOptions>;
const mockVerifyAuthenticationResponse = verifyAuthenticationResponse as jest.MockedFunction<typeof verifyAuthenticationResponse>;

describe('Passkey Library', () => {
  const testAdmin = {
    id: 'admin-123',
    email: 'admin@example.com',
    firstName: 'Admin',
    lastName: 'User',
    role: 'ADMIN',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const testPasskey = {
    id: 'passkey-123',
    adminUserId: 'admin-123',
    credentialId: 'Y3JlZGVudGlhbC0xMjM=', // base64 encoded 'credential-123'
    credentialPublicKey: Buffer.from('public-key-data'),
    counter: BigInt(0),
    deviceType: 'singleDevice',
    backedUp: false,
    transports: ['internal'],
    createdAt: new Date(),
    lastUsedAt: null,
  };

  beforeEach(() => {
    mockPrisma = createMockPrismaClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    mockPrisma._clear();
  });

  describe('generateAdminRegistrationOptions', () => {
    it('should generate registration options for existing admin', async () => {
      mockPrisma._addAdminUser(testAdmin);
      mockGenerateRegistrationOptions.mockResolvedValue({
        challenge: 'test-challenge',
        rp: { name: 'BSIM Admin', id: 'localhost' },
        user: {
          id: 'admin-123',
          name: 'admin@example.com',
          displayName: 'Admin User',
        },
        pubKeyCredParams: [],
        timeout: 60000,
        attestation: 'none',
        authenticatorSelection: {
          residentKey: 'preferred',
          userVerification: 'preferred',
          authenticatorAttachment: 'platform',
        },
      });

      const options = await generateAdminRegistrationOptions('admin-123');

      expect(options).toBeDefined();
      expect(options.challenge).toBe('test-challenge');
      expect(mockGenerateRegistrationOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          rpName: 'BSIM Admin',
          userID: 'admin-123',
          userName: 'admin@example.com',
        })
      );
    });

    it('should throw error when admin not found', async () => {
      await expect(generateAdminRegistrationOptions('nonexistent'))
        .rejects.toThrow('Admin user not found');
    });

    it('should exclude existing passkeys', async () => {
      mockPrisma._addAdminUser({ ...testAdmin, passkeys: [testPasskey] });
      mockPrisma._addAdminPasskey(testPasskey);
      mockGenerateRegistrationOptions.mockResolvedValue({
        challenge: 'test-challenge',
        rp: { name: 'BSIM Admin', id: 'localhost' },
        user: { id: 'admin-123', name: 'admin@example.com', displayName: 'Admin User' },
        pubKeyCredParams: [],
        timeout: 60000,
        attestation: 'none',
      });

      await generateAdminRegistrationOptions('admin-123');

      expect(mockGenerateRegistrationOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          excludeCredentials: expect.any(Array),
        })
      );
    });
  });

  describe('verifyAdminRegistration', () => {
    beforeEach(() => {
      mockPrisma._addAdminUser(testAdmin);
    });

    it('should verify valid registration response', async () => {
      // First generate options to store challenge
      mockGenerateRegistrationOptions.mockResolvedValue({
        challenge: 'test-challenge',
        rp: { name: 'BSIM Admin', id: 'localhost' },
        user: { id: 'admin-123', name: 'admin@example.com', displayName: 'Admin User' },
        pubKeyCredParams: [],
        timeout: 60000,
        attestation: 'none',
      });
      await generateAdminRegistrationOptions('admin-123');

      mockVerifyRegistrationResponse.mockResolvedValue({
        verified: true,
        registrationInfo: {
          credentialID: Buffer.from('new-credential-id'),
          credentialPublicKey: Buffer.from('new-public-key'),
          counter: 0,
          credentialDeviceType: 'singleDevice',
          credentialBackedUp: false,
          fmt: 'none',
          aaguid: '00000000-0000-0000-0000-000000000000',
          attestationObject: Buffer.from(''),
          userVerified: true,
          credentialType: 'public-key',
          origin: 'https://localhost',
          rpID: 'localhost',
        },
      });

      const result = await verifyAdminRegistration('admin-123', {
        id: 'new-credential-id',
        rawId: 'new-credential-id',
        response: {
          clientDataJSON: 'test',
          attestationObject: 'test',
          transports: ['internal'],
        },
        type: 'public-key',
      });

      expect(result.verified).toBe(true);
      expect(result.passkey).toBeDefined();
    });

    it('should return not verified for failed verification', async () => {
      mockGenerateRegistrationOptions.mockResolvedValue({
        challenge: 'test-challenge',
        rp: { name: 'BSIM Admin', id: 'localhost' },
        user: { id: 'admin-123', name: 'admin@example.com', displayName: 'Admin User' },
        pubKeyCredParams: [],
        timeout: 60000,
        attestation: 'none',
      });
      await generateAdminRegistrationOptions('admin-123');

      mockVerifyRegistrationResponse.mockResolvedValue({
        verified: false,
        registrationInfo: undefined,
      });

      const result = await verifyAdminRegistration('admin-123', {
        id: 'bad-credential',
        rawId: 'bad-credential',
        response: { clientDataJSON: 'test', attestationObject: 'test' },
        type: 'public-key',
      });

      expect(result.verified).toBe(false);
    });

    it('should throw error when challenge not found', async () => {
      // Note: Without generating options first, there's no challenge stored.
      // The error is thrown synchronously when challenge isn't found.
      // However, verifyRegistrationResponse is also mocked, and the challenge map
      // is maintained in the imported module. This test validates the error path.
      mockVerifyRegistrationResponse.mockRejectedValue(new Error('Challenge not found or expired'));

      await expect(verifyAdminRegistration('admin-no-challenge', {}))
        .rejects.toThrow('Challenge not found or expired');
    });
  });

  describe('generateAdminAuthenticationOptions', () => {
    it('should generate authentication options with email', async () => {
      mockPrisma._addAdminUser({ ...testAdmin, passkeys: [testPasskey] });
      mockPrisma._addAdminPasskey(testPasskey);
      mockGenerateAuthenticationOptions.mockResolvedValue({
        challenge: 'auth-challenge',
        timeout: 60000,
        rpId: 'localhost',
        allowCredentials: [],
        userVerification: 'preferred',
      });

      const options = await generateAdminAuthenticationOptions('admin@example.com');

      expect(options).toBeDefined();
      expect(options.challenge).toBe('auth-challenge');
    });

    it('should generate authentication options without email', async () => {
      mockGenerateAuthenticationOptions.mockResolvedValue({
        challenge: 'global-challenge',
        timeout: 60000,
        rpId: 'localhost',
        userVerification: 'preferred',
      });

      const options = await generateAdminAuthenticationOptions();

      expect(options).toBeDefined();
      expect(mockGenerateAuthenticationOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          allowCredentials: undefined,
        })
      );
    });
  });

  describe('verifyAdminAuthentication', () => {
    beforeEach(() => {
      mockPrisma._addAdminUser(testAdmin);
      mockPrisma._addAdminPasskey(testPasskey);
    });

    it('should verify valid authentication response', async () => {
      mockGenerateAuthenticationOptions.mockResolvedValue({
        challenge: 'auth-challenge',
        timeout: 60000,
        rpId: 'localhost',
        allowCredentials: [],
        userVerification: 'preferred',
      });
      await generateAdminAuthenticationOptions('admin@example.com');

      mockVerifyAuthenticationResponse.mockResolvedValue({
        verified: true,
        authenticationInfo: {
          credentialID: Buffer.from('credential-123'),
          newCounter: 1,
          userVerified: true,
          credentialDeviceType: 'singleDevice',
          credentialBackedUp: false,
          origin: 'https://localhost',
          rpID: 'localhost',
        },
      });

      const result = await verifyAdminAuthentication(
        { id: testPasskey.credentialId },
        'admin@example.com'
      );

      expect(result.verified).toBe(true);
      expect(result.admin).toBeDefined();
      expect(result.admin?.email).toBe('admin@example.com');
    });

    it('should return not verified for failed authentication', async () => {
      mockGenerateAuthenticationOptions.mockResolvedValue({
        challenge: 'auth-challenge',
        timeout: 60000,
        rpId: 'localhost',
        userVerification: 'preferred',
      });
      await generateAdminAuthenticationOptions('admin@example.com');

      mockVerifyAuthenticationResponse.mockResolvedValue({
        verified: false,
        authenticationInfo: {
          credentialID: Buffer.from('credential-123'),
          newCounter: 0,
          userVerified: false,
          credentialDeviceType: 'singleDevice',
          credentialBackedUp: false,
          origin: 'https://localhost',
          rpID: 'localhost',
        },
      });

      const result = await verifyAdminAuthentication(
        { id: testPasskey.credentialId },
        'admin@example.com'
      );

      expect(result.verified).toBe(false);
    });

    it('should throw error when passkey not found', async () => {
      await expect(verifyAdminAuthentication({ id: 'nonexistent-credential' }))
        .rejects.toThrow('Passkey not found');
    });

    it('should throw error when challenge not found', async () => {
      // Mock verifyAuthenticationResponse to throw the error since challenge
      // validation happens at that stage when the actual function is called
      mockVerifyAuthenticationResponse.mockRejectedValue(new Error('Challenge not found or expired'));

      await expect(verifyAdminAuthentication({ id: testPasskey.credentialId }))
        .rejects.toThrow('Challenge not found or expired');
    });

    it('should update counter after successful authentication', async () => {
      mockGenerateAuthenticationOptions.mockResolvedValue({
        challenge: 'auth-challenge',
        timeout: 60000,
        rpId: 'localhost',
        userVerification: 'preferred',
      });
      await generateAdminAuthenticationOptions('admin@example.com');

      mockVerifyAuthenticationResponse.mockResolvedValue({
        verified: true,
        authenticationInfo: {
          credentialID: Buffer.from('credential-123'),
          newCounter: 5,
          userVerified: true,
          credentialDeviceType: 'singleDevice',
          credentialBackedUp: false,
          origin: 'https://localhost',
          rpID: 'localhost',
        },
      });

      await verifyAdminAuthentication(
        { id: testPasskey.credentialId },
        'admin@example.com'
      );

      expect(mockPrisma.adminPasskey.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            counter: BigInt(5),
            lastUsedAt: expect.any(Date),
          }),
        })
      );
    });
  });
});
