import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/settings - Get site settings (public)
export async function GET() {
  try {
    let settings = await prisma.siteSettings.findUnique({
      where: { id: 'default' },
    });

    // Create default settings if they don't exist
    if (!settings) {
      settings = await prisma.siteSettings.create({
        data: {
          id: 'default',
          siteName: 'BSIM',
          logoUrl: '/logo.png',
        },
      });
    }

    return NextResponse.json({
      logoUrl: settings.logoUrl,
      siteName: settings.siteName,
    });
  } catch (error) {
    console.error('Failed to fetch site settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch site settings' },
      { status: 500 }
    );
  }
}

// PUT /api/settings - Update site settings (requires auth)
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { siteName } = await request.json();

    const settings = await prisma.siteSettings.upsert({
      where: { id: 'default' },
      update: { siteName },
      create: {
        id: 'default',
        siteName: siteName || 'BSIM',
      },
    });

    return NextResponse.json({
      logoUrl: settings.logoUrl,
      siteName: settings.siteName,
    });
  } catch (error) {
    console.error('Failed to update site settings:', error);
    return NextResponse.json(
      { error: 'Failed to update site settings' },
      { status: 500 }
    );
  }
}
