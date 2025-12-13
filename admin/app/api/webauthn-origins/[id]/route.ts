import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentAdmin } from '@/lib/auth';

// GET /api/webauthn-origins/[id] - Get a single WebAuthn origin
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const origin = await prisma.webAuthnRelatedOrigin.findUnique({
      where: { id },
    });

    if (!origin) {
      return NextResponse.json(
        { error: 'WebAuthn origin not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ origin });
  } catch (error) {
    console.error('Failed to fetch WebAuthn origin:', error);
    return NextResponse.json(
      { error: 'Failed to fetch WebAuthn origin' },
      { status: 500 }
    );
  }
}

// PUT /api/webauthn-origins/[id] - Update a WebAuthn origin
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { origin, description, isActive, sortOrder } = body;

    // Check if WebAuthn origin exists
    const existing = await prisma.webAuthnRelatedOrigin.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'WebAuthn origin not found' },
        { status: 404 }
      );
    }

    // If origin is being updated, validate it
    let normalizedOrigin = existing.origin;
    if (origin !== undefined && origin !== existing.origin) {
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
      normalizedOrigin = origin.replace(/\/$/, '');

      // Check if new origin already exists (excluding current record)
      const duplicate = await prisma.webAuthnRelatedOrigin.findFirst({
        where: {
          origin: normalizedOrigin,
          NOT: { id },
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: 'This origin already exists' },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.webAuthnRelatedOrigin.update({
      where: { id },
      data: {
        origin: normalizedOrigin,
        description: description !== undefined ? description : existing.description,
        isActive: isActive !== undefined ? isActive : existing.isActive,
        sortOrder: sortOrder !== undefined ? sortOrder : existing.sortOrder,
      },
    });

    return NextResponse.json({ origin: updated });
  } catch (error) {
    console.error('Failed to update WebAuthn origin:', error);
    return NextResponse.json(
      { error: 'Failed to update WebAuthn origin' },
      { status: 500 }
    );
  }
}

// DELETE /api/webauthn-origins/[id] - Delete a WebAuthn origin
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Check if WebAuthn origin exists
    const existing = await prisma.webAuthnRelatedOrigin.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'WebAuthn origin not found' },
        { status: 404 }
      );
    }

    await prisma.webAuthnRelatedOrigin.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete WebAuthn origin:', error);
    return NextResponse.json(
      { error: 'Failed to delete WebAuthn origin' },
      { status: 500 }
    );
  }
}
