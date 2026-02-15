import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/crypto';

/**
 * GET /api/models
 * List all AI models. Never returns apiKeyEncrypted - returns hasApiKey boolean instead.
 */
export async function GET() {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const models = await prisma.aIModel.findMany({
      orderBy: [{ provider: 'asc' }, { displayName: 'asc' }],
    });

    // Strip encrypted API keys and add hasApiKey flag
    const safeModels = models.map(({ apiKeyEncrypted, ...model }) => ({
      ...model,
      hasApiKey: apiKeyEncrypted !== null && apiKeyEncrypted.length > 0,
    }));

    return NextResponse.json({ models: safeModels });
  } catch (error) {
    console.error('Failed to list models:', error);
    return NextResponse.json(
      { error: 'Failed to fetch models' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/models
 * Create a new AI model.
 * Body: { provider: string, modelId: string, displayName: string, apiKey?: string, isDefault?: boolean, config?: object }
 */
export async function POST(request: Request) {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { provider, modelId, displayName, apiKey, isDefault, config } = body;

    if (!provider || typeof provider !== 'string' || provider.trim().length === 0) {
      return NextResponse.json(
        { error: 'Provider is required' },
        { status: 400 }
      );
    }

    if (!modelId || typeof modelId !== 'string' || modelId.trim().length === 0) {
      return NextResponse.json(
        { error: 'Model ID is required' },
        { status: 400 }
      );
    }

    if (!displayName || typeof displayName !== 'string' || displayName.trim().length === 0) {
      return NextResponse.json(
        { error: 'Display name is required' },
        { status: 400 }
      );
    }

    // If isDefault is true, unset other defaults for the same provider
    if (isDefault) {
      await prisma.aIModel.updateMany({
        where: { provider: provider.trim().toLowerCase(), isDefault: true },
        data: { isDefault: false },
      });
    }

    // Encrypt API key if provided
    let apiKeyEncrypted: string | null = null;
    if (apiKey && typeof apiKey === 'string' && apiKey.trim().length > 0) {
      apiKeyEncrypted = encrypt(apiKey.trim());
    }

    const model = await prisma.aIModel.create({
      data: {
        provider: provider.trim().toLowerCase(),
        modelId: modelId.trim(),
        displayName: displayName.trim(),
        apiKeyEncrypted,
        isDefault: Boolean(isDefault),
        config: config || null,
      },
    });

    // Return safe model without encrypted key
    const { apiKeyEncrypted: _, ...safeModel } = model;

    return NextResponse.json(
      {
        model: {
          ...safeModel,
          hasApiKey: apiKeyEncrypted !== null,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error('Failed to create model:', error);

    // Handle unique constraint violation
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'A model with this provider and model ID already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create model' },
      { status: 500 }
    );
  }
}
