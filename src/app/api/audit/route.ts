import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/audit
 * List audit logs, newest first.
 * Query params:
 *   ?limit=N   - Number of logs to return (default 50, max 200)
 *   ?action=X  - Filter by action type (e.g., "model.apikey.view")
 *   ?userId=X  - Filter by user ID
 */
export async function GET(request: Request) {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    // Parse limit
    const limitParam = searchParams.get('limit');
    let limit = 50;
    if (limitParam) {
      const parsed = parseInt(limitParam, 10);
      if (!isNaN(parsed) && parsed > 0) {
        limit = Math.min(parsed, 200);
      }
    }

    // Build where clause
    const where: Record<string, unknown> = {};

    const actionParam = searchParams.get('action');
    if (actionParam) {
      where.action = actionParam;
    }

    const userIdParam = searchParams.get('userId');
    if (userIdParam) {
      where.userId = userIdParam;
    }

    const auditLogs = await prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({ auditLogs });
  } catch (error) {
    console.error('Failed to list audit logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}
