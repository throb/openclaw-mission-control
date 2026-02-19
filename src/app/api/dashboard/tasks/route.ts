import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboard/tasks
 * Get active tasks and projects for the dashboard overview.
 */
export async function GET() {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get projects with their boards, columns, and tasks
    const projects = await prisma.project.findMany({
      include: {
        boards: {
          include: {
            columns: {
              orderBy: { position: 'asc' },
              include: {
                tasks: {
                  orderBy: { position: 'asc' },
                  include: {
                    assignedAgent: {
                      select: { id: true, name: true, status: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Build a summary of active work
    const projectSummaries = projects.map((project) => {
      const allTasks = project.boards.flatMap((b) =>
        b.columns.flatMap((c) =>
          c.tasks.map((t) => ({
            id: t.id,
            title: t.title,
            priority: t.priority,
            column: c.name,
            board: b.name,
            assignedAgent: t.assignedAgent,
            updatedAt: t.updatedAt,
          }))
        )
      );

      // Group tasks by column for the breakdown
      const columnBreakdown = project.boards.flatMap((b) =>
        b.columns.map((c) => ({
          name: c.name,
          count: c.tasks.length,
        }))
      );

      return {
        id: project.id,
        name: project.name,
        description: project.description,
        totalTasks: allTasks.length,
        columnBreakdown,
        recentTasks: allTasks
          .sort(
            (a, b) =>
              new Date(b.updatedAt).getTime() -
              new Date(a.updatedAt).getTime()
          )
          .slice(0, 5),
      };
    });

    return NextResponse.json({ projects: projectSummaries });
  } catch (error) {
    console.error('Failed to fetch dashboard tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard tasks' },
      { status: 500 }
    );
  }
}
