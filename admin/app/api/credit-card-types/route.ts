import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentAdmin } from '@/lib/auth';

// GET /api/credit-card-types - List all credit card types
export async function GET() {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const creditCardTypes = await prisma.creditCardTypeConfig.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json({ creditCardTypes });
  } catch (error) {
    console.error('Failed to fetch credit card types:', error);
    return NextResponse.json(
      { error: 'Failed to fetch credit card types' },
      { status: 500 }
    );
  }
}

// POST /api/credit-card-types - Create a new credit card type
export async function POST(request: Request) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { code, name, cardNumberPrefix, cardNumberLength, cvvLength, isDebit, isActive, sortOrder } = body;

    // Validate required fields
    if (!code || !name || !cardNumberPrefix) {
      return NextResponse.json(
        { error: 'Code, name, and card number prefix are required' },
        { status: 400 }
      );
    }

    // Check if code already exists
    const existing = await prisma.creditCardTypeConfig.findUnique({
      where: { code },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'A credit card type with this code already exists' },
        { status: 400 }
      );
    }

    const creditCardType = await prisma.creditCardTypeConfig.create({
      data: {
        code: code.toUpperCase(),
        name,
        cardNumberPrefix,
        cardNumberLength: cardNumberLength || 16,
        cvvLength: cvvLength || 3,
        isDebit: isDebit || false,
        isActive: isActive !== false,
        sortOrder: sortOrder || 0,
      },
    });

    return NextResponse.json({ creditCardType }, { status: 201 });
  } catch (error) {
    console.error('Failed to create credit card type:', error);
    return NextResponse.json(
      { error: 'Failed to create credit card type' },
      { status: 500 }
    );
  }
}
