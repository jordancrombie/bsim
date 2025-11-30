import { ConsentService } from '../../services/consentService';
import { createMockPrismaClient, MockPrismaClient } from '../mocks/mockPrisma';
import { PrismaClient } from '@prisma/client';

describe('ConsentService', () => {
  let consentService: ConsentService;
  let mockPrisma: MockPrismaClient;

  const testUserId = 'user-123';
  const testClientId = 'client-abc';

  beforeEach(() => {
    mockPrisma = createMockPrismaClient();
    consentService = new ConsentService(mockPrisma as unknown as PrismaClient);
  });

  afterEach(() => {
    mockPrisma._clear();
  });

  describe('getConsentedAccountIds', () => {
    it('should return empty array when no consent exists', async () => {
      const accountIds = await consentService.getConsentedAccountIds(testUserId, testClientId);

      expect(accountIds).toEqual([]);
    });

    it('should return account IDs from active consent', async () => {
      mockPrisma._addConsent({
        id: 'consent-1',
        userId: testUserId,
        clientId: testClientId,
        scopes: ['fdx:accounts:read'],
        accountIds: ['account-1', 'account-2', 'account-3'],
        revokedAt: null,
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const accountIds = await consentService.getConsentedAccountIds(testUserId, testClientId);

      expect(accountIds).toEqual(['account-1', 'account-2', 'account-3']);
    });

    it('should not return account IDs from revoked consent', async () => {
      mockPrisma._addConsent({
        id: 'consent-1',
        userId: testUserId,
        clientId: testClientId,
        scopes: ['fdx:accounts:read'],
        accountIds: ['account-1', 'account-2'],
        revokedAt: new Date(), // Revoked
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const accountIds = await consentService.getConsentedAccountIds(testUserId, testClientId);

      expect(accountIds).toEqual([]);
    });

    it('should not return account IDs from expired consent', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
      mockPrisma._addConsent({
        id: 'consent-1',
        userId: testUserId,
        clientId: testClientId,
        scopes: ['fdx:accounts:read'],
        accountIds: ['account-1'],
        revokedAt: null,
        expiresAt: pastDate, // Expired
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const accountIds = await consentService.getConsentedAccountIds(testUserId, testClientId);

      expect(accountIds).toEqual([]);
    });

    it('should return account IDs from consent with future expiration', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day from now
      mockPrisma._addConsent({
        id: 'consent-1',
        userId: testUserId,
        clientId: testClientId,
        scopes: ['fdx:accounts:read'],
        accountIds: ['account-1', 'account-2'],
        revokedAt: null,
        expiresAt: futureDate,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const accountIds = await consentService.getConsentedAccountIds(testUserId, testClientId);

      expect(accountIds).toEqual(['account-1', 'account-2']);
    });

    it('should only return consent for matching user and client', async () => {
      // Add consent for different user
      mockPrisma._addConsent({
        id: 'consent-1',
        userId: 'other-user',
        clientId: testClientId,
        scopes: ['fdx:accounts:read'],
        accountIds: ['account-other'],
        revokedAt: null,
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Add consent for different client
      mockPrisma._addConsent({
        id: 'consent-2',
        userId: testUserId,
        clientId: 'other-client',
        scopes: ['fdx:accounts:read'],
        accountIds: ['account-different-client'],
        revokedAt: null,
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Add correct consent
      mockPrisma._addConsent({
        id: 'consent-3',
        userId: testUserId,
        clientId: testClientId,
        scopes: ['fdx:accounts:read'],
        accountIds: ['account-correct'],
        revokedAt: null,
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const accountIds = await consentService.getConsentedAccountIds(testUserId, testClientId);

      expect(accountIds).toEqual(['account-correct']);
    });
  });

  describe('isAccountConsented', () => {
    beforeEach(() => {
      mockPrisma._addConsent({
        id: 'consent-1',
        userId: testUserId,
        clientId: testClientId,
        scopes: ['fdx:accounts:read'],
        accountIds: ['account-1', 'account-2'],
        revokedAt: null,
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    it('should return true for consented account', async () => {
      const isConsented = await consentService.isAccountConsented(testUserId, testClientId, 'account-1');

      expect(isConsented).toBe(true);
    });

    it('should return true for another consented account', async () => {
      const isConsented = await consentService.isAccountConsented(testUserId, testClientId, 'account-2');

      expect(isConsented).toBe(true);
    });

    it('should return false for non-consented account', async () => {
      const isConsented = await consentService.isAccountConsented(testUserId, testClientId, 'account-3');

      expect(isConsented).toBe(false);
    });

    it('should return false when no consent exists', async () => {
      mockPrisma._clear();

      const isConsented = await consentService.isAccountConsented(testUserId, testClientId, 'account-1');

      expect(isConsented).toBe(false);
    });
  });

  describe('getConsentedScopes', () => {
    it('should return empty array when no consent exists', async () => {
      const scopes = await consentService.getConsentedScopes(testUserId, testClientId);

      expect(scopes).toEqual([]);
    });

    it('should return scopes from active consent', async () => {
      mockPrisma._addConsent({
        id: 'consent-1',
        userId: testUserId,
        clientId: testClientId,
        scopes: ['fdx:accounts:read', 'fdx:transactions:read', 'profile'],
        accountIds: ['account-1'],
        revokedAt: null,
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const scopes = await consentService.getConsentedScopes(testUserId, testClientId);

      expect(scopes).toEqual(['fdx:accounts:read', 'fdx:transactions:read', 'profile']);
    });

    it('should not return scopes from revoked consent', async () => {
      mockPrisma._addConsent({
        id: 'consent-1',
        userId: testUserId,
        clientId: testClientId,
        scopes: ['fdx:accounts:read'],
        accountIds: ['account-1'],
        revokedAt: new Date(),
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const scopes = await consentService.getConsentedScopes(testUserId, testClientId);

      expect(scopes).toEqual([]);
    });

    it('should not return scopes from expired consent', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      mockPrisma._addConsent({
        id: 'consent-1',
        userId: testUserId,
        clientId: testClientId,
        scopes: ['fdx:accounts:read'],
        accountIds: ['account-1'],
        revokedAt: null,
        expiresAt: pastDate,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const scopes = await consentService.getConsentedScopes(testUserId, testClientId);

      expect(scopes).toEqual([]);
    });

    it('should return single scope correctly', async () => {
      mockPrisma._addConsent({
        id: 'consent-1',
        userId: testUserId,
        clientId: testClientId,
        scopes: ['openid'],
        accountIds: [],
        revokedAt: null,
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const scopes = await consentService.getConsentedScopes(testUserId, testClientId);

      expect(scopes).toEqual(['openid']);
    });

    it('should return empty array for empty scopes', async () => {
      mockPrisma._addConsent({
        id: 'consent-1',
        userId: testUserId,
        clientId: testClientId,
        scopes: [],
        accountIds: ['account-1'],
        revokedAt: null,
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const scopes = await consentService.getConsentedScopes(testUserId, testClientId);

      expect(scopes).toEqual([]);
    });
  });
});
