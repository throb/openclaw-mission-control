import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, description, priority, columnId, assignedAgentId } = body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { error: 'Task title is required' },
        { status: 400 }
      );
    }

    if (!columnId) {
      return NextResponse.json(
        { error: 'Column ID is required' },
        { status: 400 }
      );
    }

    // Verify column exists
    const column = await prisma.column.findUnique({
      where: { id: columnId },
    });

    if (!column) {
      return NextResponse.json(
        { error: 'Column not found' },
        { status: 404 }
      );
    }

    // Validate priority if provided
    const validPriorities = ['P0', 'P1', 'P2', 'P3', 'P4'];
    if (priority && !validPriorities.includes(priority)) {
      return NextResponse.json(
        { error: 'Invalid priority. Must be P0, P1, P2, P3, or P4' },
        { status: 400 }
      );
    }

    // Validate assigned agent if provided
    if (assignedAgentId) {
      const agent = await prisma.agent.findUnique({
        where: { id: assignedAgentId },
      });
      if (!agent) {
        return NextResponse.json(
          { error: 'Assigned agent not found' },
          { status: 404 }
        );
      }
    }

    // Get the max position in the column to place the task at the end
    const maxPositionTask = await prisma.task.findFirst({
      where: { columnId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    const position = maxPositionTask ? maxPositionTask.position + 1 : 0;

    const task = await prisma.task.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        priority: priority || 'P2',
        position,
        columnId,
        assignedAgentId: assignedAgentId || null,
      },
      include: {
        assignedAgent: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
        column: {
          select: {
            id: true,
            name: true,
            boardId: true,
          },
        },
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error('Failed to create task:', error);
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    );
  }
}
