import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { AgentStatus } from '@prisma/client';

interface RouteParams {
  params: { id: string };
}

/**
 * GET /api/agents/[id]
 * Get a single agent with all relations.
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const agent = await prisma.agent.findUnique({
      where: { id: params.id },
      include: {
        model: {
          select: { id: true, provider: true, modelId: true, displayName: true },
        },
        fileVersions: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        tasks: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        cronJobs: {
          orderBy: { createdAt: 'desc' },
        },
        projects: {
          include: {
            project: true,
          },
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

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ agent });
  } catch (error) {
    console.error('Failed to fetch agent:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agent' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/agents/[id]
 * Update an agent's name, description, or status.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify agent exists
    const existing = await prisma.agent.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { name, description, status, modelId, discordChannelId } = body;

    // Validate status if provided
    if (status && !Object.values(AgentStatus).includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${Object.values(AgentStatus).join(', ')}` },
        { status: 400 }
      );
    }

    // Validate name if provided
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json(
          { error: 'Agent name cannot be empty' },
          { status: 400 }
        );
      }
      if (name.trim().length > 100) {
        return NextResponse.json(
          { error: 'Agent name must be 100 characters or fewer' },
          { status: 400 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (status !== undefined) updateData.status = status;
    if (modelId !== undefined) updateData.modelId = modelId || null;
    if (discordChannelId !== undefined) updateData.discordChannelId = discordChannelId || null;

    const agent = await prisma.agent.update({
      where: { id: params.id },
      data: updateData,
      include: {
        model: {
          select: { id: true, provider: true, modelId: true, displayName: true },
        },
        discordChannel: {
          select: { id: true, channelId: true, name: true },
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

    return NextResponse.json({ agent });
  } catch (error) {
    console.error('Failed to update agent:', error);
    return NextResponse.json(
      { error: 'Failed to update agent' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/agents/[id]
 * Delete an agent and cascade to related records.
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existing = await prisma.agent.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Delete in order to respect foreign key constraints.
    // FileVersions have optional agentId, so we null them out or delete.
    // Tasks have optional assignedAgentId.
    // CronJobs have optional agentId.
    // ProjectAgent has cascade on agent delete.
    await prisma.$transaction(async (tx) => {
      // Nullify agent references on file versions
      await tx.fileVersion.updateMany({
        where: { agentId: params.id },
        data: { agentId: null },
      });

      // Nullify agent references on tasks
      await tx.task.updateMany({
        where: { assignedAgentId: params.id },
        data: { assignedAgentId: null },
      });

      // Nullify agent references on cron jobs
      await tx.cronJob.updateMany({
        where: { agentId: params.id },
        data: { agentId: null },
      });

      // Delete project-agent associations (has cascade, but explicit for clarity)
      await tx.projectAgent.deleteMany({
        where: { agentId: params.id },
      });

      // Delete the agent
      await tx.agent.delete({
        where: { id: params.id },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete agent:', error);
    return NextResponse.json(
      { error: 'Failed to delete agent' },
      { status: 500 }
    );
  }
}
