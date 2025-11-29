import { PrismaClient } from '@prisma/client';
import { Adapter, AdapterPayload } from 'oidc-provider';

// Types for oidc-provider models
type ModelName =
  | 'Session'
  | 'AccessToken'
  | 'AuthorizationCode'
  | 'RefreshToken'
  | 'DeviceCode'
  | 'ClientCredentials'
  | 'Client'
  | 'InitialAccessToken'
  | 'RegistrationAccessToken'
  | 'Interaction'
  | 'ReplayDetection'
  | 'PushedAuthorizationRequest'
  | 'Grant'
  | 'BackchannelAuthenticationRequest';

export class PrismaAdapter implements Adapter {
  private prisma: PrismaClient;
  private name: ModelName;

  constructor(name: string, prisma: PrismaClient) {
    this.name = name as ModelName;
    this.prisma = prisma;
  }

  async upsert(id: string, payload: AdapterPayload, expiresIn: number): Promise<void> {
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : undefined;

    await this.prisma.oidcPayload.upsert({
      where: { id: this.key(id) },
      update: {
        payload: payload as any,
        expiresAt,
        grantId: payload.grantId || null,
        userCode: payload.userCode || null,
        uid: payload.uid || null,
      },
      create: {
        id: this.key(id),
        type: this.name,
        payload: payload as any,
        expiresAt,
        grantId: payload.grantId || null,
        userCode: payload.userCode || null,
        uid: payload.uid || null,
      },
    });
  }

  async find(id: string): Promise<AdapterPayload | undefined> {
    const record = await this.prisma.oidcPayload.findUnique({
      where: { id: this.key(id) },
    });

    if (!record) return undefined;
    if (record.expiresAt && record.expiresAt < new Date()) return undefined;

    return record.payload as AdapterPayload;
  }

  async findByUserCode(userCode: string): Promise<AdapterPayload | undefined> {
    const record = await this.prisma.oidcPayload.findFirst({
      where: {
        userCode,
        type: this.name,
      },
    });

    if (!record) return undefined;
    if (record.expiresAt && record.expiresAt < new Date()) return undefined;

    return record.payload as AdapterPayload;
  }

  async findByUid(uid: string): Promise<AdapterPayload | undefined> {
    const record = await this.prisma.oidcPayload.findFirst({
      where: {
        uid,
        type: this.name,
      },
    });

    if (!record) return undefined;
    if (record.expiresAt && record.expiresAt < new Date()) return undefined;

    return record.payload as AdapterPayload;
  }

  async consume(id: string): Promise<void> {
    await this.prisma.oidcPayload.update({
      where: { id: this.key(id) },
      data: { consumedAt: new Date() },
    });
  }

  async destroy(id: string): Promise<void> {
    await this.prisma.oidcPayload.delete({
      where: { id: this.key(id) },
    }).catch(() => {
      // Ignore if not found
    });
  }

  async revokeByGrantId(grantId: string): Promise<void> {
    await this.prisma.oidcPayload.deleteMany({
      where: { grantId },
    });
  }

  private key(id: string): string {
    return `${this.name}:${id}`;
  }
}

// Factory function for oidc-provider
export function createPrismaAdapterFactory(prisma: PrismaClient) {
  return (name: string) => new PrismaAdapter(name, prisma);
}
