// Mock PrismaClient for admin module testing

export interface MockAdminUserData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
  passkeys?: MockAdminPasskeyData[];
}

export interface MockAdminPasskeyData {
  id: string;
  adminUserId: string;
  credentialId: string;
  credentialPublicKey: Buffer;
  counter: bigint;
  deviceType: string;
  backedUp: boolean;
  transports: string[];
  createdAt: Date;
  lastUsedAt: Date | null;
  adminUser?: MockAdminUserData;
}

export interface MockUserData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: Date;
  updatedAt: Date;
  _count?: {
    accounts: number;
    creditCards: number;
    passkeys: number;
  };
}

export interface MockCreditCardTypeData {
  id: string;
  code: string;
  name: string;
  cardNumberPrefix: string;
  cardNumberLength: number;
  cvvLength: number;
  isDebit: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockAccountTypeData {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockWebAuthnRelatedOriginData {
  id: string;
  origin: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export function createMockPrismaClient() {
  // In-memory storage
  const adminUsers: MockAdminUserData[] = [];
  const adminPasskeys: MockAdminPasskeyData[] = [];
  const users: MockUserData[] = [];
  const creditCardTypes: MockCreditCardTypeData[] = [];
  const accountTypes: MockAccountTypeData[] = [];
  const webAuthnRelatedOrigins: MockWebAuthnRelatedOriginData[] = [];

  const mockPrisma = {
    adminUser: {
      findUnique: jest.fn().mockImplementation(async (args: any) => {
        const { where, include, select } = args;
        let admin = adminUsers.find((a) => {
          if (where.id && a.id !== where.id) return false;
          if (where.email && a.email !== where.email) return false;
          return true;
        });

        if (!admin) return null;

        // Handle include for passkeys
        if (include?.passkeys) {
          const passkeys = adminPasskeys.filter((p) => p.adminUserId === admin!.id);
          if (include.passkeys.select) {
            const selectedPasskeys = passkeys.map((p) => {
              const selected: any = {};
              Object.keys(include.passkeys.select).forEach((key) => {
                if (include.passkeys.select[key]) selected[key] = (p as any)[key];
              });
              return selected;
            });
            return { ...admin, passkeys: selectedPasskeys };
          }
          return { ...admin, passkeys };
        }

        // Handle select
        if (select) {
          const result: any = {};
          Object.keys(select).forEach((key) => {
            if (select[key]) result[key] = (admin as any)[key];
          });
          return result;
        }

        return admin;
      }),

      findMany: jest.fn().mockImplementation(async (args?: any) => {
        let result = [...adminUsers];
        if (args?.orderBy?.createdAt === 'desc') {
          result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        return result;
      }),

      create: jest.fn().mockImplementation(async (args: any) => {
        const { data } = args;
        const newAdmin: MockAdminUserData = {
          id: `admin-${Date.now()}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        adminUsers.push(newAdmin);
        return newAdmin;
      }),

      update: jest.fn().mockImplementation(async (args: any) => {
        const { where, data } = args;
        const index = adminUsers.findIndex((a) => a.id === where.id);
        if (index < 0) throw new Error('Not found');
        adminUsers[index] = { ...adminUsers[index], ...data, updatedAt: new Date() };
        return adminUsers[index];
      }),
    },

    adminPasskey: {
      findUnique: jest.fn().mockImplementation(async (args: any) => {
        const { where, include } = args;
        let passkey = adminPasskeys.find((p) => {
          if (where.id && p.id !== where.id) return false;
          if (where.credentialId && p.credentialId !== where.credentialId) return false;
          return true;
        });

        if (!passkey) return null;

        // Handle include for adminUser
        if (include?.adminUser) {
          const admin = adminUsers.find((a) => a.id === passkey!.adminUserId);
          return { ...passkey, adminUser: admin };
        }

        return passkey;
      }),

      create: jest.fn().mockImplementation(async (args: any) => {
        const { data } = args;
        const newPasskey: MockAdminPasskeyData = {
          id: `passkey-${Date.now()}`,
          ...data,
          createdAt: new Date(),
          lastUsedAt: null,
        };
        adminPasskeys.push(newPasskey);
        return newPasskey;
      }),

      update: jest.fn().mockImplementation(async (args: any) => {
        const { where, data } = args;
        const index = adminPasskeys.findIndex((p) => p.id === where.id);
        if (index < 0) throw new Error('Not found');
        adminPasskeys[index] = { ...adminPasskeys[index], ...data };
        return adminPasskeys[index];
      }),
    },

    user: {
      findMany: jest.fn().mockImplementation(async (args?: any) => {
        let result = [...users];
        if (args?.orderBy?.createdAt === 'desc') {
          result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        if (args?.select) {
          return result.map((u) => {
            const selected: any = {};
            Object.keys(args.select).forEach((key) => {
              if (args.select[key]) {
                if (key === '_count') {
                  selected._count = u._count || { accounts: 0, creditCards: 0, passkeys: 0 };
                } else {
                  selected[key] = (u as any)[key];
                }
              }
            });
            return selected;
          });
        }
        return result;
      }),

      findUnique: jest.fn().mockImplementation(async (args: any) => {
        const { where } = args;
        return users.find((u) => {
          if (where.id && u.id !== where.id) return false;
          if (where.email && u.email !== where.email) return false;
          return true;
        }) || null;
      }),
    },

    creditCardTypeConfig: {
      findMany: jest.fn().mockImplementation(async (args?: any) => {
        let result = [...creditCardTypes];
        if (args?.orderBy?.sortOrder === 'asc') {
          result.sort((a, b) => a.sortOrder - b.sortOrder);
        }
        return result;
      }),

      findUnique: jest.fn().mockImplementation(async (args: any) => {
        const { where } = args;
        return creditCardTypes.find((ct) => {
          if (where.id && ct.id !== where.id) return false;
          if (where.code && ct.code !== where.code) return false;
          return true;
        }) || null;
      }),

      create: jest.fn().mockImplementation(async (args: any) => {
        const { data } = args;
        // Check for duplicate code
        if (creditCardTypes.some((ct) => ct.code === data.code)) {
          const error: any = new Error('Unique constraint failed');
          error.code = 'P2002';
          throw error;
        }
        const newType: MockCreditCardTypeData = {
          id: `cctype-${Date.now()}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        creditCardTypes.push(newType);
        return newType;
      }),

      update: jest.fn().mockImplementation(async (args: any) => {
        const { where, data } = args;
        const index = creditCardTypes.findIndex((ct) => ct.id === where.id);
        if (index < 0) throw new Error('Not found');
        creditCardTypes[index] = { ...creditCardTypes[index], ...data, updatedAt: new Date() };
        return creditCardTypes[index];
      }),

      delete: jest.fn().mockImplementation(async (args: any) => {
        const { where } = args;
        const index = creditCardTypes.findIndex((ct) => ct.id === where.id);
        if (index < 0) throw new Error('Not found');
        const deleted = creditCardTypes.splice(index, 1)[0];
        return deleted;
      }),
    },

    accountTypeConfig: {
      findMany: jest.fn().mockImplementation(async (args?: any) => {
        let result = [...accountTypes];
        if (args?.orderBy?.sortOrder === 'asc') {
          result.sort((a, b) => a.sortOrder - b.sortOrder);
        }
        return result;
      }),

      findUnique: jest.fn().mockImplementation(async (args: any) => {
        const { where } = args;
        return accountTypes.find((at) => {
          if (where.id && at.id !== where.id) return false;
          if (where.code && at.code !== where.code) return false;
          return true;
        }) || null;
      }),

      create: jest.fn().mockImplementation(async (args: any) => {
        const { data } = args;
        // Check for duplicate code
        if (accountTypes.some((at) => at.code === data.code)) {
          const error: any = new Error('Unique constraint failed');
          error.code = 'P2002';
          throw error;
        }
        const newType: MockAccountTypeData = {
          id: `accttype-${Date.now()}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        accountTypes.push(newType);
        return newType;
      }),

      update: jest.fn().mockImplementation(async (args: any) => {
        const { where, data } = args;
        const index = accountTypes.findIndex((at) => at.id === where.id);
        if (index < 0) throw new Error('Not found');
        accountTypes[index] = { ...accountTypes[index], ...data, updatedAt: new Date() };
        return accountTypes[index];
      }),

      delete: jest.fn().mockImplementation(async (args: any) => {
        const { where } = args;
        const index = accountTypes.findIndex((at) => at.id === where.id);
        if (index < 0) throw new Error('Not found');
        const deleted = accountTypes.splice(index, 1)[0];
        return deleted;
      }),
    },

    webAuthnRelatedOrigin: {
      findMany: jest.fn().mockImplementation(async (args?: any) => {
        let result = [...webAuthnRelatedOrigins];
        if (args?.orderBy?.sortOrder === 'asc') {
          result.sort((a, b) => a.sortOrder - b.sortOrder);
        }
        if (args?.where?.isActive !== undefined) {
          result = result.filter((o) => o.isActive === args.where.isActive);
        }
        if (args?.select) {
          return result.map((o) => {
            const selected: any = {};
            Object.keys(args.select).forEach((key: string) => {
              if (args.select[key]) selected[key] = (o as any)[key];
            });
            return selected;
          });
        }
        return result;
      }),

      findUnique: jest.fn().mockImplementation(async (args: any) => {
        const { where } = args;
        return webAuthnRelatedOrigins.find((o) => {
          if (where.id && o.id !== where.id) return false;
          if (where.origin && o.origin !== where.origin) return false;
          return true;
        }) || null;
      }),

      findFirst: jest.fn().mockImplementation(async (args: any) => {
        const { where } = args;
        return webAuthnRelatedOrigins.find((o) => {
          if (where.origin && o.origin !== where.origin) return false;
          if (where.NOT?.id && o.id === where.NOT.id) return false;
          return true;
        }) || null;
      }),

      create: jest.fn().mockImplementation(async (args: any) => {
        const { data } = args;
        // Check for duplicate origin
        if (webAuthnRelatedOrigins.some((o) => o.origin === data.origin)) {
          const error: any = new Error('Unique constraint failed');
          error.code = 'P2002';
          throw error;
        }
        const newOrigin: MockWebAuthnRelatedOriginData = {
          id: `origin-${Date.now()}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        webAuthnRelatedOrigins.push(newOrigin);
        return newOrigin;
      }),

      update: jest.fn().mockImplementation(async (args: any) => {
        const { where, data } = args;
        const index = webAuthnRelatedOrigins.findIndex((o) => o.id === where.id);
        if (index < 0) throw new Error('Not found');
        webAuthnRelatedOrigins[index] = { ...webAuthnRelatedOrigins[index], ...data, updatedAt: new Date() };
        return webAuthnRelatedOrigins[index];
      }),

      delete: jest.fn().mockImplementation(async (args: any) => {
        const { where } = args;
        const index = webAuthnRelatedOrigins.findIndex((o) => o.id === where.id);
        if (index < 0) throw new Error('Not found');
        const deleted = webAuthnRelatedOrigins.splice(index, 1)[0];
        return deleted;
      }),
    },

    // Helper methods for test setup
    _addAdminUser: (admin: MockAdminUserData) => {
      adminUsers.push(admin);
    },
    _addAdminPasskey: (passkey: MockAdminPasskeyData) => {
      adminPasskeys.push(passkey);
    },
    _addUser: (user: MockUserData) => {
      users.push(user);
    },
    _addCreditCardType: (type: MockCreditCardTypeData) => {
      creditCardTypes.push(type);
    },
    _addAccountType: (type: MockAccountTypeData) => {
      accountTypes.push(type);
    },
    _addWebAuthnRelatedOrigin: (origin: MockWebAuthnRelatedOriginData) => {
      webAuthnRelatedOrigins.push(origin);
    },
    _clear: () => {
      adminUsers.length = 0;
      adminPasskeys.length = 0;
      users.length = 0;
      creditCardTypes.length = 0;
      accountTypes.length = 0;
      webAuthnRelatedOrigins.length = 0;
    },
    _getAdminUsers: () => adminUsers,
    _getAdminPasskeys: () => adminPasskeys,
    _getUsers: () => users,
    _getCreditCardTypes: () => creditCardTypes,
    _getAccountTypes: () => accountTypes,
    _getWebAuthnRelatedOrigins: () => webAuthnRelatedOrigins,
  };

  return mockPrisma;
}

export type MockPrismaClient = ReturnType<typeof createMockPrismaClient>;
