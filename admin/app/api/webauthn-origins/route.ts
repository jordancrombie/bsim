import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentAdmin } from '@/lib/auth';

// GET /api/webauthn-origins - List all WebAuthn related origins
export async function GET() {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const origins = await prisma.webAuthnRelatedOrigin.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json({ origins });
  } catch (error) {
    console.error('Failed to fetch WebAuthn origins:', error);
    return NextResponse.json(
      { error: 'Failed to fetch WebAuthn origins' },
      { status: 500 }
    );
  }
}

// POST /api/webauthn-origins - Create a new WebAuthn related origin
export async function POST(request: Request) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { origin, description, isActive, sortOrder } = body;

    // Validate required fields
    if (!origin) {
      return NextResponse.json(
        { error: 'Origin is required' },
        { status: 400 }
      );
    }

    // Validate origin is HTTPS URL
    if (!origin.startsWith('https://')) {
      return NextResponse.json(
        { error: 'Origin must be an HTTPS URL (e.g., https://example.com)' },
        { status: 400 }
      );
    }

    // Validate origin format (no path, no trailing slash)
    try {
      const url = new URL(origin);
      if (url.pathname !== '/' || url.search || url.hash) {
        return NextResponse.json(
          { error: 'Origin must be a valid origin (no path, query, or hash allowed)' },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Normalize origin (remove trailing slash if present)
    const normalizedOrigin = origin.replace(/\/$/, '');

    // Check if origin already exists
    const existing = await prisma.webAuthnRelatedOrigin.findUnique({
      where: { origin: normalizedOrigin },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'This origin already exists' },
        { status: 400 }
      );
    }

    const newOrigin = await prisma.webAuthnRelatedOrigin.create({
      data: {
        origin: normalizedOrigin,
        description: description || null,
        isActive: isActive !== false,
        sortOrder: sortOrder || 0,
      },
    });

    return NextResponse.json({ origin: newOrigin }, { status: 201 });
  } catch (error) {
    console.error('Failed to create WebAuthn origin:', error);
    return NextResponse.json(
      { error: 'Failed to create WebAuthn origin' },
      { status: 500 }
    );
  }
}
