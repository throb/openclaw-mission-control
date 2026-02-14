import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authenticator } from 'otplib';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { code } = await request.json();

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    }

    // Get user's secret
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { totpSecret: true },
    });

    if (!user?.totpSecret) {
      return NextResponse.json(
        { error: 'No 2FA secret found. Please generate one first.' },
        { status: 400 }
      );
    }

    // Verify the code
    const isValid = authenticator.verify({
      token: code,
      secret: user.totpSecret,
    });

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
    }

    // Mark 2FA as verified
    await prisma.user.update({
      where: { id: session.user.id },
      data: { totpVerified: true },
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'auth.2fa.enabled',
        target: `user:${session.user.id}`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('2FA verification error:', error);
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    );
  }
}
