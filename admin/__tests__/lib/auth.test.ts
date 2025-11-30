import { createToken, verifyToken, AdminSession } from '../../lib/auth';

// Mock next/headers cookies
jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}));

// Mock prisma
jest.mock('../../lib/prisma', () => ({
  prisma: {},
}));

describe('Auth Library', () => {
  describe('createToken', () => {
    it('should create a valid JWT token', async () => {
      const session: AdminSession = {
        userId: 'admin-123',
        email: 'admin@example.com',
        role: 'ADMIN',
      };

      const token = await createToken(session);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      // JWT format: header.payload.signature
      expect(token.split('.')).toHaveLength(3);
    });

    it('should encode session data in token', async () => {
      const session: AdminSession = {
        userId: 'admin-456',
        email: 'super@example.com',
        role: 'SUPER_ADMIN',
      };

      const token = await createToken(session);
      const verified = await verifyToken(token);

      expect(verified).not.toBeNull();
      expect(verified?.userId).toBe(session.userId);
      expect(verified?.email).toBe(session.email);
      expect(verified?.role).toBe(session.role);
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', async () => {
      const session: AdminSession = {
        userId: 'admin-789',
        email: 'test@example.com',
        role: 'ADMIN',
      };

      const token = await createToken(session);
      const result = await verifyToken(token);

      expect(result).not.toBeNull();
      expect(result?.userId).toBe('admin-789');
      expect(result?.email).toBe('test@example.com');
      expect(result?.role).toBe('ADMIN');
    });

    it('should return null for invalid token', async () => {
      const result = await verifyToken('invalid-token');

      expect(result).toBeNull();
    });

    it('should return null for malformed JWT', async () => {
      const result = await verifyToken('not.a.valid.jwt.token');

      expect(result).toBeNull();
    });

    it('should return null for token signed with different secret', async () => {
      // Create a token that looks valid but has wrong signature
      const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0IiwiZW1haWwiOiJ0ZXN0QHRlc3QuY29tIiwicm9sZSI6IkFETUlOIn0.wrongsignature';

      const result = await verifyToken(fakeToken);

      expect(result).toBeNull();
    });

    it('should handle empty string token', async () => {
      const result = await verifyToken('');

      expect(result).toBeNull();
    });
  });

  describe('token round-trip', () => {
    it('should preserve all session data through encode/decode', async () => {
      const originalSession: AdminSession = {
        userId: 'user-roundtrip-123',
        email: 'roundtrip@test.com',
        role: 'SUPER_ADMIN',
      };

      const token = await createToken(originalSession);
      const decodedSession = await verifyToken(token);

      expect(decodedSession).toEqual(expect.objectContaining(originalSession));
    });

    it('should handle special characters in email', async () => {
      const session: AdminSession = {
        userId: 'special-123',
        email: 'admin+test@sub.example.com',
        role: 'ADMIN',
      };

      const token = await createToken(session);
      const decoded = await verifyToken(token);

      expect(decoded?.email).toBe('admin+test@sub.example.com');
    });
  });
});
