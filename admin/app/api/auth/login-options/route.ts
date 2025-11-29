import { NextRequest, NextResponse } from 'next/server';
import { generateAdminAuthenticationOptions } from '@/lib/passkey';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    const options = await generateAdminAuthenticationOptions(email);

    return NextResponse.json({ options });
  } catch (error) {
    console.error('Failed to generate login options:', error);
    return NextResponse.json(
      { error: 'Failed to generate login options' },
      { status: 500 }
    );
  }
}
