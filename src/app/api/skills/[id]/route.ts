import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

interface RouteParams {
  params: { id: string };
}

/**
 * GET /api/skills/[id]
 * Get a single skill with its agents.
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const skill = await prisma.skill.findUnique({
      where: { id: params.id },
      include: {
        agents: {
          include: {
            agent: {
              select: { id: true, name: true, status: true },
            },
          },
        },
        _count: {
          select: { agents: true },
        },
      },
    });

    if (!skill) {
      return NextResponse.json(
        { error: 'Skill not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ skill });
  } catch (error) {
    console.error('Failed to fetch skill:', error);
    return NextResponse.json(
      { error: 'Failed to fetch skill' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/skills/[id]
 * Update a skill.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existing = await prisma.skill.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Skill not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { name, description, version, content, enabled } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (version !== undefined) updateData.version = version?.trim() || null;
    if (content !== undefined) updateData.content = content;
    if (enabled !== undefined) updateData.enabled = Boolean(enabled);

    const skill = await prisma.skill.update({
      where: { id: params.id },
      data: updateData,
      include: {
        _count: {
          select: { agents: true },
        },
      },
    });

    return NextResponse.json({ skill });
  } catch (error) {
    console.error('Failed to update skill:', error);
    return NextResponse.json(
      { error: 'Failed to update skill' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/skills/[id]
 * Delete a skill.
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existing = await prisma.skill.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Skill not found' },
        { status: 404 }
      );
    }

    // AgentSkill has cascade delete, so just delete the skill
    await prisma.skill.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete skill:', error);
    return NextResponse.json(
      { error: 'Failed to delete skill' },
      { status: 500 }
    );
  }
}
