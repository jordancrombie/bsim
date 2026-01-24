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

    // Log interaction/session creation for debugging
    if (this.name === 'Interaction' || this.name === 'Session') {
      console.log(`[PrismaAdapter] UPSERT ${this.name}:`, {
        id: id.substring(0, 20) + '...',
        uid: payload.uid?.substring(0, 20) || 'NONE',
        expiresIn,
        hasPrompt: !!(payload as any).prompt,
      });
    }

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

    if (this.name === 'Interaction' || this.name === 'Session') {
      console.log(`[PrismaAdapter] UPSERT ${this.name} COMPLETE:`, { id: id.substring(0, 20) + '...' });
    }
  }

  async find(id: string): Promise<AdapterPayload | undefined> {
    // Log interaction/session lookups for debugging
    if (this.name === 'Interaction' || this.name === 'Session') {
      console.log(`[PrismaAdapter] FIND ${this.name}:`, { id: id.substring(0, 20) + '...' });
    }

    const record = await this.prisma.oidcPayload.findUnique({
      where: { id: this.key(id) },
    });

    if (!record) {
      if (this.name === 'Interaction' || this.name === 'Session') {
        console.log(`[PrismaAdapter] FIND ${this.name} NOT FOUND:`, { id: id.substring(0, 20) + '...' });
      }
      return undefined;
    }
    if (record.expiresAt && record.expiresAt < new Date()) {
      if (this.name === 'Interaction' || this.name === 'Session') {
        console.log(`[PrismaAdapter] FIND ${this.name} EXPIRED:`, { id: id.substring(0, 20) + '...', expiresAt: record.expiresAt });
      }
      return undefined;
    }

    if (this.name === 'Interaction' || this.name === 'Session') {
      console.log(`[PrismaAdapter] FIND ${this.name} SUCCESS:`, { id: id.substring(0, 20) + '...' });
    }
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
    // Log interaction/session lookups for debugging
    if (this.name === 'Interaction' || this.name === 'Session') {
      console.log(`[PrismaAdapter] FIND BY UID ${this.name}:`, { uid: uid.substring(0, 20) + '...' });
    }

    const record = await this.prisma.oidcPayload.findFirst({
      where: {
        uid,
        type: this.name,
      },
    });

    if (!record) {
      if (this.name === 'Interaction' || this.name === 'Session') {
        console.log(`[PrismaAdapter] FIND BY UID ${this.name} NOT FOUND:`, { uid: uid.substring(0, 20) + '...' });
      }
      return undefined;
    }
    if (record.expiresAt && record.expiresAt < new Date()) {
      if (this.name === 'Interaction' || this.name === 'Session') {
        console.log(`[PrismaAdapter] FIND BY UID ${this.name} EXPIRED:`, { uid: uid.substring(0, 20) + '...', expiresAt: record.expiresAt });
      }
      return undefined;
    }

    if (this.name === 'Interaction' || this.name === 'Session') {
      console.log(`[PrismaAdapter] FIND BY UID ${this.name} SUCCESS:`, { uid: uid.substring(0, 20) + '...' });
    }
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
