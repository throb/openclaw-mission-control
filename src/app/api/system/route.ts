import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import os from 'os';
import { requireAuth } from '@/lib/auth';

function execQuiet(cmd: string): string {
  try {
    return execSync(cmd, { timeout: 5000 }).toString().trim();
  } catch {
    return '';
  }
}

function parseBytes(bytes: number): string {
  if (bytes >= 1e12) return (bytes / 1e12).toFixed(1) + ' TB';
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + ' GB';
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + ' MB';
  return (bytes / 1e3).toFixed(1) + ' KB';
}

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { authorized } = await requireAuth();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // CPU
    const cpus = os.cpus();
    const cpuModel = cpus[0]?.model || 'Unknown';
    const cpuCores = cpus.length;
    const loadAvg = os.loadavg();

    // Memory
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memPercent = Math.round((usedMem / totalMem) * 100);

    // Disk - check both root and the volume
    const disks: { mount: string; total: string; used: string; available: string; percent: number }[] = [];
    const dfOutput = execQuiet('df -B1 / /mnt/HC_Volume_104679608 2>/dev/null');
    if (dfOutput) {
      const lines = dfOutput.split('\n').slice(1);
      const seen = new Set<string>();
      for (const line of lines) {
        const parts = line.split(/\s+/);
        if (parts.length >= 6) {
          const device = parts[0];
          if (seen.has(device)) continue;
          seen.add(device);
          const total = parseInt(parts[1]);
          const used = parseInt(parts[2]);
          const available = parseInt(parts[3]);
          const mount = parts[5];
          disks.push({
            mount,
            total: parseBytes(total),
            used: parseBytes(used),
            available: parseBytes(available),
            percent: Math.round((used / total) * 100),
          });
        }
      }
    }

    // Uptime
    const uptimeSec = os.uptime();
    const days = Math.floor(uptimeSec / 86400);
    const hours = Math.floor((uptimeSec % 86400) / 3600);
    const uptime = days > 0 ? `${days}d ${hours}h` : `${hours}h`;

    // Docker containers
    const dockerOutput = execQuiet('docker ps --format "{{.Names}}|{{.Status}}|{{.Image}}" 2>/dev/null');
    const containers = dockerOutput
      ? dockerOutput.split('\n').filter(Boolean).map(line => {
          const [name, status, image] = line.split('|');
          return { name, status, image };
        })
      : [];

    // Hostname
    const hostname = os.hostname();

    return NextResponse.json({
      hostname,
      uptime,
      cpu: {
        model: cpuModel.replace(/\s+/g, ' ').trim(),
        cores: cpuCores,
        loadAvg: {
          '1m': loadAvg[0].toFixed(2),
          '5m': loadAvg[1].toFixed(2),
          '15m': loadAvg[2].toFixed(2),
        },
      },
      memory: {
        total: parseBytes(totalMem),
        used: parseBytes(usedMem),
        free: parseBytes(freeMem),
        percent: memPercent,
      },
      disks,
      containers,
    });
  } catch (error) {
    console.error('System stats error:', error);
    return NextResponse.json({ error: 'Failed to get system stats' }, { status: 500 });
  }
}
