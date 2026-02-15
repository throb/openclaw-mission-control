import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';

interface RouteParams {
  params: { id: string };
}

/**
 * GET /api/cron/[id]
 * Get a single cron job with agent details.
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cronJob = await prisma.cronJob.findUnique({
      where: { id: params.id },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });

    if (!cronJob) {
      return NextResponse.json(
        { error: 'Cron job not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ cronJob });
  } catch (error) {
    console.error('Failed to fetch cron job:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cron job' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/cron/[id]
 * Update a cron job's fields.
 * Body: { name?, schedule?, payload?, agentId?, enabled? }
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existing = await prisma.cronJob.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Cron job not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { name, schedule, payload, agentId, enabled, targetColumnId, taskTemplate } = body;

    // Validate name if provided
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json(
          { error: 'Cron job name cannot be empty' },
          { status: 400 }
        );
      }
    }

    // Validate schedule if provided
    if (schedule !== undefined) {
      if (typeof schedule !== 'string' || schedule.trim().length === 0) {
        return NextResponse.json(
          { error: 'Schedule cannot be empty' },
          { status: 400 }
        );
      }
    }

    // Validate agentId if provided
    if (agentId !== undefined && agentId !== null) {
      const agent = await prisma.agent.findUnique({
        where: { id: agentId },
      });
      if (!agent) {
        return NextResponse.json(
          { error: 'Agent not found' },
          { status: 400 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (schedule !== undefined) updateData.schedule = schedule.trim();
    if (payload !== undefined) updateData.payload = payload;
    if (agentId !== undefined) updateData.agentId = agentId || null;
    if (enabled !== undefined) updateData.enabled = Boolean(enabled);
    if (targetColumnId !== undefined) updateData.targetColumnId = targetColumnId || null;
    if (taskTemplate !== undefined) updateData.taskTemplate = taskTemplate;

    const cronJob = await prisma.cronJob.update({
      where: { id: params.id },
      data: updateData,
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });

    return NextResponse.json({ cronJob });
  } catch (error) {
    console.error('Failed to update cron job:', error);
    return NextResponse.json(
      { error: 'Failed to update cron job' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/cron/[id]
 * Delete a cron job.
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existing = await prisma.cronJob.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Cron job not found' },
        { status: 404 }
      );
    }

    await prisma.cronJob.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete cron job:', error);
    return NextResponse.json(
      { error: 'Failed to delete cron job' },
      { status: 500 }
    );
  }
}
