import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';

interface RouteParams {
  params: { id: string };
}

/**
 * POST /api/cron/[id]/trigger
 * Manually trigger a cron job. If it has a task template + target column,
 * creates a new task on the kanban board.
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cronJob = await prisma.cronJob.findUnique({
      where: { id: params.id },
      include: {
        targetColumn: {
          include: {
            board: {
              include: {
                project: { select: { id: true, name: true } },
              },
            },
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

    // Update last run time
    await prisma.cronJob.update({
      where: { id: params.id },
      data: { lastRunAt: new Date() },
    });

    // If this cron has a task template, create the task
    if (cronJob.targetColumnId && cronJob.taskTemplate) {
      const template = cronJob.taskTemplate as {
        title?: string;
        description?: string;
        priority?: string;
        assignedAgentId?: string;
      };

      // Get max position in the target column
      const maxPos = await prisma.task.findFirst({
        where: { columnId: cronJob.targetColumnId },
        orderBy: { position: 'desc' },
        select: { position: true },
      });

      const now = new Date();
      const dateStr = now.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      const task = await prisma.task.create({
        data: {
          title: (template.title || cronJob.name).replace(
            '{{date}}',
            dateStr
          ),
          description: template.description?.replace('{{date}}', dateStr) || null,
          priority: (template.priority as 'P0' | 'P1' | 'P2' | 'P3' | 'P4') || 'P2',
          position: maxPos ? maxPos.position + 1 : 0,
          columnId: cronJob.targetColumnId,
          assignedAgentId: template.assignedAgentId || cronJob.agentId || null,
        },
        include: {
          column: {
            select: {
              name: true,
              board: {
                select: {
                  name: true,
                  project: { select: { name: true } },
                },
              },
            },
          },
        },
      });

      return NextResponse.json({
        triggered: true,
        taskCreated: true,
        task: {
          id: task.id,
          title: task.title,
          column: task.column.name,
          board: task.column.board.name,
          project: task.column.board.project.name,
        },
      });
    }

    return NextResponse.json({
      triggered: true,
      taskCreated: false,
    });
  } catch (error) {
    console.error('Failed to trigger cron job:', error);
    return NextResponse.json(
      { error: 'Failed to trigger cron job' },
      { status: 500 }
    );
  }
}
