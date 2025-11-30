import { createMockPrismaClient, MockPrismaClient, MockUserData } from '../mocks/mockPrisma';

// Mock prisma
let mockPrisma: MockPrismaClient;

jest.mock('../../lib/prisma', () => ({
  get prisma() {
    return mockPrisma;
  },
}));

// Import after mocking
import { GET } from '../../app/api/users/route';

describe('Users API', () => {
  const testUser: MockUserData = {
    id: 'user-123',
    email: 'user@example.com',
    firstName: 'John',
    lastName: 'Doe',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    _count: {
      accounts: 2,
      creditCards: 1,
      passkeys: 1,
    },
  };

  const testUser2: MockUserData = {
    id: 'user-456',
    email: 'jane@example.com',
    firstName: 'Jane',
    lastName: 'Smith',
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-02'),
    _count: {
      accounts: 3,
      creditCards: 2,
      passkeys: 0,
    },
  };

  beforeEach(() => {
    mockPrisma = createMockPrismaClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    mockPrisma._clear();
  });

  describe('GET /api/users', () => {
    it('should return all users', async () => {
      mockPrisma._addUser(testUser);
      mockPrisma._addUser(testUser2);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.users).toHaveLength(2);
    });

    it('should return empty array when no users exist', async () => {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.users).toHaveLength(0);
    });

    it('should include user counts for accounts, credit cards, and passkeys', async () => {
      mockPrisma._addUser(testUser);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.users[0]._count).toBeDefined();
      expect(data.users[0]._count.accounts).toBe(2);
      expect(data.users[0]._count.creditCards).toBe(1);
      expect(data.users[0]._count.passkeys).toBe(1);
    });

    it('should order users by createdAt descending', async () => {
      mockPrisma._addUser(testUser);  // Jan 1
      mockPrisma._addUser(testUser2); // Jan 2

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      // Most recent first
      expect(data.users[0].email).toBe('jane@example.com');
      expect(data.users[1].email).toBe('user@example.com');
    });

    it('should include required user fields', async () => {
      mockPrisma._addUser(testUser);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.users[0]).toHaveProperty('id');
      expect(data.users[0]).toHaveProperty('email');
      expect(data.users[0]).toHaveProperty('firstName');
      expect(data.users[0]).toHaveProperty('lastName');
      expect(data.users[0]).toHaveProperty('createdAt');
      expect(data.users[0]).toHaveProperty('updatedAt');
    });

    it('should handle database error gracefully', async () => {
      mockPrisma.user.findMany = jest.fn().mockRejectedValue(new Error('Database error'));

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch users');
    });
  });
});
