import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { uploadFile, deleteFile, getStorageType } from '@/lib/storage';
import path from 'path';

export const dynamic = 'force-dynamic';

// POST /api/settings/logo - Upload a new logo
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('logo') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File must be less than 5MB' }, { status: 400 });
    }

    // Get current settings to delete old logo if exists
    const currentSettings = await prisma.siteSettings.findUnique({
      where: { id: 'default' },
    });

    // Delete old logo if it exists
    if (currentSettings?.logoUrl) {
      try {
        await deleteFile(currentSettings.logoUrl);
      } catch (err) {
        console.error('Failed to delete old logo:', err);
        // Continue anyway - don't fail the upload
      }
    }

    // Generate unique filename
    const ext = path.extname(file.name) || '.png';
    const filename = `logo-${Date.now()}${ext}`;

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload file (to S3 or local storage)
    const { url: logoUrl } = await uploadFile(buffer, filename, file.type);

    // Update database with new logo URL
    await prisma.siteSettings.upsert({
      where: { id: 'default' },
      update: { logoUrl },
      create: {
        id: 'default',
        siteName: 'BSIM',
        logoUrl,
      },
    });

    const storageType = getStorageType();
    console.log(`Logo uploaded successfully to ${storageType}: ${logoUrl}`);

    return NextResponse.json({ logoUrl, storageType });
  } catch (error) {
    console.error('Failed to upload logo:', error);
    return NextResponse.json(
      { error: 'Failed to upload logo' },
      { status: 500 }
    );
  }
}

// DELETE /api/settings/logo - Remove the logo
export async function DELETE() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current logo
    const settings = await prisma.siteSettings.findUnique({
      where: { id: 'default' },
    });

    if (settings?.logoUrl) {
      try {
        await deleteFile(settings.logoUrl);
      } catch (err) {
        console.error('Failed to delete logo file:', err);
        // Continue anyway - database should still be updated
      }
    }

    // Update database to remove logo
    await prisma.siteSettings.update({
      where: { id: 'default' },
      data: { logoUrl: null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to remove logo:', error);
    return NextResponse.json(
      { error: 'Failed to remove logo' },
      { status: 500 }
    );
  }
}
