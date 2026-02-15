import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import fs from 'fs/promises';
import path from 'path';

const SKILLS_DIR = '/home/throb/clawd/skills';

/**
 * Parse YAML frontmatter from a SKILL.md file.
 */
function parseFrontmatter(content: string): {
  name?: string;
  description?: string;
  version?: string;
  license?: string;
} {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const yaml = match[1];
  const result: Record<string, string> = {};

  for (const line of yaml.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();
    // Remove surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }

  return result;
}

/**
 * POST /api/skills/import
 * Import all skills from the clawd skills directory.
 */
export async function POST() {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let entries: string[];
    try {
      entries = await fs.readdir(SKILLS_DIR);
    } catch {
      return NextResponse.json(
        { error: `Skills directory not found: ${SKILLS_DIR}` },
        { status: 400 }
      );
    }

    const results: { slug: string; action: string }[] = [];

    for (const entry of entries) {
      const skillDir = path.join(SKILLS_DIR, entry);
      const stat = await fs.stat(skillDir);
      if (!stat.isDirectory()) continue;

      const skillFile = path.join(skillDir, 'SKILL.md');
      let content: string;
      try {
        content = await fs.readFile(skillFile, 'utf-8');
      } catch {
        results.push({ slug: entry, action: 'skipped (no SKILL.md)' });
        continue;
      }

      const meta = parseFrontmatter(content);
      const name = meta.name || entry;
      const description = meta.description || null;
      const version = meta.version || null;
      const license = meta.license || null;

      // Upsert: create or update
      const existing = await prisma.skill.findUnique({
        where: { slug: entry },
      });

      if (existing) {
        await prisma.skill.update({
          where: { slug: entry },
          data: {
            name,
            description,
            version,
            license,
            content,
          },
        });
        results.push({ slug: entry, action: 'updated' });
      } else {
        await prisma.skill.create({
          data: {
            slug: entry,
            name,
            description,
            version,
            license,
            content,
            enabled: true,
          },
        });
        results.push({ slug: entry, action: 'created' });
      }
    }

    return NextResponse.json({
      imported: results.filter((r) => r.action !== 'skipped (no SKILL.md)').length,
      skipped: results.filter((r) => r.action === 'skipped (no SKILL.md)').length,
      results,
    });
  } catch (error) {
    console.error('Failed to import skills:', error);
    return NextResponse.json(
      { error: 'Failed to import skills' },
      { status: 500 }
    );
  }
}
