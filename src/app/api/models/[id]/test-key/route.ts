import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/crypto';

interface RouteParams {
  params: { id: string };
}

/**
 * POST /api/models/[id]/test-key
 * Decrypt the API key and return a masked version (first 4 + *** + last 4 chars).
 * Logs this access to AuditLog with action 'model.apikey.view'.
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const model = await prisma.aIModel.findUnique({
      where: { id: params.id },
    });

    if (!model) {
      return NextResponse.json(
        { error: 'Model not found' },
        { status: 404 }
      );
    }

    if (!model.apiKeyEncrypted) {
      return NextResponse.json(
        { error: 'No API key configured for this model' },
        { status: 400 }
      );
    }

    // Decrypt the API key
    let decryptedKey: string;
    try {
      decryptedKey = decrypt(model.apiKeyEncrypted);
    } catch {
      return NextResponse.json(
        { error: 'Failed to decrypt API key. The encryption key may have changed.' },
        { status: 500 }
      );
    }

    // Mask the key: first 4 + *** + last 4
    let maskedKey: string;
    if (decryptedKey.length <= 8) {
      maskedKey = decryptedKey.substring(0, 2) + '***' + decryptedKey.substring(decryptedKey.length - 2);
    } else {
      maskedKey = decryptedKey.substring(0, 4) + '***' + decryptedKey.substring(decryptedKey.length - 4);
    }

    // Extract IP address from request headers
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ipAddress = forwardedFor?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || null;

    // Log this access to AuditLog
    await prisma.auditLog.create({
      data: {
        action: 'model.apikey.view',
        target: `model:${model.id}`,
        metadata: {
          provider: model.provider,
          modelId: model.modelId,
          displayName: model.displayName,
        },
        ipAddress,
      },
    });

    return NextResponse.json({
      maskedKey,
      provider: model.provider,
      modelId: model.modelId,
    });
  } catch (error) {
    console.error('Failed to reveal API key:', error);
    return NextResponse.json(
      { error: 'Failed to reveal API key' },
      { status: 500 }
    );
  }
}
