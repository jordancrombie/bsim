import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { prisma } from './prisma';

// Configuration for admin interface
const RP_NAME = 'BSIM Admin';
const RP_ID = process.env.ADMIN_RP_ID || process.env.RP_ID || 'banksim.ca';
const ORIGIN = process.env.ADMIN_ORIGIN || 'https://admin.banksim.ca';

// Challenge store (in production, use Redis or database)
const challenges = new Map<string, string>();

export async function generateAdminRegistrationOptions(adminUserId: string) {
  const admin = await prisma.adminUser.findUnique({
    where: { id: adminUserId },
    include: {
      passkeys: {
        select: {
          credentialId: true,
          transports: true,
        },
      },
    },
  });

  if (!admin) {
    throw new Error('Admin user not found');
  }

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: adminUserId,
    userName: admin.email,
    userDisplayName: `${admin.firstName} ${admin.lastName}`,
    attestationType: 'none',
    excludeCredentials: admin.passkeys.map((passkey) => ({
      id: isoBase64URL.toBuffer(passkey.credentialId),
      type: 'public-key' as const,
      transports: passkey.transports as any[],
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
      authenticatorAttachment: 'platform',
    },
  });

  // Store challenge
  challenges.set(adminUserId, options.challenge);

  return options;
}

export async function verifyAdminRegistration(
  adminUserId: string,
  response: any
) {
  const challenge = challenges.get(adminUserId);
  if (!challenge) {
    throw new Error('Challenge not found or expired');
  }

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: [ORIGIN, 'https://localhost', `https://${RP_ID}`, 'https://admin-dev.banksim.ca'],
    expectedRPID: RP_ID,
  });

  if (!verification.verified || !verification.registrationInfo) {
    return { verified: false };
  }

  const { registrationInfo } = verification;

  // Store the passkey
  const passkey = await prisma.adminPasskey.create({
    data: {
      adminUserId,
      credentialId: isoBase64URL.fromBuffer(registrationInfo.credentialID),
      credentialPublicKey: Buffer.from(registrationInfo.credentialPublicKey),
      counter: BigInt(registrationInfo.counter),
      deviceType: registrationInfo.credentialDeviceType,
      backedUp: registrationInfo.credentialBackedUp,
      transports: response.response?.transports || [],
    },
  });

  // Clean up challenge
  challenges.delete(adminUserId);

  return { verified: true, passkey };
}

export async function generateAdminAuthenticationOptions(email?: string) {
  let allowCredentials: any[] = [];

  if (email) {
    const admin = await prisma.adminUser.findUnique({
      where: { email },
      include: {
        passkeys: {
          select: {
            credentialId: true,
            transports: true,
          },
        },
      },
    });

    if (admin) {
      allowCredentials = admin.passkeys.map((passkey) => ({
        id: isoBase64URL.toBuffer(passkey.credentialId),
        type: 'public-key' as const,
        transports: passkey.transports,
      }));
    }
  }

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
    userVerification: 'preferred',
  });

  // Store challenge
  const challengeKey = email || 'global';
  challenges.set(challengeKey, options.challenge);

  return options;
}

export async function verifyAdminAuthentication(
  response: any,
  email?: string
) {
  // Find the passkey
  const passkey = await prisma.adminPasskey.findUnique({
    where: { credentialId: response.id },
    include: { adminUser: true },
  });

  if (!passkey) {
    throw new Error('Passkey not found');
  }

  // Get challenge
  const challengeKey = email || 'global';
  const challenge = challenges.get(challengeKey);
  if (!challenge) {
    throw new Error('Challenge not found or expired');
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: [ORIGIN, 'https://localhost', `https://${RP_ID}`, 'https://admin-dev.banksim.ca'],
    expectedRPID: RP_ID,
    authenticator: {
      credentialID: isoBase64URL.toBuffer(passkey.credentialId),
      credentialPublicKey: new Uint8Array(passkey.credentialPublicKey),
      counter: Number(passkey.counter),
    },
  });

  if (!verification.verified) {
    return { verified: false };
  }

  // Update counter and last used
  await prisma.adminPasskey.update({
    where: { id: passkey.id },
    data: {
      counter: BigInt(verification.authenticationInfo.newCounter),
      lastUsedAt: new Date(),
    },
  });

  // Clean up challenge
  challenges.delete(challengeKey);

  return { verified: true, admin: passkey.adminUser };
}
