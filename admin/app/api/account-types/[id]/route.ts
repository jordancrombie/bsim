import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentAdmin } from '@/lib/auth';

// GET /api/account-types/[id] - Get a single account type
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
    const accountType = await prisma.accountTypeConfig.findUnique({
      where: { id },
    });

    if (!accountType) {
      return NextResponse.json(
        { error: 'Account type not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ accountType });
  } catch (error) {
    console.error('Failed to fetch account type:', error);
    return NextResponse.json(
      { error: 'Failed to fetch account type' },
      { status: 500 }
    );
  }
}

// PUT /api/account-types/[id] - Update an account type
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
    const { name, description, isActive, sortOrder } = body;

    // Check if account type exists
    const existing = await prisma.accountTypeConfig.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Account type not found' },
        { status: 404 }
      );
    }

    const accountType = await prisma.accountTypeConfig.update({
      where: { id },
      data: {
        name: name !== undefined ? name : existing.name,
        description: description !== undefined ? description : existing.description,
        isActive: isActive !== undefined ? isActive : existing.isActive,
        sortOrder: sortOrder !== undefined ? sortOrder : existing.sortOrder,
      },
    });

    return NextResponse.json({ accountType });
  } catch (error) {
    console.error('Failed to update account type:', error);
    return NextResponse.json(
      { error: 'Failed to update account type' },
      { status: 500 }
    );
  }
}

// DELETE /api/account-types/[id] - Delete an account type
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

    // Check if account type exists
    const existing = await prisma.accountTypeConfig.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Account type not found' },
        { status: 404 }
      );
    }

    await prisma.accountTypeConfig.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete account type:', error);
    return NextResponse.json(
      { error: 'Failed to delete account type' },
      { status: 500 }
    );
  }
}
