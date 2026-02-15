import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

const ALLOWED_MIME_PREFIXES = [
  'image/',
  'video/',
  'audio/',
  'application/pdf',
  'application/json',
  'text/',
  'application/zip',
  'application/gzip',
  'application/x-tar',
  'application/octet-stream',
];

function isAllowedMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix));
}

/**
 * GET /api/attachments
 * List attachments, optionally filtered by taskId or messageId.
 */
export async function GET(request: Request) {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    const messageId = searchParams.get('messageId');

    const where: Record<string, string> = {};
    if (taskId) where.taskId = taskId;
    if (messageId) where.messageId = messageId;

    const attachments = await prisma.attachment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ attachments });
  } catch (error) {
    console.error('Failed to list attachments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch attachments' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/attachments
 * Upload a file via multipart form data.
 * Fields: file (required), taskId (optional), messageId (optional)
 */
export async function POST(request: Request) {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const taskId = formData.get('taskId') as string | null;
    const messageId = formData.get('messageId') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB` },
        { status: 400 }
      );
    }

    // Validate file size is not zero
    if (file.size === 0) {
      return NextResponse.json(
        { error: 'File is empty' },
        { status: 400 }
      );
    }

    // Validate mime type
    const mimeType = file.type || 'application/octet-stream';
    if (!isAllowedMimeType(mimeType)) {
      return NextResponse.json(
        { error: 'File type not allowed' },
        { status: 400 }
      );
    }

    // Validate references if provided
    if (taskId) {
      const task = await prisma.task.findUnique({ where: { id: taskId } });
      if (!task) {
        return NextResponse.json(
          { error: 'Task not found' },
          { status: 404 }
        );
      }
    }

    if (messageId) {
      const message = await prisma.message.findUnique({ where: { id: messageId } });
      if (!message) {
        return NextResponse.json(
          { error: 'Message not found' },
          { status: 404 }
        );
      }
    }

    // Ensure uploads directory exists
    await mkdir(UPLOADS_DIR, { recursive: true });

    // Generate unique filename to prevent collisions
    const uniqueId = crypto.randomUUID();
    const ext = path.extname(file.name) || '';
    const safeOriginalName = file.name
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .substring(0, 200);
    const uniqueFilename = `${uniqueId}${ext}`;

    // Write file to disk
    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = path.join(UPLOADS_DIR, uniqueFilename);
    await writeFile(filePath, buffer);

    // Create database record
    const attachment = await prisma.attachment.create({
      data: {
        filename: safeOriginalName,
        mimeType,
        size: file.size,
        url: `/api/uploads/${uniqueFilename}`,
        taskId: taskId || null,
        messageId: messageId || null,
      },
    });

    return NextResponse.json({ attachment }, { status: 201 });
  } catch (error) {
    console.error('Failed to upload file:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}
