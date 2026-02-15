import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { encrypt } from '@/lib/crypto';

interface RouteParams {
  params: { id: string };
}

/**
 * PATCH /api/discord-channels/[id]
 * Update a Discord channel.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existing = await prisma.discordChannel.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Discord channel not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { name, webhookUrl } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (webhookUrl !== undefined) updateData.webhookUrl = webhookUrl?.trim() ? encrypt(webhookUrl.trim()) : null;

    const channel = await prisma.discordChannel.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json({ channel });
  } catch (error) {
    console.error('Failed to update Discord channel:', error);
    return NextResponse.json(
      { error: 'Failed to update Discord channel' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/discord-channels/[id]
 * Delete a Discord channel mapping.
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existing = await prisma.discordChannel.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Discord channel not found' },
        { status: 404 }
      );
    }

    // Nullify agent references first
    await prisma.agent.updateMany({
      where: { discordChannelId: params.id },
      data: { discordChannelId: null },
    });

    await prisma.discordChannel.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete Discord channel:', error);
    return NextResponse.json(
      { error: 'Failed to delete Discord channel' },
      { status: 500 }
    );
  }
}
