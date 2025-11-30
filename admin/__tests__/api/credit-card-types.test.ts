import { NextResponse } from 'next/server';
import { createMockPrismaClient, MockPrismaClient, MockCreditCardTypeData } from '../mocks/mockPrisma';

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
import { GET, POST } from '../../app/api/credit-card-types/route';
import {
  GET as GET_BY_ID,
  PUT,
  DELETE,
} from '../../app/api/credit-card-types/[id]/route';

describe('Credit Card Types API', () => {
  const testAdmin = {
    id: 'admin-123',
    email: 'admin@example.com',
    firstName: 'Admin',
    lastName: 'User',
    role: 'ADMIN',
    createdAt: new Date(),
  };

  const testCreditCardType: MockCreditCardTypeData = {
    id: 'cctype-123',
    code: 'VISA',
    name: 'Visa',
    cardNumberPrefix: '4',
    cardNumberLength: 16,
    cvvLength: 3,
    isDebit: false,
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

  describe('GET /api/credit-card-types', () => {
    it('should return all credit card types', async () => {
      mockPrisma._addCreditCardType(testCreditCardType);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.creditCardTypes).toHaveLength(1);
      expect(data.creditCardTypes[0].code).toBe('VISA');
    });

    it('should return 401 when not authenticated', async () => {
      mockCurrentAdmin = null;

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return empty array when no credit card types exist', async () => {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.creditCardTypes).toHaveLength(0);
    });

    it('should order by sortOrder ascending', async () => {
      mockPrisma._addCreditCardType({ ...testCreditCardType, id: 'cc-2', code: 'MC', sortOrder: 2 });
      mockPrisma._addCreditCardType({ ...testCreditCardType, id: 'cc-1', code: 'VISA', sortOrder: 1 });

      const response = await GET();
      const data = await response.json();

      expect(data.creditCardTypes[0].code).toBe('VISA');
      expect(data.creditCardTypes[1].code).toBe('MC');
    });
  });

  describe('POST /api/credit-card-types', () => {
    it('should create a new credit card type', async () => {
      const request = new Request('http://localhost/api/credit-card-types', {
        method: 'POST',
        body: JSON.stringify({
          code: 'AMEX',
          name: 'American Express',
          cardNumberPrefix: '34',
          cardNumberLength: 15,
          cvvLength: 4,
          isDebit: false,
          sortOrder: 1,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.creditCardType).toBeDefined();
      expect(data.creditCardType.code).toBe('AMEX');
      expect(data.creditCardType.name).toBe('American Express');
    });

    it('should return 401 when not authenticated', async () => {
      mockCurrentAdmin = null;

      const request = new Request('http://localhost/api/credit-card-types', {
        method: 'POST',
        body: JSON.stringify({ code: 'TEST', name: 'Test', cardNumberPrefix: '1' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 400 when required fields are missing', async () => {
      const request = new Request('http://localhost/api/credit-card-types', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test' }), // missing code and cardNumberPrefix
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Code, name, and card number prefix are required');
    });

    it('should return 400 when code already exists', async () => {
      mockPrisma._addCreditCardType(testCreditCardType);

      const request = new Request('http://localhost/api/credit-card-types', {
        method: 'POST',
        body: JSON.stringify({
          code: 'VISA', // already exists
          name: 'Another Visa',
          cardNumberPrefix: '4',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('A credit card type with this code already exists');
    });

    it('should uppercase the code', async () => {
      const request = new Request('http://localhost/api/credit-card-types', {
        method: 'POST',
        body: JSON.stringify({
          code: 'discover',
          name: 'Discover',
          cardNumberPrefix: '6011',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.creditCardType.code).toBe('DISCOVER');
    });

    it('should use default values for optional fields', async () => {
      const request = new Request('http://localhost/api/credit-card-types', {
        method: 'POST',
        body: JSON.stringify({
          code: 'TEST',
          name: 'Test Card',
          cardNumberPrefix: '9',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.creditCardType.cardNumberLength).toBe(16);
      expect(data.creditCardType.cvvLength).toBe(3);
      expect(data.creditCardType.isDebit).toBe(false);
      expect(data.creditCardType.isActive).toBe(true);
      expect(data.creditCardType.sortOrder).toBe(0);
    });
  });

  describe('GET /api/credit-card-types/[id]', () => {
    it('should return a single credit card type', async () => {
      mockPrisma._addCreditCardType(testCreditCardType);

      const response = await GET_BY_ID(
        new Request('http://localhost/api/credit-card-types/cctype-123'),
        { params: Promise.resolve({ id: 'cctype-123' }) }
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.creditCardType.code).toBe('VISA');
    });

    it('should return 401 when not authenticated', async () => {
      mockCurrentAdmin = null;

      const response = await GET_BY_ID(
        new Request('http://localhost/api/credit-card-types/cctype-123'),
        { params: Promise.resolve({ id: 'cctype-123' }) }
      );
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 404 when not found', async () => {
      const response = await GET_BY_ID(
        new Request('http://localhost/api/credit-card-types/nonexistent'),
        { params: Promise.resolve({ id: 'nonexistent' }) }
      );
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Credit card type not found');
    });
  });

  describe('PUT /api/credit-card-types/[id]', () => {
    it('should update a credit card type', async () => {
      mockPrisma._addCreditCardType(testCreditCardType);

      const request = new Request('http://localhost/api/credit-card-types/cctype-123', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Visa Updated',
          isDebit: true,
        }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'cctype-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.creditCardType.name).toBe('Visa Updated');
      expect(data.creditCardType.isDebit).toBe(true);
    });

    it('should return 401 when not authenticated', async () => {
      mockCurrentAdmin = null;

      const request = new Request('http://localhost/api/credit-card-types/cctype-123', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Test' }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'cctype-123' }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 404 when not found', async () => {
      const request = new Request('http://localhost/api/credit-card-types/nonexistent', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Test' }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'nonexistent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Credit card type not found');
    });

    it('should preserve existing values when not provided', async () => {
      mockPrisma._addCreditCardType(testCreditCardType);

      const request = new Request('http://localhost/api/credit-card-types/cctype-123', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Updated Name',
          // other fields not provided
        }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'cctype-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.creditCardType.name).toBe('Updated Name');
      expect(data.creditCardType.cardNumberPrefix).toBe('4'); // preserved
      expect(data.creditCardType.cvvLength).toBe(3); // preserved
    });
  });

  describe('DELETE /api/credit-card-types/[id]', () => {
    it('should delete a credit card type', async () => {
      mockPrisma._addCreditCardType(testCreditCardType);

      const request = new Request('http://localhost/api/credit-card-types/cctype-123', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: 'cctype-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockPrisma._getCreditCardTypes()).toHaveLength(0);
    });

    it('should return 401 when not authenticated', async () => {
      mockCurrentAdmin = null;

      const request = new Request('http://localhost/api/credit-card-types/cctype-123', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: 'cctype-123' }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 404 when not found', async () => {
      const request = new Request('http://localhost/api/credit-card-types/nonexistent', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: 'nonexistent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Credit card type not found');
    });
  });
});
