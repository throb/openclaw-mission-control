import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import crypto from 'crypto';

interface RouteParams {
  params: { id: string };
}

/**
 * GET /api/agents/[id]/files
 * List distinct file paths for this agent with the latest version of each.
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify agent exists
    const agent = await prisma.agent.findUnique({
      where: { id: params.id },
    });

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Get all file versions for this agent, grouped by filePath
    // We want distinct filePaths with the latest version of each
    const allVersions = await prisma.fileVersion.findMany({
      where: { agentId: params.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        filePath: true,
        contentHash: true,
        message: true,
        createdAt: true,
      },
    });

    // Group by filePath and take the latest version of each
    const latestByPath = new Map<string, typeof allVersions[0]>();
    for (const version of allVersions) {
      if (!latestByPath.has(version.filePath)) {
        latestByPath.set(version.filePath, version);
      }
    }

    const files = Array.from(latestByPath.values()).map((version) => ({
      filePath: version.filePath,
      latestVersionId: version.id,
      contentHash: version.contentHash,
      message: version.message,
      updatedAt: version.createdAt,
    }));

    return NextResponse.json({ files });
  } catch (error) {
    console.error('Failed to list agent files:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agent files' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agents/[id]/files
 * Create a new file version.
 * Body: { filePath: string, content: string, message?: string }
 * Auto-computes contentHash via SHA-256.
 * Links parentVersionId to previous version of same filePath.
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify agent exists
    const agent = await prisma.agent.findUnique({
      where: { id: params.id },
    });

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { filePath, content, message } = body;

    if (!filePath || typeof filePath !== 'string' || filePath.trim().length === 0) {
      return NextResponse.json(
        { error: 'filePath is required' },
        { status: 400 }
      );
    }

    if (content === undefined || content === null || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'content is required and must be a string' },
        { status: 400 }
      );
    }

    // Compute content hash
    const contentHash = crypto.createHash('sha256').update(content).digest('hex');

    // Find the most recent version of this file path for this agent
    const previousVersion = await prisma.fileVersion.findFirst({
      where: {
        agentId: params.id,
        filePath: filePath.trim(),
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, contentHash: true },
    });

    // Skip if content hasn't changed
    if (previousVersion && previousVersion.contentHash === contentHash) {
      return NextResponse.json(
        { error: 'Content has not changed', skipped: true },
        { status: 409 }
      );
    }

    const fileVersion = await prisma.fileVersion.create({
      data: {
        filePath: filePath.trim(),
        content,
        contentHash,
        message: message?.trim() || null,
        agentId: params.id,
        parentVersionId: previousVersion?.id || null,
      },
    });

    return NextResponse.json({ fileVersion }, { status: 201 });
  } catch (error) {
    console.error('Failed to create file version:', error);
    return NextResponse.json(
      { error: 'Failed to create file version' },
      { status: 500 }
    );
  }
}
