'use client';

import { useState, useEffect } from 'react';
import { Bot, Activity, Clock, Zap, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HeroStatusProps {
  activeAgents: number;
  totalAgents: number;
  taskCount: number;
  cronCount: number;
  modelName: string;
}

export function HeroStatus({
  activeAgents,
  totalAgents,
  taskCount,
  cronCount,
  modelName,
}: HeroStatusProps) {
  const [uptime, setUptime] = useState<string>('--');

  useEffect(() => {
    async function fetchUptime() {
      try {
        const res = await fetch('/api/system');
        if (res.ok) {
          const data = await res.json();
          setUptime(data.uptime || '--');
        }
      } catch {
        // silent
      }
    }
    fetchUptime();
    const interval = setInterval(fetchUptime, 30000);
    return () => clearInterval(interval);
  }, []);

  const stats = [
    {
      label: 'Agents',
      value: activeAgents,
      sub: `${totalAgents} total`,
      icon: Bot,
      accent: 'text-primary',
    },
    {
      label: 'Tasks',
      value: taskCount,
      sub: 'open',
      icon: Activity,
      accent: 'text-marmalade',
    },
    {
      label: 'Cron Jobs',
      value: cronCount,
      sub: 'active',
      icon: Zap,
      accent: 'text-gold',
    },
  ];

  return (
    <div className="hero-shimmer bg-card/50 border border-border rounded-xl p-5">
      <div className="flex items-center justify-between gap-6 flex-wrap">
        {/* Agent online status */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-3 h-3 rounded-full bg-green-500 pulse-online" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">Agent Online</span>
              <Radio className="w-3 h-3 text-green-500" />
            </div>
            <span className="text-xs text-muted-foreground font-mono">{modelName}</span>
          </div>
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px h-10 bg-border" />

        {/* Uptime */}
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Uptime</div>
            <div className="text-lg font-bold font-mono text-foreground">{uptime}</div>
          </div>
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px h-10 bg-border" />

        {/* Stats */}
        {stats.map((stat, idx) => (
          <div key={stat.label} className="flex items-center gap-3">
            {idx > 0 && <div className="hidden lg:block w-px h-8 bg-border/50" />}
            <stat.icon className={cn('w-4 h-4', stat.accent)} />
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">{stat.label}</div>
              <div className="flex items-baseline gap-1.5">
                <span className={cn('text-2xl font-bold font-mono', stat.accent)}>{stat.value}</span>
                <span className="text-xs text-muted-foreground">{stat.sub}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
