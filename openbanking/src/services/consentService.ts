import { PrismaClient } from '@prisma/client';

export class ConsentService {
  constructor(private prisma: PrismaClient) {}

  // Get the account IDs that a user has consented to share with a specific client
  async getConsentedAccountIds(userId: string, clientId: string): Promise<string[]> {
    const consent = await this.prisma.consent.findFirst({
      where: {
        userId,
        clientId,
        revokedAt: null,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      select: {
        accountIds: true,
      },
    });

    return consent?.accountIds || [];
  }

  // Check if a specific account is consented
  async isAccountConsented(userId: string, clientId: string, accountId: string): Promise<boolean> {
    const consentedAccounts = await this.getConsentedAccountIds(userId, clientId);
    return consentedAccounts.includes(accountId);
  }

  // Get consent scopes
  async getConsentedScopes(userId: string, clientId: string): Promise<string[]> {
    const consent = await this.prisma.consent.findFirst({
      where: {
        userId,
        clientId,
        revokedAt: null,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      select: {
        scopes: true,
      },
    });

    return consent?.scopes || [];
  }
}
