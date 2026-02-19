import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const dynamic = 'force-dynamic';

const MEMORY_DIR = path.join(os.homedir(), 'clawd', 'memory');

interface MemoryFile {
  filename: string;
  path: string;
  content: string;
  modifiedAt: string;
  sizeBytes: number;
}

/**
 * GET /api/memory
 * Read markdown files from ~/clawd/memory/
 * Query params:
 *   ?file=filename.md  - Read a specific file
 *   (no params)        - List all .md files with metadata
 */
export async function GET(request: Request) {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const specificFile = searchParams.get('file');

    // Check if memory directory exists
    if (!fs.existsSync(MEMORY_DIR)) {
      return NextResponse.json({
        files: [],
        directory: MEMORY_DIR,
        exists: false,
      });
    }

    if (specificFile) {
      // Read a specific file
      const safeName = path.basename(specificFile);
      const filePath = path.join(MEMORY_DIR, safeName);

      if (!fs.existsSync(filePath)) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const stat = fs.statSync(filePath);

      return NextResponse.json({
        file: {
          filename: safeName,
          path: filePath,
          content,
          modifiedAt: stat.mtime.toISOString(),
          sizeBytes: stat.size,
        } satisfies MemoryFile,
      });
    }

    // List all markdown files
    const entries = fs.readdirSync(MEMORY_DIR, { withFileTypes: true });
    const files: MemoryFile[] = [];

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith('.md')) continue;

      const filePath = path.join(MEMORY_DIR, entry.name);
      const stat = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, 'utf-8');

      files.push({
        filename: entry.name,
        path: filePath,
        content,
        modifiedAt: stat.mtime.toISOString(),
        sizeBytes: stat.size,
      });
    }

    // Sort by modification time, newest first
    files.sort(
      (a, b) =>
        new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
    );

    return NextResponse.json({
      files,
      directory: MEMORY_DIR,
      exists: true,
    });
  } catch (error) {
    console.error('Failed to read memory files:', error);
    return NextResponse.json(
      { error: 'Failed to read memory files' },
      { status: 500 }
    );
  }
}
