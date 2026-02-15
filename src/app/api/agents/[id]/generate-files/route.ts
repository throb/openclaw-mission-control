import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { generateAgentFiles } from '@/lib/ai';
import crypto from 'crypto';

interface RouteParams {
  params: { id: string };
}

/**
 * POST /api/agents/[id]/generate-files
 * Use AI to generate example md files based on the agent's description.
 * Body: { modelId?: string } - optional model override
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

    if (!agent.description) {
      return NextResponse.json(
        { error: 'Agent needs a description to generate files. Add a description first.' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const modelId = body.modelId || agent.modelId;

    // Generate files using AI
    const generatedFiles = await generateAgentFiles(
      agent.name,
      agent.description,
      modelId
    );

    // Save each generated file as a FileVersion
    const savedFiles = [];
    for (const file of generatedFiles) {
      const contentHash = crypto
        .createHash('sha256')
        .update(file.content)
        .digest('hex');

      // Check if file already exists for this agent
      const existing = await prisma.fileVersion.findFirst({
        where: {
          agentId: params.id,
          filePath: file.filePath,
        },
        orderBy: { createdAt: 'desc' },
      });

      const fileVersion = await prisma.fileVersion.create({
        data: {
          filePath: file.filePath,
          content: file.content,
          contentHash,
          message: existing
            ? 'AI-regenerated file'
            : 'AI-generated initial file',
          agentId: params.id,
          parentVersionId: existing?.id || null,
        },
      });

      savedFiles.push({
        filePath: file.filePath,
        content: file.content,
        latestVersionId: fileVersion.id,
        message: fileVersion.message,
        updatedAt: fileVersion.createdAt.toISOString(),
      });
    }

    return NextResponse.json({
      files: savedFiles,
      count: savedFiles.length,
    });
  } catch (error) {
    console.error('Failed to generate files:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to generate files';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
