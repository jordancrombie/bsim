import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentAdmin } from '@/lib/auth';

// GET /api/credit-card-types/[id] - Get a single credit card type
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
    const creditCardType = await prisma.creditCardTypeConfig.findUnique({
      where: { id },
    });

    if (!creditCardType) {
      return NextResponse.json(
        { error: 'Credit card type not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ creditCardType });
  } catch (error) {
    console.error('Failed to fetch credit card type:', error);
    return NextResponse.json(
      { error: 'Failed to fetch credit card type' },
      { status: 500 }
    );
  }
}

// PUT /api/credit-card-types/[id] - Update a credit card type
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
    const { name, cardNumberPrefix, cardNumberLength, cvvLength, isDebit, isActive, sortOrder } = body;

    // Check if credit card type exists
    const existing = await prisma.creditCardTypeConfig.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Credit card type not found' },
        { status: 404 }
      );
    }

    const creditCardType = await prisma.creditCardTypeConfig.update({
      where: { id },
      data: {
        name: name !== undefined ? name : existing.name,
        cardNumberPrefix: cardNumberPrefix !== undefined ? cardNumberPrefix : existing.cardNumberPrefix,
        cardNumberLength: cardNumberLength !== undefined ? cardNumberLength : existing.cardNumberLength,
        cvvLength: cvvLength !== undefined ? cvvLength : existing.cvvLength,
        isDebit: isDebit !== undefined ? isDebit : existing.isDebit,
        isActive: isActive !== undefined ? isActive : existing.isActive,
        sortOrder: sortOrder !== undefined ? sortOrder : existing.sortOrder,
      },
    });

    return NextResponse.json({ creditCardType });
  } catch (error) {
    console.error('Failed to update credit card type:', error);
    return NextResponse.json(
      { error: 'Failed to update credit card type' },
      { status: 500 }
    );
  }
}

// DELETE /api/credit-card-types/[id] - Delete a credit card type
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

    // Check if credit card type exists
    const existing = await prisma.creditCardTypeConfig.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Credit card type not found' },
        { status: 404 }
      );
    }

    await prisma.creditCardTypeConfig.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete credit card type:', error);
    return NextResponse.json(
      { error: 'Failed to delete credit card type' },
      { status: 500 }
    );
  }
}
