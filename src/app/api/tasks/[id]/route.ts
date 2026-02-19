import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const task = await prisma.task.findUnique({
      where: { id: params.id },
      include: {
        column: {
          select: {
            id: true,
            name: true,
            boardId: true,
            board: {
              select: {
                id: true,
                name: true,
                projectId: true,
              },
            },
          },
        },
        assignedAgent: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
        threads: {
          orderBy: { createdAt: 'desc' },
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
            },
          },
        },
        attachments: {
          orderBy: { createdAt: 'desc' },
        },
        parentTask: {
          select: {
            id: true,
            title: true,
          },
        },
        subtasks: {
          select: {
            id: true,
            title: true,
            awaitingInput: true,
          },
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error('Failed to fetch task:', error);
    return NextResponse.json(
      { error: 'Failed to fetch task' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      description,
      priority,
      columnId,
      position,
      assignedAgentId,
      parentTaskId,
      awaitingInput,
    } = body;

    const existing = await prisma.task.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Validate priority if provided
    const validPriorities = ['P0', 'P1', 'P2', 'P3', 'P4'];
    if (priority && !validPriorities.includes(priority)) {
      return NextResponse.json(
        { error: 'Invalid priority' },
        { status: 400 }
      );
    }

    // Validate column if changing
    if (columnId && columnId !== existing.columnId) {
      const column = await prisma.column.findUnique({
        where: { id: columnId },
      });
      if (!column) {
        return NextResponse.json(
          { error: 'Column not found' },
          { status: 404 }
        );
      }
    }

    // Validate agent if changing
    if (assignedAgentId !== undefined && assignedAgentId !== null) {
      const agent = await prisma.agent.findUnique({
        where: { id: assignedAgentId },
      });
      if (!agent) {
        return NextResponse.json(
          { error: 'Agent not found' },
          { status: 404 }
        );
      }
    }

    if (parentTaskId !== undefined && parentTaskId !== null && parentTaskId !== '') {
      if (parentTaskId === params.id) {
        return NextResponse.json(
          { error: 'Task cannot be its own parent' },
          { status: 400 }
        );
      }
      const parent = await prisma.task.findUnique({
        where: { id: parentTaskId },
        select: { id: true },
      });
      if (!parent) {
        return NextResponse.json(
          { error: 'Parent task not found' },
          { status: 404 }
        );
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (priority !== undefined) updateData.priority = priority;
    if (assignedAgentId !== undefined) updateData.assignedAgentId = assignedAgentId || null;
    if (parentTaskId !== undefined) updateData.parentTaskId = parentTaskId || null;
    if (awaitingInput !== undefined) updateData.awaitingInput = Boolean(awaitingInput);

    // Handle column change with reordering
    if (columnId !== undefined && columnId !== existing.columnId) {
      // If moving to a new column, set position at the end if not specified
      if (position === undefined) {
        const maxPositionTask = await prisma.task.findFirst({
          where: { columnId },
          orderBy: { position: 'desc' },
          select: { position: true },
        });
        updateData.position = maxPositionTask ? maxPositionTask.position + 1 : 0;
      } else {
        updateData.position = position;
      }
      updateData.columnId = columnId;

      // Reorder tasks in source column (close the gap)
      await prisma.task.updateMany({
        where: {
          columnId: existing.columnId,
          position: { gt: existing.position },
        },
        data: {
          position: { decrement: 1 },
        },
      });
    } else if (position !== undefined) {
      updateData.position = position;
    }

    const task = await prisma.task.update({
      where: { id: params.id },
      data: updateData,
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

    return NextResponse.json(task);
  } catch (error) {
    console.error('Failed to update task:', error);
    return NextResponse.json(
      { error: 'Failed to update task' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existing = await prisma.task.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    await prisma.task.delete({
      where: { id: params.id },
    });

    // Reorder remaining tasks in the column
    await prisma.task.updateMany({
      where: {
        columnId: existing.columnId,
        position: { gt: existing.position },
      },
      data: {
        position: { decrement: 1 },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete task:', error);
    return NextResponse.json(
      { error: 'Failed to delete task' },
      { status: 500 }
    );
  }
}
