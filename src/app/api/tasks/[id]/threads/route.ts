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
    });

    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    const threads = await prisma.thread.findMany({
      where: { taskId: params.id },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { messages: true },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });

    return NextResponse.json(threads);
  } catch (error) {
    console.error('Failed to fetch threads:', error);
    return NextResponse.json(
      { error: 'Failed to fetch threads' },
      { status: 500 }
    );
  }
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
    const { content, authorType, authorId } = body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message content is required' },
        { status: 400 }
      );
    }

    if (!authorType || !['USER', 'AGENT'].includes(authorType)) {
      return NextResponse.json(
        { error: 'authorType must be USER or AGENT' },
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

    const thread = await prisma.thread.create({
      data: {
        taskId: params.id,
        messages: {
          create: {
            content: content.trim(),
            authorType,
            authorId: authorId || null,
          },
        },
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: { messages: true },
        },
      },
    });

    return NextResponse.json(thread, { status: 201 });
  } catch (error) {
    console.error('Failed to create thread:', error);
    return NextResponse.json(
      { error: 'Failed to create thread' },
      { status: 500 }
    );
  }
}
