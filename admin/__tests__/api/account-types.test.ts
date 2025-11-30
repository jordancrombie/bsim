import { createMockPrismaClient, MockPrismaClient, MockAccountTypeData } from '../mocks/mockPrisma';

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
import { GET, POST } from '../../app/api/account-types/route';
import {
  GET as GET_BY_ID,
  PUT,
  DELETE,
} from '../../app/api/account-types/[id]/route';

describe('Account Types API', () => {
  const testAdmin = {
    id: 'admin-123',
    email: 'admin@example.com',
    firstName: 'Admin',
    lastName: 'User',
    role: 'ADMIN',
    createdAt: new Date(),
  };

  const testAccountType: MockAccountTypeData = {
    id: 'accttype-123',
    code: 'CHECKING',
    name: 'Checking Account',
    description: 'Standard checking account',
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

  describe('GET /api/account-types', () => {
    it('should return all account types', async () => {
      mockPrisma._addAccountType(testAccountType);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.accountTypes).toHaveLength(1);
      expect(data.accountTypes[0].code).toBe('CHECKING');
    });

    it('should return 401 when not authenticated', async () => {
      mockCurrentAdmin = null;

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return empty array when no account types exist', async () => {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.accountTypes).toHaveLength(0);
    });

    it('should order by sortOrder ascending', async () => {
      mockPrisma._addAccountType({ ...testAccountType, id: 'at-2', code: 'SAVINGS', sortOrder: 2 });
      mockPrisma._addAccountType({ ...testAccountType, id: 'at-1', code: 'CHECKING', sortOrder: 1 });

      const response = await GET();
      const data = await response.json();

      expect(data.accountTypes[0].code).toBe('CHECKING');
      expect(data.accountTypes[1].code).toBe('SAVINGS');
    });
  });

  describe('POST /api/account-types', () => {
    it('should create a new account type', async () => {
      const request = new Request('http://localhost/api/account-types', {
        method: 'POST',
        body: JSON.stringify({
          code: 'SAVINGS',
          name: 'Savings Account',
          description: 'Interest-bearing savings account',
          sortOrder: 2,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.accountType).toBeDefined();
      expect(data.accountType.code).toBe('SAVINGS');
      expect(data.accountType.name).toBe('Savings Account');
    });

    it('should return 401 when not authenticated', async () => {
      mockCurrentAdmin = null;

      const request = new Request('http://localhost/api/account-types', {
        method: 'POST',
        body: JSON.stringify({ code: 'TEST', name: 'Test' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 400 when required fields are missing', async () => {
      const request = new Request('http://localhost/api/account-types', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test' }), // missing code
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Code and name are required');
    });

    it('should return 400 when code already exists', async () => {
      mockPrisma._addAccountType(testAccountType);

      const request = new Request('http://localhost/api/account-types', {
        method: 'POST',
        body: JSON.stringify({
          code: 'CHECKING', // already exists
          name: 'Another Checking',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('An account type with this code already exists');
    });

    it('should uppercase the code', async () => {
      const request = new Request('http://localhost/api/account-types', {
        method: 'POST',
        body: JSON.stringify({
          code: 'money-market',
          name: 'Money Market',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.accountType.code).toBe('MONEY-MARKET');
    });

    it('should use default values for optional fields', async () => {
      const request = new Request('http://localhost/api/account-types', {
        method: 'POST',
        body: JSON.stringify({
          code: 'TEST',
          name: 'Test Account',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.accountType.description).toBeNull();
      expect(data.accountType.isActive).toBe(true);
      expect(data.accountType.sortOrder).toBe(0);
    });
  });

  describe('GET /api/account-types/[id]', () => {
    it('should return a single account type', async () => {
      mockPrisma._addAccountType(testAccountType);

      const response = await GET_BY_ID(
        new Request('http://localhost/api/account-types/accttype-123'),
        { params: Promise.resolve({ id: 'accttype-123' }) }
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.accountType.code).toBe('CHECKING');
    });

    it('should return 401 when not authenticated', async () => {
      mockCurrentAdmin = null;

      const response = await GET_BY_ID(
        new Request('http://localhost/api/account-types/accttype-123'),
        { params: Promise.resolve({ id: 'accttype-123' }) }
      );
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 404 when not found', async () => {
      const response = await GET_BY_ID(
        new Request('http://localhost/api/account-types/nonexistent'),
        { params: Promise.resolve({ id: 'nonexistent' }) }
      );
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Account type not found');
    });
  });

  describe('PUT /api/account-types/[id]', () => {
    it('should update an account type', async () => {
      mockPrisma._addAccountType(testAccountType);

      const request = new Request('http://localhost/api/account-types/accttype-123', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Checking Updated',
          description: 'Updated description',
        }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'accttype-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.accountType.name).toBe('Checking Updated');
      expect(data.accountType.description).toBe('Updated description');
    });

    it('should return 401 when not authenticated', async () => {
      mockCurrentAdmin = null;

      const request = new Request('http://localhost/api/account-types/accttype-123', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Test' }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'accttype-123' }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 404 when not found', async () => {
      const request = new Request('http://localhost/api/account-types/nonexistent', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Test' }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'nonexistent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Account type not found');
    });

    it('should preserve existing values when not provided', async () => {
      mockPrisma._addAccountType(testAccountType);

      const request = new Request('http://localhost/api/account-types/accttype-123', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Updated Name',
          // other fields not provided
        }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'accttype-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.accountType.name).toBe('Updated Name');
      expect(data.accountType.description).toBe('Standard checking account'); // preserved
      expect(data.accountType.sortOrder).toBe(1); // preserved
    });

    it('should allow setting isActive to false', async () => {
      mockPrisma._addAccountType(testAccountType);

      const request = new Request('http://localhost/api/account-types/accttype-123', {
        method: 'PUT',
        body: JSON.stringify({
          isActive: false,
        }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'accttype-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.accountType.isActive).toBe(false);
    });
  });

  describe('DELETE /api/account-types/[id]', () => {
    it('should delete an account type', async () => {
      mockPrisma._addAccountType(testAccountType);

      const request = new Request('http://localhost/api/account-types/accttype-123', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: 'accttype-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockPrisma._getAccountTypes()).toHaveLength(0);
    });

    it('should return 401 when not authenticated', async () => {
      mockCurrentAdmin = null;

      const request = new Request('http://localhost/api/account-types/accttype-123', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: 'accttype-123' }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 404 when not found', async () => {
      const request = new Request('http://localhost/api/account-types/nonexistent', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: 'nonexistent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Account type not found');
    });
  });
});
