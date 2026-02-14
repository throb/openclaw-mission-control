import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/crypto';

/**
 * First-time setup endpoint.
 * Only works if no users exist in the database.
 */
export async function POST(request: Request) {
  try {
    // Check if any users exist
    const userCount = await prisma.user.count();
    
    if (userCount > 0) {
      return NextResponse.json(
        { error: 'Setup already completed. Users exist.' },
        { status: 403 }
      );
    }

    const { email, password } = await request.json();

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 12) {
      return NextResponse.json(
        { error: 'Password must be at least 12 characters' },
        { status: 400 }
      );
    }

    // Check if this is the expected admin email
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail && email !== adminEmail) {
      return NextResponse.json(
        { error: 'Email does not match expected admin email' },
        { status: 403 }
      );
    }

    // Create the admin user
    const passwordHash = await hashPassword(password);
    
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        totpVerified: false, // Will need to set up 2FA
      },
    });

    // Log the setup
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'auth.setup.complete',
        target: `user:${user.id}`,
        metadata: { email },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Admin user created. Please sign in and set up 2FA.',
    });
  } catch (error) {
    console.error('Setup error:', error);
    return NextResponse.json(
      { error: 'Setup failed' },
      { status: 500 }
    );
  }
}

/**
 * Check if setup is needed
 */
export async function GET() {
  try {
    const userCount = await prisma.user.count();
    return NextResponse.json({ 
      setupRequired: userCount === 0,
      adminEmail: process.env.ADMIN_EMAIL ? '***' : null,
    });
  } catch (error) {
    return NextResponse.json({ setupRequired: true });
  }
}
