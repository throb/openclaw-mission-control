import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { encrypt } from '@/lib/crypto';

/**
 * GET /api/discord-channels
 * List all configured Discord channels.
 */
export async function GET() {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const channels = await prisma.discordChannel.findMany({
      include: {
        _count: {
          select: { agents: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const safeChannels = channels.map(({ webhookUrl, ...channel }) => ({
      ...channel,
      hasWebhook: webhookUrl !== null && webhookUrl.length > 0,
    }));

    return NextResponse.json({ channels: safeChannels });
  } catch (error) {
    console.error('Failed to list Discord channels:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Discord channels' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/discord-channels
 * Create a new Discord channel mapping.
 * Body: { channelId: string, guildId: string, name: string, webhookUrl?: string }
 */
export async function POST(request: Request) {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { channelId, guildId, name, webhookUrl } = body;

    if (!channelId || !guildId || !name) {
      return NextResponse.json(
        { error: 'channelId, guildId, and name are required' },
        { status: 400 }
      );
    }

    const channel = await prisma.discordChannel.create({
      data: {
        channelId: channelId.trim(),
        guildId: guildId.trim(),
        name: name.trim(),
        webhookUrl: webhookUrl?.trim() ? encrypt(webhookUrl.trim()) : null,
      },
    });

    return NextResponse.json({ channel }, { status: 201 });
  } catch (error: unknown) {
    console.error('Failed to create Discord channel:', error);

    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'A channel with this Discord ID already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create Discord channel' },
      { status: 500 }
    );
  }
}
