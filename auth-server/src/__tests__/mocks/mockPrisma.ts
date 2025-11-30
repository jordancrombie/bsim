// Mock PrismaClient for auth-server testing

export interface MockOidcPayloadData {
  id: string;
  type: string;
  payload: any;
  grantId: string | null;
  userCode: string | null;
  uid: string | null;
  expiresAt: Date | null;
  consumedAt: Date | null;
  createdAt: Date;
}

export interface MockOAuthClientData {
  id: string;
  clientId: string;
  clientSecret: string;
  clientName: string;
  redirectUris: string[];
  postLogoutRedirectUris: string[];
  grantTypes: string[];
  responseTypes: string[];
  scope: string;
  logoUri: string | null;
  policyUri: string | null;
  tosUri: string | null;
  contacts: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockUserData {
  id: string;
  fiUserRef: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  dateOfBirth: Date | null;
  accounts?: MockAccountData[];
}

export interface MockAccountData {
  id: string;
  accountNumber: string;
  balance: { toString: () => string };
}

export interface MockConsentData {
  id: string;
  grantId: string;
  userId: string;
  clientId: string;
  scopes: string[];
  accountIds: string[];
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

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
  transports: string[];
  createdAt: Date;
  lastUsedAt: Date | null;
  adminUser?: MockAdminUserData;
}

export function createMockPrismaClient() {
  // In-memory storage
  const oidcPayloads: MockOidcPayloadData[] = [];
  const oauthClients: MockOAuthClientData[] = [];
  const users: MockUserData[] = [];
  const consents: MockConsentData[] = [];
  const adminUsers: MockAdminUserData[] = [];
  const adminPasskeys: MockAdminPasskeyData[] = [];

  const mockPrisma = {
    oidcPayload: {
      upsert: jest.fn().mockImplementation(async (args: any) => {
        const { where, update, create } = args;
        const existingIndex = oidcPayloads.findIndex((p) => p.id === where.id);

        if (existingIndex >= 0) {
          oidcPayloads[existingIndex] = { ...oidcPayloads[existingIndex], ...update };
          return oidcPayloads[existingIndex];
        } else {
          const newPayload = { ...create, createdAt: new Date() };
          oidcPayloads.push(newPayload);
          return newPayload;
        }
      }),

      findUnique: jest.fn().mockImplementation(async (args: any) => {
        const { where } = args;
        return oidcPayloads.find((p) => p.id === where.id) || null;
      }),

      findFirst: jest.fn().mockImplementation(async (args: any) => {
        const { where } = args;
        return oidcPayloads.find((p) => {
          if (where.userCode && p.userCode !== where.userCode) return false;
          if (where.uid && p.uid !== where.uid) return false;
          if (where.type && p.type !== where.type) return false;
          return true;
        }) || null;
      }),

      update: jest.fn().mockImplementation(async (args: any) => {
        const { where, data } = args;
        const index = oidcPayloads.findIndex((p) => p.id === where.id);
        if (index < 0) throw new Error('Not found');
        oidcPayloads[index] = { ...oidcPayloads[index], ...data };
        return oidcPayloads[index];
      }),

      delete: jest.fn().mockImplementation(async (args: any) => {
        const { where } = args;
        const index = oidcPayloads.findIndex((p) => p.id === where.id);
        if (index < 0) throw new Error('Not found');
        const deleted = oidcPayloads.splice(index, 1)[0];
        return deleted;
      }),

      deleteMany: jest.fn().mockImplementation(async (args: any) => {
        const { where } = args;
        const initialCount = oidcPayloads.length;
        const toDelete = oidcPayloads.filter((p) => p.grantId === where.grantId);
        toDelete.forEach((p) => {
          const idx = oidcPayloads.indexOf(p);
          if (idx >= 0) oidcPayloads.splice(idx, 1);
        });
        return { count: initialCount - oidcPayloads.length };
      }),

      count: jest.fn().mockImplementation(async (args?: any) => {
        if (!args?.where) return oidcPayloads.length;

        const { where } = args;
        return oidcPayloads.filter((p) => {
          if (where.grantId && p.grantId !== where.grantId) return false;
          if (where.expiresAt?.gt && p.expiresAt) {
            if (new Date(p.expiresAt) <= where.expiresAt.gt) return false;
          }
          return true;
        }).length;
      }),
    },

    oAuthClient: {
      findMany: jest.fn().mockImplementation(async (args?: any) => {
        let result = [...oauthClients];
        if (args?.orderBy?.createdAt === 'desc') {
          result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        if (args?.select) {
          return result.map((c) => {
            const selected: any = {};
            Object.keys(args.select).forEach((key) => {
              if (args.select[key]) selected[key] = (c as any)[key];
            });
            return selected;
          });
        }
        return result;
      }),

      findUnique: jest.fn().mockImplementation(async (args: any) => {
        const { where } = args;
        let client = oauthClients.find((c) => {
          if (where.id && c.id !== where.id) return false;
          if (where.clientId) {
            if (typeof where.clientId === 'string') {
              if (c.clientId !== where.clientId) return false;
            } else if (where.clientId && where.isActive !== undefined) {
              // Handle composite where
              if (c.clientId !== where.clientId || c.isActive !== where.isActive) return false;
            }
          }
          if (where.isActive !== undefined && c.isActive !== where.isActive) return false;
          return true;
        });
        return client || null;
      }),

      create: jest.fn().mockImplementation(async (args: any) => {
        const { data } = args;
        // Check for duplicate clientId
        if (oauthClients.some((c) => c.clientId === data.clientId)) {
          const error: any = new Error('Unique constraint failed');
          error.code = 'P2002';
          throw error;
        }
        const newClient: MockOAuthClientData = {
          id: `client-${Date.now()}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        oauthClients.push(newClient);
        return newClient;
      }),

      update: jest.fn().mockImplementation(async (args: any) => {
        const { where, data } = args;
        const index = oauthClients.findIndex((c) => c.id === where.id);
        if (index < 0) throw new Error('Not found');
        oauthClients[index] = { ...oauthClients[index], ...data, updatedAt: new Date() };
        return oauthClients[index];
      }),

      delete: jest.fn().mockImplementation(async (args: any) => {
        const { where } = args;
        const index = oauthClients.findIndex((c) => c.id === where.id);
        if (index < 0) throw new Error('Not found');
        const deleted = oauthClients.splice(index, 1)[0];
        return deleted;
      }),
    },

    user: {
      findUnique: jest.fn().mockImplementation(async (args: any) => {
        const { where, include, select } = args;
        let user = users.find((u) => {
          if (where.id && u.id !== where.id) return false;
          if (where.email && u.email !== where.email) return false;
          if (where.fiUserRef && u.fiUserRef !== where.fiUserRef) return false;
          return true;
        });

        if (!user) return null;

        // Handle include for accounts
        if (include?.accounts) {
          return { ...user };
        }

        // Handle select
        if (select) {
          const result: any = {};
          Object.keys(select).forEach((key) => {
            if (select[key]) result[key] = (user as any)[key];
          });
          return result;
        }

        return user;
      }),
    },

    consent: {
      create: jest.fn().mockImplementation(async (args: any) => {
        const { data } = args;
        const newConsent: MockConsentData = {
          id: `consent-${Date.now()}`,
          ...data,
          revokedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        consents.push(newConsent);
        return newConsent;
      }),

      findMany: jest.fn().mockImplementation(async (args?: any) => {
        let result = [...consents];

        // Filter by where clause
        if (args?.where) {
          result = result.filter((c) => {
            if (args.where.revokedAt === null && c.revokedAt !== null) return false;
            if (args.where.userId && c.userId !== args.where.userId) return false;
            return true;
          });
        }

        // Sort by createdAt desc
        if (args?.orderBy?.createdAt === 'desc') {
          result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }

        // Handle include for user and client
        if (args?.include) {
          result = result.map((consent) => {
            const enriched: any = { ...consent };
            if (args.include.user) {
              const user = users.find((u) => u.id === consent.userId);
              if (args.include.user.select && user) {
                const selected: any = {};
                Object.keys(args.include.user.select).forEach((key) => {
                  if (args.include.user.select[key]) selected[key] = (user as any)[key];
                });
                enriched.user = selected;
              } else {
                enriched.user = user;
              }
            }
            if (args.include.client) {
              const client = oauthClients.find((cl) => cl.clientId === consent.clientId);
              if (args.include.client.select && client) {
                const selected: any = {};
                Object.keys(args.include.client.select).forEach((key) => {
                  if (args.include.client.select[key]) selected[key] = (client as any)[key];
                });
                enriched.client = selected;
              } else {
                enriched.client = client;
              }
            }
            return enriched;
          });
        }

        return result;
      }),

      findUnique: jest.fn().mockImplementation(async (args: any) => {
        const { where, include } = args;
        let consent = consents.find((c) => c.id === where.id);

        if (!consent) return null;

        // Handle include
        if (include) {
          const enriched: any = { ...consent };
          if (include.user) {
            const user = users.find((u) => u.id === consent!.userId);
            if (include.user.select && user) {
              const selected: any = {};
              Object.keys(include.user.select).forEach((key) => {
                if (include.user.select[key]) selected[key] = (user as any)[key];
              });
              enriched.user = selected;
            } else {
              enriched.user = user;
            }
          }
          if (include.client) {
            const client = oauthClients.find((cl) => cl.clientId === consent!.clientId);
            if (include.client.select && client) {
              const selected: any = {};
              Object.keys(include.client.select).forEach((key) => {
                if (include.client.select[key]) selected[key] = (client as any)[key];
              });
              enriched.client = selected;
            } else {
              enriched.client = client;
            }
          }
          return enriched;
        }

        return consent;
      }),

      update: jest.fn().mockImplementation(async (args: any) => {
        const { where, data } = args;
        const index = consents.findIndex((c) => c.id === where.id);
        if (index < 0) throw new Error('Not found');
        consents[index] = { ...consents[index], ...data, updatedAt: new Date() };
        return consents[index];
      }),

      updateMany: jest.fn().mockImplementation(async (args: any) => {
        const { where, data } = args;
        let count = 0;
        consents.forEach((consent, index) => {
          let matches = true;
          if (where.userId && consent.userId !== where.userId) matches = false;
          if (where.revokedAt === null && consent.revokedAt !== null) matches = false;
          if (matches) {
            consents[index] = { ...consent, ...data, updatedAt: new Date() };
            count++;
          }
        });
        return { count };
      }),
    },

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
          const userPasskeys = adminPasskeys.filter((p) => p.adminUserId === admin!.id);
          if (include.passkeys.select) {
            const selectedPasskeys = userPasskeys.map((p) => {
              const selected: any = {};
              Object.keys(include.passkeys.select).forEach((key) => {
                if (include.passkeys.select[key]) selected[key] = (p as any)[key];
              });
              return selected;
            });
            return { ...admin, passkeys: selectedPasskeys };
          }
          return { ...admin, passkeys: userPasskeys };
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

      update: jest.fn().mockImplementation(async (args: any) => {
        const { where, data } = args;
        const index = adminPasskeys.findIndex((p) => p.id === where.id);
        if (index < 0) throw new Error('Not found');
        adminPasskeys[index] = { ...adminPasskeys[index], ...data };
        return adminPasskeys[index];
      }),
    },

    // Helper methods for test setup
    _addOidcPayload: (payload: MockOidcPayloadData) => {
      oidcPayloads.push(payload);
    },
    _addOAuthClient: (client: MockOAuthClientData) => {
      oauthClients.push(client);
    },
    _addUser: (user: MockUserData) => {
      users.push(user);
    },
    _addConsent: (consent: MockConsentData) => {
      consents.push(consent);
    },
    _addAdminUser: (admin: MockAdminUserData) => {
      adminUsers.push(admin);
    },
    _addAdminPasskey: (passkey: MockAdminPasskeyData) => {
      adminPasskeys.push(passkey);
    },
    _clear: () => {
      oidcPayloads.length = 0;
      oauthClients.length = 0;
      users.length = 0;
      consents.length = 0;
      adminUsers.length = 0;
      adminPasskeys.length = 0;
    },
    _getOidcPayloads: () => oidcPayloads,
    _getOAuthClients: () => oauthClients,
    _getConsents: () => consents,
    _getAdminUsers: () => adminUsers,
    _getAdminPasskeys: () => adminPasskeys,
  };

  return mockPrisma;
}

export type MockPrismaClient = ReturnType<typeof createMockPrismaClient>;
