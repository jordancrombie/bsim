import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

// Directory where logos are stored
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/app/uploads';

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

    // Ensure upload directory exists
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }

    // Generate unique filename
    const ext = path.extname(file.name) || '.png';
    const filename = `logo-${Date.now()}${ext}`;
    const filepath = path.join(UPLOAD_DIR, filename);

    // Convert file to buffer and save
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filepath, buffer);

    // Update database with new logo URL
    // The logo is served via the backend API
    const logoUrl = `/uploads/${filename}`;

    await prisma.siteSettings.upsert({
      where: { id: 'default' },
      update: { logoUrl },
      create: {
        id: 'default',
        siteName: 'BSIM',
        logoUrl,
      },
    });

    return NextResponse.json({ logoUrl });
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

    if (settings?.logoUrl && settings.logoUrl.startsWith('/uploads/')) {
      // Delete the file
      const filename = settings.logoUrl.replace('/uploads/', '');
      const filepath = path.join(UPLOAD_DIR, filename);

      try {
        if (existsSync(filepath)) {
          await unlink(filepath);
        }
      } catch (err) {
        console.error('Failed to delete logo file:', err);
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
