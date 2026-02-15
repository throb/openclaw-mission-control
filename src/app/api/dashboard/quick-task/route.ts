import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { getApiKeyForModel } from '@/lib/ai';
import Anthropic from '@anthropic-ai/sdk';

const PROVIDER_BASE_URLS: Record<string, string> = {
  xai: 'https://api.x.ai/v1',
  openai: 'https://api.openai.com/v1',
};

/**
 * POST /api/dashboard/quick-task
 * Create a task with optional LLM enrichment.
 * Body: { input: string, projectId?: string, columnId?: string, useAI?: boolean }
 */
export async function POST(request: Request) {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { input, projectId, columnId, useAI } = body;

    if (!input || typeof input !== 'string' || input.trim().length === 0) {
      return NextResponse.json(
        { error: 'Task input is required' },
        { status: 400 }
      );
    }

    let title = input.trim();
    let description: string | null = null;
    let priority = 'P2';

    // Use AI to flesh out the task
    if (useAI) {
      const keyInfo = await getApiKeyForModel();
      if (keyInfo) {
        const systemPrompt = `You are a project management assistant. Given a brief task idea, create a well-structured task with a clear title, detailed description, and priority level.

Respond ONLY with a JSON object:
{
  "title": "Clear, actionable task title (imperative form, max 80 chars)",
  "description": "Detailed description with acceptance criteria, context, and any subtasks as a markdown checklist",
  "priority": "P0|P1|P2|P3|P4"
}

Priority guide: P0=critical/blocking, P1=high/important, P2=medium/normal, P3=low, P4=backlog.
Respond with ONLY the JSON, no other text.`;

        try {
          let responseText: string;

          if (keyInfo.model.provider === 'anthropic') {
            const client = new Anthropic({ apiKey: keyInfo.apiKey });
            const response = await client.messages.create({
              model: keyInfo.model.modelId,
              max_tokens: 1024,
              system: systemPrompt,
              messages: [{ role: 'user', content: input.trim() }],
            });
            const textContent = response.content.find((c) => c.type === 'text');
            responseText = textContent && textContent.type === 'text' ? textContent.text : '';
          } else {
            const baseUrl = PROVIDER_BASE_URLS[keyInfo.model.provider] || PROVIDER_BASE_URLS.openai;
            const res = await fetch(`${baseUrl}/chat/completions`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${keyInfo.apiKey}`,
              },
              body: JSON.stringify({
                model: keyInfo.model.modelId,
                max_tokens: 1024,
                messages: [
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: input.trim() },
                ],
              }),
            });
            if (res.ok) {
              const data = await res.json();
              responseText = data.choices?.[0]?.message?.content || '';
            } else {
              responseText = '';
            }
          }

          if (responseText) {
            let jsonStr = responseText.trim();
            if (jsonStr.startsWith('```')) {
              jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
            }
            const parsed = JSON.parse(jsonStr);
            if (parsed.title) title = parsed.title;
            if (parsed.description) description = parsed.description;
            if (parsed.priority && ['P0', 'P1', 'P2', 'P3', 'P4'].includes(parsed.priority)) {
              priority = parsed.priority;
            }
          }
        } catch (aiErr) {
          console.error('AI enrichment failed, using raw input:', aiErr);
          // Fall through to create with raw input
        }
      }
    }

    // Find or create the target column
    let targetColumnId = columnId;

    if (!targetColumnId) {
      // If projectId given, find or create a board with a "To Do" column
      if (projectId) {
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          include: {
            boards: {
              include: {
                columns: {
                  orderBy: { position: 'asc' },
                },
              },
            },
          },
        });

        if (!project) {
          return NextResponse.json(
            { error: 'Project not found' },
            { status: 404 }
          );
        }

        if (project.boards.length > 0 && project.boards[0].columns.length > 0) {
          // Use the first column of the first board (typically "To Do")
          targetColumnId = project.boards[0].columns[0].id;
        } else if (project.boards.length > 0) {
          // Board exists but no columns - create one
          const col = await prisma.column.create({
            data: {
              name: 'To Do',
              position: 0,
              boardId: project.boards[0].id,
            },
          });
          targetColumnId = col.id;
        } else {
          // No board - create board + columns
          const board = await prisma.board.create({
            data: {
              name: 'Main Board',
              projectId: project.id,
              columns: {
                create: [
                  { name: 'To Do', position: 0 },
                  { name: 'In Progress', position: 1 },
                  { name: 'Done', position: 2 },
                ],
              },
            },
            include: { columns: { orderBy: { position: 'asc' } } },
          });
          targetColumnId = board.columns[0].id;
        }
      } else {
        // No project specified - use or create a "Quick Tasks" project
        let quickProject = await prisma.project.findFirst({
          where: { name: 'Quick Tasks' },
          include: {
            boards: {
              include: {
                columns: { orderBy: { position: 'asc' } },
              },
            },
          },
        });

        if (!quickProject) {
          quickProject = await prisma.project.create({
            data: {
              name: 'Quick Tasks',
              description: 'Tasks created from the dashboard quick-add',
              boards: {
                create: {
                  name: 'Board',
                  columns: {
                    create: [
                      { name: 'To Do', position: 0 },
                      { name: 'In Progress', position: 1 },
                      { name: 'Done', position: 2 },
                    ],
                  },
                },
              },
            },
            include: {
              boards: {
                include: {
                  columns: { orderBy: { position: 'asc' } },
                },
              },
            },
          });
        }

        targetColumnId = quickProject.boards[0].columns[0].id;
      }
    }

    // Get max position
    const maxPos = await prisma.task.findFirst({
      where: { columnId: targetColumnId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    const task = await prisma.task.create({
      data: {
        title,
        description,
        priority: priority as 'P0' | 'P1' | 'P2' | 'P3' | 'P4',
        position: maxPos ? maxPos.position + 1 : 0,
        columnId: targetColumnId,
      },
      include: {
        column: {
          select: {
            name: true,
            board: {
              select: {
                name: true,
                project: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      task: {
        id: task.id,
        title: task.title,
        description: task.description,
        priority: task.priority,
        column: task.column.name,
        board: task.column.board.name,
        project: task.column.board.project,
      },
      aiEnriched: useAI && description !== null,
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to create quick task:', error);
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    );
  }
}
