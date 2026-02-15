import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { readFile, stat } from 'fs/promises';
import path from 'path';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

/**
 * MIME type mapping for common file extensions.
 */
const MIME_TYPES: Record<string, string> = {
  // Images
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.bmp': 'image/bmp',
  '.avif': 'image/avif',

  // Video
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogg': 'video/ogg',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska',

  // Audio
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.aac': 'audio/aac',

  // Documents
  '.pdf': 'application/pdf',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.md': 'text/markdown',
  '.html': 'text/html',

  // Archives
  '.zip': 'application/zip',
  '.gz': 'application/gzip',
  '.tar': 'application/x-tar',

  // Code
  '.js': 'text/javascript',
  '.ts': 'text/typescript',
  '.py': 'text/x-python',
  '.sh': 'text/x-shellscript',
};

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

interface RouteParams {
  params: { path: string[] };
}

/**
 * GET /api/uploads/[...path]
 * Serve uploaded files with correct Content-Type headers.
 * Security: prevents path traversal.
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pathSegments = params.path;

    if (!pathSegments || pathSegments.length === 0) {
      return NextResponse.json(
        { error: 'No file path specified' },
        { status: 400 }
      );
    }

    // Security: reject any segment containing ".."
    for (const segment of pathSegments) {
      if (segment === '..' || segment.includes('..')) {
        return NextResponse.json(
          { error: 'Invalid file path' },
          { status: 400 }
        );
      }
    }

    // Build and resolve file path
    const requestedPath = path.join(UPLOADS_DIR, ...pathSegments);
    const resolvedPath = path.resolve(requestedPath);
    const resolvedUploads = path.resolve(UPLOADS_DIR);

    // Security: ensure resolved path is within uploads directory
    if (!resolvedPath.startsWith(resolvedUploads + path.sep) && resolvedPath !== resolvedUploads) {
      return NextResponse.json(
        { error: 'Invalid file path' },
        { status: 400 }
      );
    }

    // Check file exists
    try {
      const fileStat = await stat(resolvedPath);
      if (!fileStat.isFile()) {
        return NextResponse.json(
          { error: 'Not a file' },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Read and serve the file
    const fileBuffer = await readFile(resolvedPath);
    const mimeType = getMimeType(resolvedPath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Failed to serve file:', error);
    return NextResponse.json(
      { error: 'Failed to serve file' },
      { status: 500 }
    );
  }
}
