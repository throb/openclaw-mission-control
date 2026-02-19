'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Server, HardDrive, MemoryStick, Cpu, Container, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SystemData {
  hostname: string;
  uptime: string;
  cpu: {
    model: string;
    cores: number;
    loadAvg: { '1m': string; '5m': string; '15m': string };
  };
  memory: {
    total: string;
    used: string;
    free: string;
    percent: number;
  };
  disks: {
    mount: string;
    total: string;
    used: string;
    available: string;
    percent: number;
  }[];
  containers: {
    name: string;
    status: string;
    image: string;
  }[];
}

function ProgressBar({ percent, className }: { percent: number; className?: string }) {
  const color = percent > 90 ? 'bg-red-500' : percent > 75 ? 'bg-marmalade' : 'bg-primary';
  return (
    <div className={cn('h-2 rounded-full bg-muted overflow-hidden', className)}>
      <div
        className={cn('h-full rounded-full transition-all', color)}
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  );
}

export function SystemHealth() {
  const [data, setData] = useState<SystemData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/system');
      if (!res.ok) throw new Error('Failed to fetch');
      setData(await res.json());
      setError('');
    } catch {
      setError('Failed to load system stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Server className="h-4 w-4" /> System Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (loading && !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Server className="h-4 w-4" /> System Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
            <div className="h-4 bg-muted rounded w-2/3" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card className="card-glow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Server className="h-4 w-4" /> System Health
        </CardTitle>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-mono">
            {data.hostname} &middot; up {data.uptime}
          </span>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={fetchData}>
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* CPU */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">CPU</span>
              <span className="text-xs text-muted-foreground">
                {data.cpu.cores} cores
              </span>
            </div>
            <span className="text-xs font-mono text-muted-foreground">
              load {data.cpu.loadAvg['1m']} / {data.cpu.loadAvg['5m']} / {data.cpu.loadAvg['15m']}
            </span>
          </div>
          <ProgressBar percent={(parseFloat(data.cpu.loadAvg['1m']) / data.cpu.cores) * 100} />
          <p className="text-xs text-muted-foreground truncate">{data.cpu.model}</p>
        </div>

        {/* Memory */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <MemoryStick className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">Memory</span>
            </div>
            <span className="text-xs font-mono text-muted-foreground">
              {data.memory.used} / {data.memory.total} ({data.memory.percent}%)
            </span>
          </div>
          <ProgressBar percent={data.memory.percent} />
        </div>

        {/* Disks */}
        {data.disks.map((disk) => (
          <div key={disk.mount} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium font-mono">{disk.mount}</span>
              </div>
              <span className="text-xs font-mono text-muted-foreground">
                {disk.used} / {disk.total} ({disk.percent}%)
              </span>
            </div>
            <ProgressBar percent={disk.percent} />
            <p className="text-xs text-muted-foreground">{disk.available} available</p>
          </div>
        ))}

        {/* Docker containers */}
        {data.containers.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Container className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">Containers</span>
              <span className="text-xs text-muted-foreground">
                {data.containers.length} running
              </span>
            </div>
            <div className="grid gap-1.5">
              {data.containers.map((c) => (
                <div
                  key={c.name}
                  className="flex items-center justify-between rounded-md bg-muted/50 px-2.5 py-1.5 text-xs"
                >
                  <span className="font-mono font-medium">{c.name}</span>
                  <span className="text-muted-foreground truncate ml-2">{c.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
