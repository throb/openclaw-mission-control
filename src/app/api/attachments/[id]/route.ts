import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { unlink } from 'fs/promises';
import path from 'path';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

interface RouteParams {
  params: { id: string };
}

/**
 * GET /api/attachments/[id]
 * Return attachment metadata.
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const attachment = await prisma.attachment.findUnique({
      where: { id: params.id },
    });

    if (!attachment) {
      return NextResponse.json(
        { error: 'Attachment not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ attachment });
  } catch (error) {
    console.error('Failed to fetch attachment:', error);
    return NextResponse.json(
      { error: 'Failed to fetch attachment' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/attachments/[id]
 * Delete attachment file from disk and database record.
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const attachment = await prisma.attachment.findUnique({
      where: { id: params.id },
    });

    if (!attachment) {
      return NextResponse.json(
        { error: 'Attachment not found' },
        { status: 404 }
      );
    }

    // Extract the filename from the URL path
    // URL format: /api/uploads/<filename>
    const urlParts = attachment.url.split('/');
    const filename = urlParts[urlParts.length - 1];

    if (filename) {
      const filePath = path.join(UPLOADS_DIR, filename);

      // Ensure path doesn't escape uploads directory
      const resolvedPath = path.resolve(filePath);
      const resolvedUploads = path.resolve(UPLOADS_DIR);
      if (resolvedPath.startsWith(resolvedUploads)) {
        try {
          await unlink(filePath);
        } catch (err) {
          // File may already be deleted; log but don't fail
          console.warn('File not found on disk during deletion:', filePath, err);
        }
      }
    }

    // Delete database record
    await prisma.attachment.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete attachment:', error);
    return NextResponse.json(
      { error: 'Failed to delete attachment' },
      { status: 500 }
    );
  }
}
