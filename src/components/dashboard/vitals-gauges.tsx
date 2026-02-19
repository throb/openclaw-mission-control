'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Server } from 'lucide-react';
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
}

const CIRCUMFERENCE = 2 * Math.PI * 45; // ~283

function getGaugeColor(percent: number): string {
  if (percent > 80) return 'hsl(4 98% 66%)'; // shimmer/red
  if (percent > 60) return 'hsl(48 100% 73%)'; // gold
  return 'hsl(26 97% 66%)'; // marmalade
}

function CircularGauge({
  percent,
  label,
  detail,
}: {
  percent: number;
  label: string;
  detail: string;
}) {
  const offset = CIRCUMFERENCE * (1 - Math.min(percent, 100) / 100);
  const color = getGaugeColor(percent);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          {/* Background ring */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="hsl(220 15% 12%)"
            strokeWidth="8"
          />
          {/* Progress ring */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            className="gauge-ring"
            style={{
              '--gauge-circumference': CIRCUMFERENCE,
              '--gauge-offset': offset,
            } as React.CSSProperties}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold font-mono" style={{ color }}>
            {Math.round(percent)}%
          </span>
        </div>
      </div>
      <div className="text-center">
        <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
        <div className="text-xs font-mono text-muted-foreground mt-0.5">{detail}</div>
      </div>
    </div>
  );
}

export function VitalsGauges() {
  const [data, setData] = useState<SystemData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/system');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading && !data) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Server className="h-4 w-4" />
            System Vitals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-around py-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="w-24 h-24 rounded-full bg-muted animate-pulse" />
                <div className="h-3 w-10 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const cpuPercent = Math.min(
    (parseFloat(data.cpu.loadAvg['1m']) / data.cpu.cores) * 100,
    100
  );

  // Pick the primary disk (prefer the largest volume)
  const disk = data.disks.length > 0
    ? data.disks.reduce((best, d) => {
        const bestSize = parseFloat(best.total);
        const dSize = parseFloat(d.total);
        return dSize > bestSize ? d : best;
      })
    : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Server className="h-4 w-4" />
          System Vitals
        </CardTitle>
        <span className="text-xs text-muted-foreground font-mono">
          {data.hostname}
        </span>
      </CardHeader>
      <CardContent>
        <div className="flex justify-around">
          <CircularGauge
            percent={cpuPercent}
            label="CPU"
            detail={`${data.cpu.cores} cores`}
          />
          <CircularGauge
            percent={data.memory.percent}
            label="RAM"
            detail={`${data.memory.used} / ${data.memory.total}`}
          />
          {disk && (
            <CircularGauge
              percent={disk.percent}
              label="Disk"
              detail={`${disk.used} / ${disk.total}`}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
