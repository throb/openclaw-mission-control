import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

/**
 * GET /api/skills
 * List all skills with agent counts.
 */
export async function GET(request: Request) {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const enabledOnly = searchParams.get('enabled');

    const skills = await prisma.skill.findMany({
      where: enabledOnly === 'true' ? { enabled: true } : undefined,
      include: {
        _count: {
          select: { agents: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ skills });
  } catch (error) {
    console.error('Failed to list skills:', error);
    return NextResponse.json(
      { error: 'Failed to fetch skills' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/skills
 * Create a new skill.
 * Body: { slug, name, description?, version?, license?, content, enabled? }
 */
export async function POST(request: Request) {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { slug, name, description, version, license, content, enabled } = body;

    if (!slug || !name || !content) {
      return NextResponse.json(
        { error: 'slug, name, and content are required' },
        { status: 400 }
      );
    }

    const skill = await prisma.skill.create({
      data: {
        slug: slug.trim().toLowerCase(),
        name: name.trim(),
        description: description?.trim() || null,
        version: version?.trim() || null,
        license: license?.trim() || null,
        content: content,
        enabled: enabled !== false,
      },
      include: {
        _count: {
          select: { agents: true },
        },
      },
    });

    return NextResponse.json({ skill }, { status: 201 });
  } catch (error: unknown) {
    console.error('Failed to create skill:', error);

    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'A skill with this slug already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create skill' },
      { status: 500 }
    );
  }
}
