import { createMockPrismaClient, MockPrismaClient, MockWebAuthnRelatedOriginData } from '../mocks/mockPrisma';

// Mock prisma
let mockPrisma: MockPrismaClient;

jest.mock('../../lib/prisma', () => ({
  get prisma() {
    return mockPrisma;
  },
}));

// Mock getCurrentAdmin
let mockCurrentAdmin: any = null;

jest.mock('../../lib/auth', () => ({
  getCurrentAdmin: jest.fn(() => Promise.resolve(mockCurrentAdmin)),
}));

// Import after mocking
import { GET, POST } from '../../app/api/webauthn-origins/route';
import {
  GET as GET_BY_ID,
  PUT,
  DELETE,
} from '../../app/api/webauthn-origins/[id]/route';

describe('WebAuthn Origins API', () => {
  const testAdmin = {
    id: 'admin-123',
    email: 'admin@example.com',
    firstName: 'Admin',
    lastName: 'User',
    role: 'ADMIN',
    createdAt: new Date(),
  };

  const testOrigin: MockWebAuthnRelatedOriginData = {
    id: 'origin-123',
    origin: 'https://banksim.ca',
    description: 'BSIM main domain',
    isActive: true,
    sortOrder: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockPrisma = createMockPrismaClient();
    mockCurrentAdmin = testAdmin;
    jest.clearAllMocks();
  });

  afterEach(() => {
    mockPrisma._clear();
    mockCurrentAdmin = null;
  });

  describe('GET /api/webauthn-origins', () => {
    it('should return all WebAuthn origins', async () => {
      mockPrisma._addWebAuthnRelatedOrigin(testOrigin);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.origins).toHaveLength(1);
      expect(data.origins[0].origin).toBe('https://banksim.ca');
    });

    it('should return 401 when not authenticated', async () => {
      mockCurrentAdmin = null;

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return empty array when no origins exist', async () => {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.origins).toHaveLength(0);
    });

    it('should order by sortOrder ascending', async () => {
      mockPrisma._addWebAuthnRelatedOrigin({ ...testOrigin, id: 'origin-2', origin: 'https://example.com', sortOrder: 2 });
      mockPrisma._addWebAuthnRelatedOrigin({ ...testOrigin, id: 'origin-1', origin: 'https://banksim.ca', sortOrder: 1 });

      const response = await GET();
      const data = await response.json();

      expect(data.origins[0].origin).toBe('https://banksim.ca');
      expect(data.origins[1].origin).toBe('https://example.com');
    });
  });

  describe('POST /api/webauthn-origins', () => {
    it('should create a new WebAuthn origin', async () => {
      const request = new Request('http://localhost/api/webauthn-origins', {
        method: 'POST',
        body: JSON.stringify({
          origin: 'https://store.regalmoose.ca',
          description: 'Regal Moose store',
          sortOrder: 2,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.origin).toBeDefined();
      expect(data.origin.origin).toBe('https://store.regalmoose.ca');
      expect(data.origin.description).toBe('Regal Moose store');
    });

    it('should return 401 when not authenticated', async () => {
      mockCurrentAdmin = null;

      const request = new Request('http://localhost/api/webauthn-origins', {
        method: 'POST',
        body: JSON.stringify({ origin: 'https://test.com' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 400 when origin is missing', async () => {
      const request = new Request('http://localhost/api/webauthn-origins', {
        method: 'POST',
        body: JSON.stringify({ description: 'Test' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Origin is required');
    });

    it('should return 400 when origin is not HTTPS', async () => {
      const request = new Request('http://localhost/api/webauthn-origins', {
        method: 'POST',
        body: JSON.stringify({ origin: 'http://example.com' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Origin must be an HTTPS URL (e.g., https://example.com)');
    });

    it('should return 400 when origin has a path', async () => {
      const request = new Request('http://localhost/api/webauthn-origins', {
        method: 'POST',
        body: JSON.stringify({ origin: 'https://example.com/path' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Origin must be a valid origin (no path, query, or hash allowed)');
    });

    it('should return 400 when origin has query params', async () => {
      const request = new Request('http://localhost/api/webauthn-origins', {
        method: 'POST',
        body: JSON.stringify({ origin: 'https://example.com?foo=bar' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Origin must be a valid origin (no path, query, or hash allowed)');
    });

    it('should return 400 when origin has hash', async () => {
      const request = new Request('http://localhost/api/webauthn-origins', {
        method: 'POST',
        body: JSON.stringify({ origin: 'https://example.com#section' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Origin must be a valid origin (no path, query, or hash allowed)');
    });

    it('should return 400 for invalid URL format', async () => {
      const request = new Request('http://localhost/api/webauthn-origins', {
        method: 'POST',
        body: JSON.stringify({ origin: 'not-a-url' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Origin must be an HTTPS URL (e.g., https://example.com)');
    });

    it('should return 400 when origin already exists', async () => {
      mockPrisma._addWebAuthnRelatedOrigin(testOrigin);

      const request = new Request('http://localhost/api/webauthn-origins', {
        method: 'POST',
        body: JSON.stringify({ origin: 'https://banksim.ca' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('This origin already exists');
    });

    it('should normalize origin by removing trailing slash', async () => {
      const request = new Request('http://localhost/api/webauthn-origins', {
        method: 'POST',
        body: JSON.stringify({ origin: 'https://example.com/' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.origin.origin).toBe('https://example.com');
    });

    it('should use default values for optional fields', async () => {
      const request = new Request('http://localhost/api/webauthn-origins', {
        method: 'POST',
        body: JSON.stringify({ origin: 'https://example.com' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.origin.description).toBeNull();
      expect(data.origin.isActive).toBe(true);
      expect(data.origin.sortOrder).toBe(0);
    });
  });

  describe('GET /api/webauthn-origins/[id]', () => {
    it('should return a single WebAuthn origin', async () => {
      mockPrisma._addWebAuthnRelatedOrigin(testOrigin);

      const response = await GET_BY_ID(
        new Request('http://localhost/api/webauthn-origins/origin-123'),
        { params: Promise.resolve({ id: 'origin-123' }) }
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.origin.origin).toBe('https://banksim.ca');
    });

    it('should return 401 when not authenticated', async () => {
      mockCurrentAdmin = null;

      const response = await GET_BY_ID(
        new Request('http://localhost/api/webauthn-origins/origin-123'),
        { params: Promise.resolve({ id: 'origin-123' }) }
      );
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 404 when not found', async () => {
      const response = await GET_BY_ID(
        new Request('http://localhost/api/webauthn-origins/nonexistent'),
        { params: Promise.resolve({ id: 'nonexistent' }) }
      );
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('WebAuthn origin not found');
    });
  });

  describe('PUT /api/webauthn-origins/[id]', () => {
    it('should update a WebAuthn origin', async () => {
      mockPrisma._addWebAuthnRelatedOrigin(testOrigin);

      const request = new Request('http://localhost/api/webauthn-origins/origin-123', {
        method: 'PUT',
        body: JSON.stringify({
          description: 'Updated description',
          sortOrder: 5,
        }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'origin-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.origin.description).toBe('Updated description');
      expect(data.origin.sortOrder).toBe(5);
    });

    it('should return 401 when not authenticated', async () => {
      mockCurrentAdmin = null;

      const request = new Request('http://localhost/api/webauthn-origins/origin-123', {
        method: 'PUT',
        body: JSON.stringify({ description: 'Test' }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'origin-123' }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 404 when not found', async () => {
      const request = new Request('http://localhost/api/webauthn-origins/nonexistent', {
        method: 'PUT',
        body: JSON.stringify({ description: 'Test' }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'nonexistent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('WebAuthn origin not found');
    });

    it('should preserve existing values when not provided', async () => {
      mockPrisma._addWebAuthnRelatedOrigin(testOrigin);

      const request = new Request('http://localhost/api/webauthn-origins/origin-123', {
        method: 'PUT',
        body: JSON.stringify({
          isActive: false,
        }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'origin-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.origin.isActive).toBe(false);
      expect(data.origin.description).toBe('BSIM main domain'); // preserved
      expect(data.origin.sortOrder).toBe(1); // preserved
    });

    it('should allow setting isActive to false', async () => {
      mockPrisma._addWebAuthnRelatedOrigin(testOrigin);

      const request = new Request('http://localhost/api/webauthn-origins/origin-123', {
        method: 'PUT',
        body: JSON.stringify({
          isActive: false,
        }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'origin-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.origin.isActive).toBe(false);
    });

    it('should validate updated origin is HTTPS', async () => {
      mockPrisma._addWebAuthnRelatedOrigin(testOrigin);

      const request = new Request('http://localhost/api/webauthn-origins/origin-123', {
        method: 'PUT',
        body: JSON.stringify({
          origin: 'http://example.com',
        }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'origin-123' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Origin must be an HTTPS URL (e.g., https://example.com)');
    });

    it('should validate updated origin has no path', async () => {
      mockPrisma._addWebAuthnRelatedOrigin(testOrigin);

      const request = new Request('http://localhost/api/webauthn-origins/origin-123', {
        method: 'PUT',
        body: JSON.stringify({
          origin: 'https://example.com/path',
        }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'origin-123' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Origin must be a valid origin (no path, query, or hash allowed)');
    });

    it('should return 400 for invalid URL format on update', async () => {
      mockPrisma._addWebAuthnRelatedOrigin(testOrigin);

      const request = new Request('http://localhost/api/webauthn-origins/origin-123', {
        method: 'PUT',
        body: JSON.stringify({
          origin: 'not-a-url',
        }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'origin-123' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Origin must be an HTTPS URL (e.g., https://example.com)');
    });

    it('should return 400 when updating to existing origin', async () => {
      mockPrisma._addWebAuthnRelatedOrigin(testOrigin);
      mockPrisma._addWebAuthnRelatedOrigin({
        ...testOrigin,
        id: 'origin-456',
        origin: 'https://example.com',
      });

      const request = new Request('http://localhost/api/webauthn-origins/origin-123', {
        method: 'PUT',
        body: JSON.stringify({
          origin: 'https://example.com',
        }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'origin-123' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('This origin already exists');
    });

    it('should allow updating to same origin (no change)', async () => {
      mockPrisma._addWebAuthnRelatedOrigin(testOrigin);

      const request = new Request('http://localhost/api/webauthn-origins/origin-123', {
        method: 'PUT',
        body: JSON.stringify({
          origin: 'https://banksim.ca',
          description: 'Updated description',
        }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'origin-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.origin.origin).toBe('https://banksim.ca');
      expect(data.origin.description).toBe('Updated description');
    });
  });

  describe('DELETE /api/webauthn-origins/[id]', () => {
    it('should delete a WebAuthn origin', async () => {
      mockPrisma._addWebAuthnRelatedOrigin(testOrigin);

      const request = new Request('http://localhost/api/webauthn-origins/origin-123', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: 'origin-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockPrisma._getWebAuthnRelatedOrigins()).toHaveLength(0);
    });

    it('should return 401 when not authenticated', async () => {
      mockCurrentAdmin = null;

      const request = new Request('http://localhost/api/webauthn-origins/origin-123', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: 'origin-123' }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 404 when not found', async () => {
      const request = new Request('http://localhost/api/webauthn-origins/nonexistent', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: 'nonexistent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('WebAuthn origin not found');
    });
  });
});
