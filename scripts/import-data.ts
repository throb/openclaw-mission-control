/**
 * Import existing OpenClaw data into BobBot Mission Control
 * Run: npx tsx scripts/import-data.ts
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import crypto from 'crypto';

const prisma = new PrismaClient();

const OPENCLAW_CONFIG = '/home/throb/.openclaw/openclaw.json';
const CRON_JOBS_FILE = '/home/throb/.openclaw/cron/jobs.json';
const CLAWD_WORKSPACE = '/mnt/HC_Volume_104679608/projects/clawd';

function sha256(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function readJsonFile(path: string): any {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function readMdFile(path: string): string | null {
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf-8');
}

async function importAgents() {
  console.log('\n=== Importing Agents ===');
  const config = readJsonFile(OPENCLAW_CONFIG);
  const agents = config.agents.list;

  for (const agentConf of agents) {
    const existing = await prisma.agent.findFirst({ where: { name: agentConf.id } });
    if (existing) {
      console.log(`  Agent "${agentConf.id}" already exists, skipping`);
      continue;
    }

    const description = agentConf.id === 'main'
      ? `Default OpenClaw agent. Model: ${config.agents.defaults.model.primary}. Workspace: ${config.agents.defaults.workspace}`
      : `${agentConf.name || agentConf.id}. Model: ${agentConf.model || 'default'}`;

    const agent = await prisma.agent.create({
      data: {
        name: agentConf.id,
        description,
        status: 'ACTIVE',
      },
    });
    console.log(`  Created agent: ${agent.name} (${agent.id})`);
  }
}

async function importFiles() {
  console.log('\n=== Importing Files (agent.md, SOUL.md, MEMORY.md, etc.) ===');

  const mainAgent = await prisma.agent.findFirst({ where: { name: 'main' } });
  if (!mainAgent) {
    console.log('  No main agent found, skipping file import');
    return;
  }

  const filesToImport = [
    { path: 'SOUL.md', fullPath: join(CLAWD_WORKSPACE, 'SOUL.md') },
    { path: 'MEMORY.md', fullPath: join(CLAWD_WORKSPACE, 'MEMORY.md') },
    { path: 'AGENTS.md', fullPath: join(CLAWD_WORKSPACE, 'AGENTS.md') },
    { path: 'USER.md', fullPath: join(CLAWD_WORKSPACE, 'USER.md') },
    { path: 'IDENTITY.md', fullPath: join(CLAWD_WORKSPACE, 'IDENTITY.md') },
    { path: 'HEARTBEAT.md', fullPath: join(CLAWD_WORKSPACE, 'HEARTBEAT.md') },
    { path: 'active-context.md', fullPath: join(CLAWD_WORKSPACE, 'active-context.md') },
  ];

  // Also import runbooks
  const runbooksDir = join(CLAWD_WORKSPACE, 'runbooks');
  if (existsSync(runbooksDir)) {
    const runbooks = readdirSync(runbooksDir).filter(f => f.endsWith('.md'));
    for (const rb of runbooks) {
      filesToImport.push({
        path: `runbooks/${rb}`,
        fullPath: join(runbooksDir, rb),
      });
    }
  }

  for (const file of filesToImport) {
    const content = readMdFile(file.fullPath);
    if (!content) {
      console.log(`  Skipping ${file.path} (not found)`);
      continue;
    }

    const contentHash = sha256(content);

    // Check if this version already exists
    const existing = await prisma.fileVersion.findFirst({
      where: { filePath: file.path, contentHash },
    });

    if (existing) {
      console.log(`  ${file.path} unchanged, skipping`);
      continue;
    }

    // Find the latest version to link as parent
    const latestVersion = await prisma.fileVersion.findFirst({
      where: { filePath: file.path },
      orderBy: { createdAt: 'desc' },
    });

    await prisma.fileVersion.create({
      data: {
        filePath: file.path,
        content,
        contentHash,
        message: 'Initial import from OpenClaw workspace',
        agentId: mainAgent.id,
        parentVersionId: latestVersion?.id || null,
      },
    });
    console.log(`  Imported: ${file.path} (${content.length} chars)`);
  }
}

async function importCronJobs() {
  console.log('\n=== Importing Cron Jobs ===');
  const cronData = readJsonFile(CRON_JOBS_FILE);
  const jobs = cronData.jobs;

  // Get agent map
  const agents = await prisma.agent.findMany();
  const agentMap = new Map(agents.map(a => [a.name, a.id]));

  for (const job of jobs) {
    // Check if already imported
    const existing = await prisma.cronJob.findFirst({
      where: { openclawJobId: job.id },
    });
    if (existing) {
      console.log(`  Cron "${job.name}" already exists, skipping`);
      continue;
    }

    // Convert schedule to cron expression
    let schedule = '* * * * *';
    if (job.schedule.kind === 'cron') {
      schedule = job.schedule.expr;
    } else if (job.schedule.kind === 'every') {
      const mins = Math.round(job.schedule.everyMs / 60000);
      if (mins < 60) {
        schedule = `*/${mins} * * * *`;
      } else {
        const hours = Math.round(mins / 60);
        schedule = `0 */${hours} * * *`;
      }
    } else if (job.schedule.kind === 'at') {
      // One-time job, use the date
      const d = new Date(job.schedule.at);
      schedule = `${d.getUTCMinutes()} ${d.getUTCHours()} ${d.getUTCDate()} ${d.getUTCMonth() + 1} *`;
    }

    const agentId = agentMap.get(job.agentId) || null;

    await prisma.cronJob.create({
      data: {
        name: job.name,
        schedule,
        payload: {
          message: job.payload?.message || job.payload?.text || '',
          kind: job.payload?.kind || 'agentTurn',
          timeoutSeconds: job.payload?.timeoutSeconds || 120,
          delivery: job.delivery || null,
          sessionTarget: job.sessionTarget || 'isolated',
        },
        agentId,
        enabled: job.enabled !== false,
        lastRunAt: job.state?.lastRunAtMs ? new Date(job.state.lastRunAtMs) : null,
        nextRunAt: job.state?.nextRunAtMs ? new Date(job.state.nextRunAtMs) : null,
        openclawJobId: job.id,
      },
    });
    console.log(`  Created cron: ${job.name} [${schedule}] ${job.enabled !== false ? 'enabled' : 'DISABLED'}`);
  }
}

async function importModels() {
  console.log('\n=== Importing AI Models ===');
  const config = readJsonFile(OPENCLAW_CONFIG);

  // Anthropic models (from defaults)
  const anthropicModels = [
    { id: 'claude-opus-4-5', name: 'Claude Opus 4.5', isDefault: true },
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude Sonnet 3.5', isDefault: false },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude Haiku 3.5', isDefault: false },
  ];

  for (const model of anthropicModels) {
    const existing = await prisma.aIModel.findFirst({
      where: { provider: 'anthropic', modelId: model.id },
    });
    if (existing) {
      console.log(`  Model anthropic/${model.id} already exists, skipping`);
      continue;
    }

    await prisma.aIModel.create({
      data: {
        provider: 'anthropic',
        modelId: model.id,
        displayName: model.name,
        isDefault: model.isDefault,
        config: { contextWindow: 200000 },
      },
    });
    console.log(`  Created model: anthropic/${model.id}`);
  }

  // XAI models
  if (config.models?.providers?.xai) {
    const xaiModels = config.models.providers.xai.models || [];
    for (const model of xaiModels) {
      const existing = await prisma.aIModel.findFirst({
        where: { provider: 'xai', modelId: model.id },
      });
      if (existing) {
        console.log(`  Model xai/${model.id} already exists, skipping`);
        continue;
      }

      await prisma.aIModel.create({
        data: {
          provider: 'xai',
          modelId: model.id,
          displayName: model.name,
          isDefault: false,
          config: {
            contextWindow: model.contextWindow,
            maxTokens: model.maxTokens,
            reasoning: model.reasoning || false,
          },
        },
      });
      console.log(`  Created model: xai/${model.id}`);
    }
  }
}

async function main() {
  console.log('BobBot Mission Control - Data Import');
  console.log('====================================');

  try {
    await importAgents();
    await importFiles();
    await importCronJobs();
    await importModels();

    // Print summary
    const agentCount = await prisma.agent.count();
    const fileCount = await prisma.fileVersion.count();
    const cronCount = await prisma.cronJob.count();
    const modelCount = await prisma.aIModel.count();

    console.log('\n=== Import Complete ===');
    console.log(`  Agents:       ${agentCount}`);
    console.log(`  File versions: ${fileCount}`);
    console.log(`  Cron jobs:    ${cronCount}`);
    console.log(`  AI Models:    ${modelCount}`);
  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
