import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentAdmin } from '@/lib/auth';

// GET /api/account-types - List all account types
export async function GET() {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accountTypes = await prisma.accountTypeConfig.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json({ accountTypes });
  } catch (error) {
    console.error('Failed to fetch account types:', error);
    return NextResponse.json(
      { error: 'Failed to fetch account types' },
      { status: 500 }
    );
  }
}

// POST /api/account-types - Create a new account type
export async function POST(request: Request) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { code, name, description, isActive, sortOrder } = body;

    // Validate required fields
    if (!code || !name) {
      return NextResponse.json(
        { error: 'Code and name are required' },
        { status: 400 }
      );
    }

    // Check if code already exists
    const existing = await prisma.accountTypeConfig.findUnique({
      where: { code },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'An account type with this code already exists' },
        { status: 400 }
      );
    }

    const accountType = await prisma.accountTypeConfig.create({
      data: {
        code: code.toUpperCase(),
        name,
        description: description || null,
        isActive: isActive !== false,
        sortOrder: sortOrder || 0,
      },
    });

    return NextResponse.json({ accountType }, { status: 201 });
  } catch (error) {
    console.error('Failed to create account type:', error);
    return NextResponse.json(
      { error: 'Failed to create account type' },
      { status: 500 }
    );
  }
}
