import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { AgentStatus } from '@prisma/client';

/**
 * GET /api/agents
 * List all agents with counts of tasks and file versions.
 * Supports ?status=ACTIVE|PAUSED|ARCHIVED filter.
 */
export async function GET(request: Request) {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status');

    // Validate status filter if provided
    let statusFilter: AgentStatus | undefined;
    if (statusParam) {
      if (!Object.values(AgentStatus).includes(statusParam as AgentStatus)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${Object.values(AgentStatus).join(', ')}` },
          { status: 400 }
        );
      }
      statusFilter = statusParam as AgentStatus;
    }

    const agents = await prisma.agent.findMany({
      where: statusFilter ? { status: statusFilter } : undefined,
      include: {
        model: {
          select: { id: true, provider: true, modelId: true, displayName: true },
        },
        _count: {
          select: {
            tasks: true,
            fileVersions: true,
            cronJobs: true,
            projects: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ agents });
  } catch (error) {
    console.error('Failed to list agents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agents' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agents
 * Create a new agent.
 * Body: { name: string, description?: string }
 */
export async function POST(request: Request) {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, modelId } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Agent name is required' },
        { status: 400 }
      );
    }

    if (name.trim().length > 100) {
      return NextResponse.json(
        { error: 'Agent name must be 100 characters or fewer' },
        { status: 400 }
      );
    }

    const agent = await prisma.agent.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        modelId: modelId || null,
      },
      include: {
        model: {
          select: { id: true, provider: true, modelId: true, displayName: true },
        },
        _count: {
          select: {
            tasks: true,
            fileVersions: true,
            cronJobs: true,
            projects: true,
          },
        },
      },
    });

    return NextResponse.json({ agent }, { status: 201 });
  } catch (error) {
    console.error('Failed to create agent:', error);
    return NextResponse.json(
      { error: 'Failed to create agent' },
      { status: 500 }
    );
  }
}
