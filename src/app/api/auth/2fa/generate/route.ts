import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Generate a new secret
    const secret = authenticator.generateSecret();

    // Store the secret (not verified yet)
    await prisma.user.update({
      where: { id: session.user.id },
      data: { 
        totpSecret: secret,
        totpVerified: false,
      },
    });

    // Generate QR code
    const otpauth = authenticator.keyuri(
      session.user.email,
      'BobBot Mission Control',
      secret
    );
    
    const qrCode = await QRCode.toDataURL(otpauth);

    return NextResponse.json({ 
      secret,
      qrCode,
    });
  } catch (error) {
    console.error('2FA generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate 2FA' },
      { status: 500 }
    );
  }
}
