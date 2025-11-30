// Must mock oidc-provider before importing anything that uses it
jest.mock('oidc-provider', () => ({
  default: jest.fn(),
}));

import { verifyUserPassword } from '../../config/oidc';
import { createMockPrismaClient, MockPrismaClient } from '../mocks/mockPrisma';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

// Mock bcrypt
jest.mock('bcrypt');
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('verifyUserPassword', () => {
  let mockPrisma: MockPrismaClient;

  const testUser = {
    id: 'user-123',
    fiUserRef: 'fi-user-ref-123',
    email: 'test@example.com',
    password: '$2b$10$hashedpassword',
    firstName: 'John',
    lastName: 'Doe',
    phone: null,
    address: null,
    city: null,
    state: null,
    postalCode: null,
    country: null,
    dateOfBirth: null,
  };

  beforeEach(() => {
    mockPrisma = createMockPrismaClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    mockPrisma._clear();
  });

  it('should return null when user does not exist', async () => {
    const result = await verifyUserPassword(
      mockPrisma as unknown as PrismaClient,
      'nonexistent@example.com',
      'password123'
    );

    expect(result).toBeNull();
    expect(mockBcrypt.compare).not.toHaveBeenCalled();
  });

  it('should return null when password is incorrect', async () => {
    mockPrisma._addUser(testUser);
    mockBcrypt.compare.mockResolvedValue(false as never);

    const result = await verifyUserPassword(
      mockPrisma as unknown as PrismaClient,
      'test@example.com',
      'wrongpassword'
    );

    expect(result).toBeNull();
    expect(mockBcrypt.compare).toHaveBeenCalledWith('wrongpassword', testUser.password);
  });

  it('should return user data when credentials are valid', async () => {
    mockPrisma._addUser(testUser);
    mockBcrypt.compare.mockResolvedValue(true as never);

    const result = await verifyUserPassword(
      mockPrisma as unknown as PrismaClient,
      'test@example.com',
      'correctpassword'
    );

    expect(result).toEqual({
      id: 'user-123',
      fiUserRef: 'fi-user-ref-123',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
    });
    expect(mockBcrypt.compare).toHaveBeenCalledWith('correctpassword', testUser.password);
  });

  it('should not return password in the result', async () => {
    mockPrisma._addUser(testUser);
    mockBcrypt.compare.mockResolvedValue(true as never);

    const result = await verifyUserPassword(
      mockPrisma as unknown as PrismaClient,
      'test@example.com',
      'correctpassword'
    );

    expect(result).not.toHaveProperty('password');
  });

  it('should handle case-sensitive email lookup', async () => {
    mockPrisma._addUser(testUser);

    // With uppercase email - should not find
    const result = await verifyUserPassword(
      mockPrisma as unknown as PrismaClient,
      'TEST@EXAMPLE.COM',
      'password123'
    );

    expect(result).toBeNull();
  });

  it('should return fiUserRef for external identity', async () => {
    const userWithFiRef = {
      ...testUser,
      fiUserRef: 'external-user-ref-456',
    };
    mockPrisma._addUser(userWithFiRef);
    mockBcrypt.compare.mockResolvedValue(true as never);

    const result = await verifyUserPassword(
      mockPrisma as unknown as PrismaClient,
      'test@example.com',
      'password'
    );

    expect(result?.fiUserRef).toBe('external-user-ref-456');
  });

  it('should query user with correct select fields', async () => {
    mockPrisma._addUser(testUser);
    mockBcrypt.compare.mockResolvedValue(true as never);

    await verifyUserPassword(
      mockPrisma as unknown as PrismaClient,
      'test@example.com',
      'password'
    );

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'test@example.com' },
      select: {
        id: true,
        fiUserRef: true,
        email: true,
        password: true,
        firstName: true,
        lastName: true,
      },
    });
  });
});
