import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/crypto';

interface RouteParams {
  params: { id: string };
}

/**
 * GET /api/models/[id]
 * Get a single model. Never returns the encrypted API key.
 */
export async function GET(request: Request, { params }: RouteParams) {
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

    const { apiKeyEncrypted, ...safeModel } = model;

    return NextResponse.json({
      model: {
        ...safeModel,
        hasApiKey: apiKeyEncrypted !== null && apiKeyEncrypted.length > 0,
      },
    });
  } catch (error) {
    console.error('Failed to fetch model:', error);
    return NextResponse.json(
      { error: 'Failed to fetch model' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/models/[id]
 * Update a model's fields.
 * Body: { provider?, modelId?, displayName?, apiKey?, isDefault?, config? }
 * - If apiKey is a non-empty string, encrypt and store it
 * - If apiKey is an empty string "", remove the stored key
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existing = await prisma.aIModel.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Model not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { provider, modelId, displayName, apiKey, isDefault, config } = body;

    // Validate provider if provided
    if (provider !== undefined) {
      if (typeof provider !== 'string' || provider.trim().length === 0) {
        return NextResponse.json(
          { error: 'Provider cannot be empty' },
          { status: 400 }
        );
      }
    }

    // Validate modelId if provided
    if (modelId !== undefined) {
      if (typeof modelId !== 'string' || modelId.trim().length === 0) {
        return NextResponse.json(
          { error: 'Model ID cannot be empty' },
          { status: 400 }
        );
      }
    }

    // Validate displayName if provided
    if (displayName !== undefined) {
      if (typeof displayName !== 'string' || displayName.trim().length === 0) {
        return NextResponse.json(
          { error: 'Display name cannot be empty' },
          { status: 400 }
        );
      }
    }

    // If isDefault is being set to true, unset other defaults for the same provider
    const targetProvider = provider?.trim().toLowerCase() || existing.provider;
    if (isDefault === true) {
      await prisma.aIModel.updateMany({
        where: {
          provider: targetProvider,
          isDefault: true,
          NOT: { id: params.id },
        },
        data: { isDefault: false },
      });
    }

    const updateData: Record<string, unknown> = {};
    if (provider !== undefined) updateData.provider = provider.trim().toLowerCase();
    if (modelId !== undefined) updateData.modelId = modelId.trim();
    if (displayName !== undefined) updateData.displayName = displayName.trim();
    if (isDefault !== undefined) updateData.isDefault = Boolean(isDefault);
    if (config !== undefined) updateData.config = config;

    // Handle API key: non-empty string = encrypt & store, empty string = remove
    if (apiKey !== undefined) {
      if (typeof apiKey === 'string' && apiKey.trim().length > 0) {
        updateData.apiKeyEncrypted = encrypt(apiKey.trim());
      } else {
        updateData.apiKeyEncrypted = null;
      }
    }

    const model = await prisma.aIModel.update({
      where: { id: params.id },
      data: updateData,
    });

    const { apiKeyEncrypted, ...safeModel } = model;

    return NextResponse.json({
      model: {
        ...safeModel,
        hasApiKey: apiKeyEncrypted !== null && apiKeyEncrypted.length > 0,
      },
    });
  } catch (error: unknown) {
    console.error('Failed to update model:', error);

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
      { error: 'Failed to update model' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/models/[id]
 * Delete an AI model.
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existing = await prisma.aIModel.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Model not found' },
        { status: 404 }
      );
    }

    await prisma.aIModel.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete model:', error);
    return NextResponse.json(
      { error: 'Failed to delete model' },
      { status: 500 }
    );
  }
}
