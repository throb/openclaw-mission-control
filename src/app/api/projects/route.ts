import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projects = await prisma.project.findMany({
      include: {
        _count: {
          select: {
            boards: true,
            agents: true,
          },
        },
        boards: {
          include: {
            columns: {
              include: {
                _count: {
                  select: { tasks: true },
                },
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const result = projects.map((project) => {
      const totalTasks = project.boards.reduce(
        (sum, board) =>
          sum + board.columns.reduce((colSum, col) => colSum + col._count.tasks, 0),
        0
      );

      return {
        id: project.id,
        name: project.name,
        description: project.description,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        boardCount: project._count.boards,
        agentCount: project._count.agents,
        taskCount: totalTasks,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to fetch projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Project name is required' },
        { status: 400 }
      );
    }

    const defaultColumns = [
      { name: 'Backlog', position: 0 },
      { name: 'To Do', position: 1 },
      { name: 'In Progress', position: 2 },
      { name: 'Review', position: 3 },
      { name: 'Done', position: 4 },
    ];

    const project = await prisma.project.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        boards: {
          create: {
            name: 'Main Board',
            columns: {
              create: defaultColumns,
            },
          },
        },
      },
      include: {
        boards: {
          include: {
            columns: {
              orderBy: { position: 'asc' },
            },
          },
        },
        _count: {
          select: {
            boards: true,
            agents: true,
          },
        },
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error('Failed to create project:', error);
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}
