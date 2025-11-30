import { PrismaAdapter, createPrismaAdapterFactory } from '../../adapters/prisma';
import { createMockPrismaClient, MockPrismaClient } from '../mocks/mockPrisma';
import { PrismaClient } from '@prisma/client';
import { AdapterPayload } from 'oidc-provider';

describe('PrismaAdapter', () => {
  let mockPrisma: MockPrismaClient;
  let adapter: PrismaAdapter;

  beforeEach(() => {
    mockPrisma = createMockPrismaClient();
    adapter = new PrismaAdapter('AccessToken', mockPrisma as unknown as PrismaClient);
  });

  afterEach(() => {
    mockPrisma._clear();
  });

  describe('upsert', () => {
    it('should create a new payload when it does not exist', async () => {
      const payload: AdapterPayload = {
        jti: 'token-123',
        kind: 'AccessToken',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      await adapter.upsert('token-123', payload, 3600);

      expect(mockPrisma.oidcPayload.upsert).toHaveBeenCalledWith({
        where: { id: 'AccessToken:token-123' },
        update: expect.objectContaining({
          payload,
          grantId: null,
          userCode: null,
          uid: null,
        }),
        create: expect.objectContaining({
          id: 'AccessToken:token-123',
          type: 'AccessToken',
          payload,
          grantId: null,
          userCode: null,
          uid: null,
        }),
      });
    });

    it('should set expiresAt based on expiresIn', async () => {
      const payload: AdapterPayload = {
        jti: 'token-123',
        kind: 'AccessToken',
      };

      const before = Date.now();
      await adapter.upsert('token-123', payload, 3600);
      const after = Date.now();

      const call = mockPrisma.oidcPayload.upsert.mock.calls[0][0];
      const expiresAt = call.create.expiresAt as Date;

      // Should expire in ~3600 seconds
      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + 3600 * 1000);
      expect(expiresAt.getTime()).toBeLessThanOrEqual(after + 3600 * 1000);
    });

    it('should not set expiresAt when expiresIn is 0', async () => {
      const payload: AdapterPayload = {
        jti: 'token-123',
        kind: 'Session',
      };

      await adapter.upsert('token-123', payload, 0);

      const call = mockPrisma.oidcPayload.upsert.mock.calls[0][0];
      expect(call.create.expiresAt).toBeUndefined();
    });

    it('should store grantId when present in payload', async () => {
      const payload: AdapterPayload = {
        jti: 'token-123',
        kind: 'AccessToken',
        grantId: 'grant-456',
      };

      await adapter.upsert('token-123', payload, 3600);

      const call = mockPrisma.oidcPayload.upsert.mock.calls[0][0];
      expect(call.create.grantId).toBe('grant-456');
    });

    it('should store userCode when present in payload', async () => {
      const payload: AdapterPayload = {
        jti: 'device-123',
        kind: 'DeviceCode',
        userCode: 'ABC123',
      };

      await adapter.upsert('device-123', payload, 600);

      const call = mockPrisma.oidcPayload.upsert.mock.calls[0][0];
      expect(call.create.userCode).toBe('ABC123');
    });

    it('should store uid when present in payload', async () => {
      const payload: AdapterPayload = {
        jti: 'interaction-123',
        kind: 'Interaction',
        uid: 'uid-789',
      };

      await adapter.upsert('interaction-123', payload, 3600);

      const call = mockPrisma.oidcPayload.upsert.mock.calls[0][0];
      expect(call.create.uid).toBe('uid-789');
    });
  });

  describe('find', () => {
    it('should return undefined when payload does not exist', async () => {
      const result = await adapter.find('nonexistent');

      expect(result).toBeUndefined();
    });

    it('should return payload when it exists and is not expired', async () => {
      const payload = { jti: 'token-123', kind: 'AccessToken' };
      mockPrisma._addOidcPayload({
        id: 'AccessToken:token-123',
        type: 'AccessToken',
        payload,
        grantId: null,
        userCode: null,
        uid: null,
        expiresAt: new Date(Date.now() + 3600 * 1000),
        consumedAt: null,
        createdAt: new Date(),
      });

      const result = await adapter.find('token-123');

      expect(result).toEqual(payload);
    });

    it('should return undefined when payload is expired', async () => {
      const payload = { jti: 'token-123', kind: 'AccessToken' };
      mockPrisma._addOidcPayload({
        id: 'AccessToken:token-123',
        type: 'AccessToken',
        payload,
        grantId: null,
        userCode: null,
        uid: null,
        expiresAt: new Date(Date.now() - 1000), // Expired
        consumedAt: null,
        createdAt: new Date(),
      });

      const result = await adapter.find('token-123');

      expect(result).toBeUndefined();
    });

    it('should return payload when expiresAt is null', async () => {
      const payload = { jti: 'session-123', kind: 'Session' };
      mockPrisma._addOidcPayload({
        id: 'AccessToken:session-123',
        type: 'Session',
        payload,
        grantId: null,
        userCode: null,
        uid: null,
        expiresAt: null,
        consumedAt: null,
        createdAt: new Date(),
      });

      const result = await adapter.find('session-123');

      expect(result).toEqual(payload);
    });
  });

  describe('findByUserCode', () => {
    it('should return undefined when no matching userCode', async () => {
      const result = await adapter.findByUserCode('NONEXISTENT');

      expect(result).toBeUndefined();
    });

    it('should return payload when userCode matches', async () => {
      const payload = { jti: 'device-123', kind: 'DeviceCode', userCode: 'ABC123' };
      mockPrisma._addOidcPayload({
        id: 'AccessToken:device-123',
        type: 'AccessToken',
        payload,
        grantId: null,
        userCode: 'ABC123',
        uid: null,
        expiresAt: new Date(Date.now() + 3600 * 1000),
        consumedAt: null,
        createdAt: new Date(),
      });

      const result = await adapter.findByUserCode('ABC123');

      expect(result).toEqual(payload);
    });

    it('should return undefined when userCode matches but expired', async () => {
      const payload = { jti: 'device-123', kind: 'DeviceCode', userCode: 'ABC123' };
      mockPrisma._addOidcPayload({
        id: 'AccessToken:device-123',
        type: 'AccessToken',
        payload,
        grantId: null,
        userCode: 'ABC123',
        uid: null,
        expiresAt: new Date(Date.now() - 1000), // Expired
        consumedAt: null,
        createdAt: new Date(),
      });

      const result = await adapter.findByUserCode('ABC123');

      expect(result).toBeUndefined();
    });
  });

  describe('findByUid', () => {
    it('should return undefined when no matching uid', async () => {
      const result = await adapter.findByUid('nonexistent-uid');

      expect(result).toBeUndefined();
    });

    it('should return payload when uid matches', async () => {
      const payload = { jti: 'interaction-123', kind: 'Interaction', uid: 'uid-789' };
      mockPrisma._addOidcPayload({
        id: 'AccessToken:interaction-123',
        type: 'AccessToken',
        payload,
        grantId: null,
        userCode: null,
        uid: 'uid-789',
        expiresAt: new Date(Date.now() + 3600 * 1000),
        consumedAt: null,
        createdAt: new Date(),
      });

      const result = await adapter.findByUid('uid-789');

      expect(result).toEqual(payload);
    });

    it('should return undefined when uid matches but expired', async () => {
      const payload = { jti: 'interaction-123', kind: 'Interaction', uid: 'uid-789' };
      mockPrisma._addOidcPayload({
        id: 'AccessToken:interaction-123',
        type: 'AccessToken',
        payload,
        grantId: null,
        userCode: null,
        uid: 'uid-789',
        expiresAt: new Date(Date.now() - 1000), // Expired
        consumedAt: null,
        createdAt: new Date(),
      });

      const result = await adapter.findByUid('uid-789');

      expect(result).toBeUndefined();
    });
  });

  describe('consume', () => {
    it('should set consumedAt on the payload', async () => {
      mockPrisma._addOidcPayload({
        id: 'AccessToken:code-123',
        type: 'AccessToken',
        payload: { jti: 'code-123', kind: 'AuthorizationCode' },
        grantId: null,
        userCode: null,
        uid: null,
        expiresAt: null,
        consumedAt: null,
        createdAt: new Date(),
      });

      await adapter.consume('code-123');

      expect(mockPrisma.oidcPayload.update).toHaveBeenCalledWith({
        where: { id: 'AccessToken:code-123' },
        data: { consumedAt: expect.any(Date) },
      });
    });
  });

  describe('destroy', () => {
    it('should delete the payload', async () => {
      mockPrisma._addOidcPayload({
        id: 'AccessToken:token-123',
        type: 'AccessToken',
        payload: { jti: 'token-123' },
        grantId: null,
        userCode: null,
        uid: null,
        expiresAt: null,
        consumedAt: null,
        createdAt: new Date(),
      });

      await adapter.destroy('token-123');

      expect(mockPrisma.oidcPayload.delete).toHaveBeenCalledWith({
        where: { id: 'AccessToken:token-123' },
      });
    });

    it('should not throw when payload does not exist', async () => {
      await expect(adapter.destroy('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('revokeByGrantId', () => {
    it('should delete all payloads with matching grantId', async () => {
      mockPrisma._addOidcPayload({
        id: 'AccessToken:token-1',
        type: 'AccessToken',
        payload: { jti: 'token-1' },
        grantId: 'grant-123',
        userCode: null,
        uid: null,
        expiresAt: null,
        consumedAt: null,
        createdAt: new Date(),
      });

      mockPrisma._addOidcPayload({
        id: 'RefreshToken:token-2',
        type: 'RefreshToken',
        payload: { jti: 'token-2' },
        grantId: 'grant-123',
        userCode: null,
        uid: null,
        expiresAt: null,
        consumedAt: null,
        createdAt: new Date(),
      });

      await adapter.revokeByGrantId('grant-123');

      expect(mockPrisma.oidcPayload.deleteMany).toHaveBeenCalledWith({
        where: { grantId: 'grant-123' },
      });
    });
  });

  describe('key generation', () => {
    it('should prefix id with model name', async () => {
      const sessionAdapter = new PrismaAdapter('Session', mockPrisma as unknown as PrismaClient);
      const payload = { jti: 'session-id', kind: 'Session' };

      await sessionAdapter.upsert('session-id', payload, 0);

      const call = mockPrisma.oidcPayload.upsert.mock.calls[0][0];
      expect(call.where.id).toBe('Session:session-id');
      expect(call.create.id).toBe('Session:session-id');
    });

    it('should use correct prefix for different model types', async () => {
      const types = ['AccessToken', 'RefreshToken', 'AuthorizationCode', 'Session', 'Grant'];

      for (const type of types) {
        const typeAdapter = new PrismaAdapter(type, mockPrisma as unknown as PrismaClient);
        await typeAdapter.upsert('test-id', { jti: 'test-id', kind: type }, 0);
      }

      expect(mockPrisma.oidcPayload.upsert).toHaveBeenCalledTimes(5);
      types.forEach((type, index) => {
        const call = mockPrisma.oidcPayload.upsert.mock.calls[index][0];
        expect(call.create.id).toBe(`${type}:test-id`);
        expect(call.create.type).toBe(type);
      });
    });
  });
});

describe('createPrismaAdapterFactory', () => {
  it('should create a factory function that returns PrismaAdapter instances', () => {
    const mockPrisma = createMockPrismaClient();
    const factory = createPrismaAdapterFactory(mockPrisma as unknown as PrismaClient);

    const accessTokenAdapter = factory('AccessToken');
    const sessionAdapter = factory('Session');

    expect(accessTokenAdapter).toBeInstanceOf(PrismaAdapter);
    expect(sessionAdapter).toBeInstanceOf(PrismaAdapter);
  });

  it('should create adapters with the correct model name', async () => {
    const mockPrisma = createMockPrismaClient();
    const factory = createPrismaAdapterFactory(mockPrisma as unknown as PrismaClient);

    const adapter = factory('RefreshToken');
    await adapter.upsert('test-id', { jti: 'test-id', kind: 'RefreshToken' }, 0);

    const call = mockPrisma.oidcPayload.upsert.mock.calls[0][0];
    expect(call.create.type).toBe('RefreshToken');
  });
});
