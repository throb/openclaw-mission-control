import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { analyzeAgentFiles } from '@/lib/ai';

interface RouteParams {
  params: { id: string };
}

/**
 * POST /api/agents/[id]/analyze
 * Analyze an agent's files using AI.
 * Body: { modelId?: string, prompt?: string }
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const agent = await prisma.agent.findUnique({
      where: { id: params.id },
      include: {
        model: true,
      },
    });

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Get latest version of each file for this agent
    const allVersions = await prisma.fileVersion.findMany({
      where: { agentId: params.id },
      orderBy: { createdAt: 'desc' },
    });

    // Deduplicate by filePath (keep latest)
    const fileMap = new Map<string, { filePath: string; content: string }>();
    for (const fv of allVersions) {
      if (!fileMap.has(fv.filePath)) {
        fileMap.set(fv.filePath, {
          filePath: fv.filePath,
          content: fv.content,
        });
      }
    }

    const files = Array.from(fileMap.values());

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'Agent has no files to analyze. Generate or create files first.' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const modelId = body.modelId || agent.modelId;
    const prompt = body.prompt;

    const analysis = await analyzeAgentFiles(
      agent.name,
      files,
      modelId,
      prompt
    );

    return NextResponse.json({
      analysis,
      filesAnalyzed: files.length,
    });
  } catch (error) {
    console.error('Failed to analyze files:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to analyze files';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
