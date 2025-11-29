import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import { cookies } from 'next/headers';
import { prisma } from './prisma';

const JWT_SECRET = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET || 'admin-secret-change-in-production'
);
const JWT_EXPIRES_IN = '7d';

export interface AdminSession {
  userId: string;
  email: string;
  role: string;
}

export async function createToken(session: AdminSession): Promise<string> {
  const payload: JWTPayload = {
    userId: session.userId,
    email: session.email,
    role: session.role,
  };
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRES_IN)
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<AdminSession | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as AdminSession;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_token')?.value;

  if (!token) {
    return null;
  }

  return verifyToken(token);
}

export async function getCurrentAdmin() {
  const session = await getSession();

  if (!session) {
    return null;
  }

  const admin = await prisma.adminUser.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      createdAt: true,
    },
  });

  return admin;
}

export async function requireAuth() {
  const admin = await getCurrentAdmin();

  if (!admin) {
    throw new Error('Unauthorized');
  }

  return admin;
}
