import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isIdeasColumn, isTodoColumn } from '@/lib/kanban';

interface CandidateAgent {
  id: string;
  name: string;
}

async function pickAgentForTask(projectId: string): Promise<CandidateAgent | null> {
  const projectScopedAgents = await prisma.projectAgent.findMany({
    where: {
      projectId,
      agent: { status: 'ACTIVE' },
    },
    select: {
      agent: {
        select: { id: true, name: true },
      },
    },
  });

  let candidates = projectScopedAgents.map((r) => r.agent);
  if (candidates.length === 0) {
    candidates = await prisma.agent.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true },
    });
  }

  if (candidates.length === 0) return null;

  const candidateIds = candidates.map((c) => c.id);
  const assignedTasks = await prisma.task.findMany({
    where: {
      assignedAgentId: { in: candidateIds },
      column: {
        board: { projectId },
      },
      NOT: {
        column: {
          name: { equals: 'Done', mode: 'insensitive' },
        },
      },
    },
    select: { assignedAgentId: true },
  });

  const workload = new Map<string, number>();
  for (const candidate of candidates) {
    workload.set(candidate.id, 0);
  }
  for (const task of assignedTasks) {
    if (!task.assignedAgentId) continue;
    workload.set(task.assignedAgentId, (workload.get(task.assignedAgentId) || 0) + 1);
  }

  candidates.sort((a, b) => {
    const loadDiff = (workload.get(a.id) || 0) - (workload.get(b.id) || 0);
    if (loadDiff !== 0) return loadDiff;
    return a.name.localeCompare(b.name);
  });

  return candidates[0];
}

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
      include: {
        column: {
          include: {
            board: {
              select: {
                id: true,
                projectId: true,
              },
            },
          },
        },
      },
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
      include: {
        board: {
          select: {
            id: true,
            projectId: true,
          },
        },
      },
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
    const movedIdeasToTodo =
      !isSameColumn &&
      isIdeasColumn(task.column.name) &&
      isTodoColumn(destColumn.name);

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
    let updatedTask = await prisma.task.update({
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

    const shouldAutoAssign =
      movedIdeasToTodo &&
      !updatedTask.assignedAgent &&
      task.column.board.projectId === destColumn.board.projectId;

    if (shouldAutoAssign) {
      const selectedAgent = await pickAgentForTask(destColumn.board.projectId);
      if (selectedAgent) {
        updatedTask = await prisma.task.update({
          where: { id: params.id },
          data: {
            assignedAgentId: selectedAgent.id,
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

        // Log orchestrator assignment on the task conversation timeline.
        await prisma.thread.create({
          data: {
            taskId: params.id,
            messages: {
              create: {
                content: `Orchestrator assigned this task to ${selectedAgent.name} after it moved from ${task.column.name} to ${destColumn.name}.`,
                authorType: 'USER',
                authorId: null,
              },
            },
          },
        });
      } else {
        await prisma.thread.create({
          data: {
            taskId: params.id,
            messages: {
              create: {
                content: `Orchestrator could not assign this task automatically after moving to ${destColumn.name} because no ACTIVE agents are available.`,
                authorType: 'USER',
                authorId: null,
              },
            },
          },
        });
      }
    }

    return NextResponse.json(updatedTask);
  } catch (error) {
    console.error('Failed to move task:', error);
    return NextResponse.json(
      { error: 'Failed to move task' },
      { status: 500 }
    );
  }
}
