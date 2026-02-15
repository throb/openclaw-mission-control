import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { columnId, position } = body;

    if (columnId === undefined || position === undefined) {
      return NextResponse.json(
        { error: 'columnId and position are required' },
        { status: 400 }
      );
    }

    if (typeof position !== 'number' || position < 0) {
      return NextResponse.json(
        { error: 'Position must be a non-negative number' },
        { status: 400 }
      );
    }

    const task = await prisma.task.findUnique({
      where: { id: params.id },
    });

    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Verify destination column exists
    const destColumn = await prisma.column.findUnique({
      where: { id: columnId },
    });

    if (!destColumn) {
      return NextResponse.json(
        { error: 'Destination column not found' },
        { status: 404 }
      );
    }

    const sourceColumnId = task.columnId;
    const sourcePosition = task.position;
    const isSameColumn = sourceColumnId === columnId;

    if (isSameColumn) {
      // Moving within the same column
      if (sourcePosition === position) {
        // No movement needed
        return NextResponse.json(task);
      }

      if (sourcePosition < position) {
        // Moving down: shift tasks between old and new position up
        await prisma.task.updateMany({
          where: {
            columnId: sourceColumnId,
            id: { not: params.id },
            position: {
              gt: sourcePosition,
              lte: position,
            },
          },
          data: {
            position: { decrement: 1 },
          },
        });
      } else {
        // Moving up: shift tasks between new and old position down
        await prisma.task.updateMany({
          where: {
            columnId: sourceColumnId,
            id: { not: params.id },
            position: {
              gte: position,
              lt: sourcePosition,
            },
          },
          data: {
            position: { increment: 1 },
          },
        });
      }
    } else {
      // Moving to a different column

      // Close the gap in the source column
      await prisma.task.updateMany({
        where: {
          columnId: sourceColumnId,
          position: { gt: sourcePosition },
        },
        data: {
          position: { decrement: 1 },
        },
      });

      // Make room in the destination column
      await prisma.task.updateMany({
        where: {
          columnId: columnId,
          position: { gte: position },
        },
        data: {
          position: { increment: 1 },
        },
      });
    }

    // Update the task's position and column
    const updatedTask = await prisma.task.update({
      where: { id: params.id },
      data: {
        columnId,
        position,
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

    return NextResponse.json(updatedTask);
  } catch (error) {
    console.error('Failed to move task:', error);
    return NextResponse.json(
      { error: 'Failed to move task' },
      { status: 500 }
    );
  }
}
