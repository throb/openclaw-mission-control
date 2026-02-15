import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';

interface RouteParams {
  params: { id: string; filePath: string };
}

/**
 * GET /api/agents/[id]/files/[filePath]
 * Get version history for a specific filePath.
 * The filePath param is URL-encoded and must be decoded.
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const agentId = params.id;
    const filePath = decodeURIComponent(params.filePath);

    // Verify agent exists
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Fetch all versions for this file path, ordered newest first
    const versions = await prisma.fileVersion.findMany({
      where: {
        agentId,
        filePath,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        filePath: true,
        content: true,
        contentHash: true,
        message: true,
        parentVersionId: true,
        createdAt: true,
      },
    });

    if (versions.length === 0) {
      return NextResponse.json(
        { error: 'No versions found for this file path' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      filePath,
      agentId,
      versions,
      totalVersions: versions.length,
    });
  } catch (error) {
    console.error('Failed to fetch file version history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch file version history' },
      { status: 500 }
    );
  }
}
