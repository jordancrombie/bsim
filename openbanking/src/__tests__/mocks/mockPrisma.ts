// Mock PrismaClient for testing

export interface MockConsentData {
  id: string;
  userId: string;
  clientId: string;
  scopes: string[];
  accountIds: string[];
  revokedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockAccountData {
  id: string;
  userId: string;
  accountNumber: string;
  accountType: string;
  balance: { toString: () => string };
  createdAt: Date;
  updatedAt: Date;
  user?: {
    firstName: string;
    lastName: string;
    email?: string;
  };
}

export interface MockTransactionData {
  id: string;
  accountId: string;
  type: string;
  amount: { toString: () => string };
  description: string | null;
  balanceAfter: { toString: () => string };
  createdAt: Date;
}

export interface MockUserData {
  id: string;
  fiUserRef: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  dateOfBirth: Date | null;
  accounts?: MockAccountData[];
}

export function createMockPrismaClient() {
  // In-memory storage
  const consents: MockConsentData[] = [];
  const accounts: MockAccountData[] = [];
  const transactions: MockTransactionData[] = [];
  const users: MockUserData[] = [];

  const mockPrisma = {
    consent: {
      findFirst: jest.fn().mockImplementation(async (args: any) => {
        const { where, select } = args;
        const now = new Date();

        const consent = consents.find((c) => {
          if (c.userId !== where.userId) return false;
          if (c.clientId !== where.clientId) return false;
          if (c.revokedAt !== null) return false;

          // Check expiration
          if (where.OR) {
            const notExpired =
              c.expiresAt === null || c.expiresAt > now;
            if (!notExpired) return false;
          }

          return true;
        });

        if (!consent) return null;

        // Return selected fields
        if (select) {
          const result: Partial<MockConsentData> = {};
          if (select.accountIds) result.accountIds = consent.accountIds;
          if (select.scopes) result.scopes = consent.scopes;
          return result;
        }

        return consent;
      }),
    },

    account: {
      findMany: jest.fn().mockImplementation(async (args: any) => {
        const { where, skip = 0, take, orderBy, select } = args;
        let filtered = accounts.filter((a) => {
          if (where?.userId && a.userId !== where.userId) return false;
          return true;
        });

        // Sort
        if (orderBy?.createdAt === 'desc') {
          filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }

        // Paginate
        filtered = filtered.slice(skip, take ? skip + take : undefined);

        // Select fields and add user data if needed
        if (select) {
          return filtered.map((a) => {
            const result: any = {};
            if (select.id) result.id = a.id;
            if (select.accountNumber) result.accountNumber = a.accountNumber;
            if (select.accountType) result.accountType = a.accountType;
            if (select.balance) result.balance = a.balance;
            if (select.createdAt) result.createdAt = a.createdAt;
            if (select.updatedAt) result.updatedAt = a.updatedAt;
            if (select.user) {
              result.user = a.user || { firstName: 'Test', lastName: 'User' };
            }
            return result;
          });
        }

        return filtered;
      }),

      findFirst: jest.fn().mockImplementation(async (args: any) => {
        const { where, select } = args;
        const account = accounts.find((a) => {
          if (where?.id && a.id !== where.id) return false;
          if (where?.userId && a.userId !== where.userId) return false;
          return true;
        });

        if (!account) return null;

        if (select) {
          const result: any = {};
          if (select.id) result.id = account.id;
          if (select.accountNumber) result.accountNumber = account.accountNumber;
          if (select.accountType) result.accountType = account.accountType;
          if (select.balance) result.balance = account.balance;
          if (select.createdAt) result.createdAt = account.createdAt;
          if (select.updatedAt) result.updatedAt = account.updatedAt;
          if (select.user) {
            result.user = account.user || { firstName: 'Test', lastName: 'User', email: 'test@example.com' };
          }
          return result;
        }

        return account;
      }),
    },

    transaction: {
      findMany: jest.fn().mockImplementation(async (args: any) => {
        const { where, skip = 0, take, orderBy } = args;
        let filtered = transactions.filter((t) => {
          if (where?.accountId && t.accountId !== where.accountId) return false;
          if (where?.createdAt) {
            if (where.createdAt.gte && t.createdAt < where.createdAt.gte) return false;
            if (where.createdAt.lte && t.createdAt > where.createdAt.lte) return false;
          }
          return true;
        });

        // Sort
        if (orderBy?.createdAt === 'desc') {
          filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }

        // Paginate
        filtered = filtered.slice(skip, take ? skip + take : undefined);

        return filtered;
      }),
    },

    user: {
      findUnique: jest.fn().mockImplementation(async (args: any) => {
        const { where, select } = args;
        const user = users.find((u) => {
          if (where?.id && u.id !== where.id) return false;
          if (where?.fiUserRef && u.fiUserRef !== where.fiUserRef) return false;
          return true;
        });

        if (!user) return null;

        if (select) {
          const result: any = {};
          if (select.id) result.id = user.id;
          if (select.fiUserRef) result.fiUserRef = user.fiUserRef;
          if (select.firstName) result.firstName = user.firstName;
          if (select.lastName) result.lastName = user.lastName;
          if (select.email) result.email = user.email;
          if (select.phone) result.phone = user.phone;
          if (select.address) result.address = user.address;
          if (select.city) result.city = user.city;
          if (select.state) result.state = user.state;
          if (select.postalCode) result.postalCode = user.postalCode;
          if (select.country) result.country = user.country;
          if (select.dateOfBirth) result.dateOfBirth = user.dateOfBirth;
          if (select.accounts) {
            result.accounts = accounts.filter((a) => a.userId === user.id);
          }
          return result;
        }

        return user;
      }),
    },

    // Helper methods for test setup
    _addConsent: (consent: MockConsentData) => {
      consents.push(consent);
    },
    _addAccount: (account: MockAccountData) => {
      accounts.push(account);
    },
    _addTransaction: (transaction: MockTransactionData) => {
      transactions.push(transaction);
    },
    _addUser: (user: MockUserData) => {
      users.push(user);
    },
    _clear: () => {
      consents.length = 0;
      accounts.length = 0;
      transactions.length = 0;
      users.length = 0;
    },
  };

  return mockPrisma;
}

export type MockPrismaClient = ReturnType<typeof createMockPrismaClient>;
