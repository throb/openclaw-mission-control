'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AuditEntry {
  id: string;
  action: string;
  target: string | null;
  createdAt: string;
  user?: { id: string; email: string } | null;
}

const ACTION_COLORS: Record<string, string> = {
  task: 'bg-blue-500',
  agent: 'bg-green-500',
  model: 'bg-purple-500',
  cron: 'bg-yellow-500',
  project: 'bg-primary',
  skill: 'bg-teal-500',
  session: 'bg-ice',
};

function getActionDotColor(action: string): string {
  const prefix = action.split('.')[0];
  return ACTION_COLORS[prefix] || 'bg-muted-foreground/50';
}

function formatAction(action: string): string {
  const parts = action.split('.');
  if (parts.length >= 2) {
    const entity = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    const verbMap: Record<string, string> = {
      create: 'created',
      update: 'updated',
      delete: 'deleted',
      view: 'viewed',
      login: 'logged in',
      logout: 'logged out',
      enable: 'enabled',
      disable: 'disabled',
      pause: 'paused',
      resume: 'resumed',
      archive: 'archived',
      trigger: 'triggered',
      move: 'moved',
    };
    return `${entity} ${verbMap[parts[1]] || parts[1]}`;
  }
  return action;
}

function relativeTime(date: string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diff = Math.max(0, now - then);
  const seconds = Math.floor(diff / 1000);

  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function LiveFeed() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>('--');
  const prevIdsRef = useRef<Set<string>>(new Set());
  const [newIds, setNewIds] = useState<Set<string>>(new Set());

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch('/api/audit?limit=20');
      if (!res.ok) return;
      const data = await res.json();
      const logs: AuditEntry[] = data.auditLogs || [];

      // Detect new entries for animation
      const ids = logs.map((l) => l.id);
      const currentIds = new Set(ids);
      const fresh = new Set<string>();
      ids.forEach((id) => {
        if (!prevIdsRef.current.has(id)) {
          fresh.add(id);
        }
      });
      prevIdsRef.current = currentIds;
      setNewIds(fresh);

      setEntries(logs);
      setLastUpdated('just now');
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchEntries();
    const interval = setInterval(fetchEntries, 5000);
    return () => clearInterval(interval);
  }, [fetchEntries]);

  // Update "last updated" display periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdated((prev) => {
        if (prev === 'just now') return '5s ago';
        return prev;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Live Activity
          <span className="relative flex h-2 w-2 ml-1">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
          </span>
        </CardTitle>
        <span className="text-xs text-muted-foreground font-mono">
          Updated {lastUpdated}
        </span>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            No activity recorded yet
          </div>
        ) : (
          <div className="max-h-[400px] overflow-y-auto space-y-1 pr-1">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className={cn(
                  'flex items-center gap-3 py-1.5 px-2 rounded-md transition-colors hover:bg-muted/50',
                  newIds.has(entry.id) && 'feed-entry'
                )}
              >
                <span
                  className={cn(
                    'w-2 h-2 rounded-full flex-shrink-0',
                    getActionDotColor(entry.action)
                  )}
                />
                <span className="text-xs font-mono text-muted-foreground w-16 flex-shrink-0">
                  {relativeTime(entry.createdAt)}
                </span>
                <span className="text-sm font-medium truncate">
                  {formatAction(entry.action)}
                </span>
                {entry.target && (
                  <span className="text-xs text-muted-foreground truncate ml-auto">
                    {entry.target}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
