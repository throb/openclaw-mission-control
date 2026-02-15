import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * GET /api/cron
 * List all cron jobs with their associated agent name.
 */
export async function GET() {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cronJobs = await prisma.cronJob.findMany({
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ cronJobs });
  } catch (error) {
    console.error('Failed to list cron jobs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cron jobs' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron
 * Create a new cron job.
 * Body: { name: string, schedule: string, payload: object, agentId?: string, enabled?: boolean }
 */
export async function POST(request: Request) {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, schedule, payload, agentId, enabled } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Cron job name is required' },
        { status: 400 }
      );
    }

    if (!schedule || typeof schedule !== 'string' || schedule.trim().length === 0) {
      return NextResponse.json(
        { error: 'Schedule is required' },
        { status: 400 }
      );
    }

    if (payload === undefined || payload === null) {
      return NextResponse.json(
        { error: 'Payload is required (can be an empty object)' },
        { status: 400 }
      );
    }

    // Validate agentId if provided
    if (agentId) {
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

    const cronJob = await prisma.cronJob.create({
      data: {
        name: name.trim(),
        schedule: schedule.trim(),
        payload,
        agentId: agentId || null,
        enabled: enabled !== undefined ? Boolean(enabled) : true,
      },
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

    return NextResponse.json({ cronJob }, { status: 201 });
  } catch (error) {
    console.error('Failed to create cron job:', error);
    return NextResponse.json(
      { error: 'Failed to create cron job' },
      { status: 500 }
    );
  }
}
