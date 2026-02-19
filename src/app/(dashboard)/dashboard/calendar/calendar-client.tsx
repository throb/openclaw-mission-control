'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CronJobData {
  id: string;
  name: string;
  schedule: string;
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  agent: { id: string; name: string } | null;
}

interface CalendarClientProps {
  cronJobs: CronJobData[];
}

// Preset colors for jobs
const JOB_COLORS = [
  { bg: 'hsl(264 50% 60%)', text: 'text-purple-300', label: 'purple' },
  { bg: 'hsl(4 80% 60%)', text: 'text-red-300', label: 'coral' },
  { bg: 'hsl(170 60% 50%)', text: 'text-teal-300', label: 'teal' },
  { bg: 'hsl(48 100% 65%)', text: 'text-yellow-300', label: 'gold' },
  { bg: 'hsl(142 60% 50%)', text: 'text-green-300', label: 'green' },
  { bg: 'hsl(26 97% 66%)', text: 'text-orange-300', label: 'marmalade' },
] as const;

function nameToColorIdx(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % JOB_COLORS.length;
}

// Cron parser
function expandField(field: string, min: number, max: number): number[] {
  const vals = new Set<number>();
  for (const part of field.split(',')) {
    if (part.includes('/')) {
      const [rangePart, stepStr] = part.split('/');
      const step = parseInt(stepStr, 10);
      let start = min, end = max;
      if (rangePart !== '*' && rangePart !== '') {
        if (rangePart.includes('-')) {
          const [lo, hi] = rangePart.split('-').map(Number);
          start = lo; end = hi;
        } else {
          start = parseInt(rangePart, 10);
        }
      }
      for (let i = start; i <= end; i += step) vals.add(i);
    } else if (part === '*') {
      for (let i = min; i <= max; i++) vals.add(i);
    } else if (part.includes('-')) {
      const [lo, hi] = part.split('-').map(Number);
      for (let i = lo; i <= hi; i++) vals.add(i);
    } else {
      vals.add(parseInt(part, 10));
    }
  }
  return Array.from(vals).sort((a, b) => a - b);
}

interface ParsedCron {
  minutes: number[];
  hours: number[];
  daysOfWeek: number[];
  alwaysRunning: boolean;
  frequency: string;
}

function parseCron(expr: string): ParsedCron {
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5) {
    return { minutes: [], hours: [], daysOfWeek: [], alwaysRunning: false, frequency: '' };
  }
  const [minField, hourField, , , dowField] = parts;

  let alwaysRunning = false;
  let frequency = '';
  if (minField.startsWith('*/')) {
    const step = parseInt(minField.split('/')[1], 10);
    if (!isNaN(step) && step <= 30) {
      alwaysRunning = true;
      frequency = `Every ${step} min`;
    }
  }

  return {
    minutes: expandField(minField, 0, 59),
    hours: expandField(hourField, 0, 23),
    daysOfWeek: expandField(dowField, 0, 6),
    alwaysRunning,
    frequency,
  };
}

function formatHour(h: number): string {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 6am to 11pm

function getWeekDates(today: Date): Date[] {
  const start = new Date(today);
  start.setDate(today.getDate() - today.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export function CalendarClient({ cronJobs }: CalendarClientProps) {
  const [view, setView] = useState<'week' | 'today'>('week');
  const [today] = useState(() => new Date());
  const weekDates = useMemo(() => getWeekDates(today), [today]);
  const todayDow = today.getDay();

  const parsed = useMemo(() => {
    return cronJobs
      .filter((j) => j.enabled)
      .map((j) => ({
        ...j,
        parsed: parseCron(j.schedule),
        colorIdx: nameToColorIdx(j.name),
      }));
  }, [cronJobs]);

  const alwaysRunning = parsed.filter((j) => j.parsed.alwaysRunning);
  const scheduled = parsed.filter((j) => !j.parsed.alwaysRunning);

  // Build cell lookup: `${dow}-${hour}` => jobs
  const cellJobs = useMemo(() => {
    const map = new Map<string, typeof scheduled>();
    for (const job of scheduled) {
      const days = view === 'today' ? [todayDow] : job.parsed.daysOfWeek;
      for (const dow of days) {
        for (const h of job.parsed.hours) {
          if (h < 6 || h > 23) continue;
          const key = `${dow}-${h}`;
          const arr = map.get(key) ?? [];
          arr.push(job);
          map.set(key, arr);
        }
      }
    }
    return map;
  }, [scheduled, view, todayDow]);

  // Upcoming: next 5 scheduled jobs
  const upcoming = useMemo(() => {
    const nowH = today.getHours();
    const items: { job: (typeof scheduled)[0]; dow: number; hour: number }[] = [];

    for (const job of scheduled) {
      for (const dow of job.parsed.daysOfWeek) {
        for (const h of job.parsed.hours) {
          // Only show future times today or upcoming days
          if (dow > todayDow || (dow === todayDow && h > nowH)) {
            items.push({ job, dow, hour: h });
          }
        }
      }
    }
    items.sort((a, b) => {
      if (a.dow !== b.dow) return a.dow - b.dow;
      return a.hour - b.hour;
    });
    return items.slice(0, 8);
  }, [scheduled, todayDow, today]);

  const displayDays = view === 'today' ? [todayDow] : [0, 1, 2, 3, 4, 5, 6];

  return (
    <div className="space-y-6">
      {/* View toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {cronJobs.filter((j) => j.enabled).length} active routines
          </span>
        </div>
        <div className="flex rounded-lg bg-card border border-border overflow-hidden">
          <button
            onClick={() => setView('week')}
            className={cn(
              'px-4 py-1.5 text-sm font-medium transition-colors',
              view === 'week'
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Week
          </button>
          <button
            onClick={() => setView('today')}
            className={cn(
              'px-4 py-1.5 text-sm font-medium transition-colors',
              view === 'today'
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Today
          </button>
        </div>
      </div>

      {/* Always Running Section */}
      {alwaysRunning.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Always Running
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {alwaysRunning.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-mono text-white/90"
                  style={{ backgroundColor: JOB_COLORS[job.colorIdx].bg }}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-white/80 animate-pulse" />
                  <span>{job.name}</span>
                  <span className="text-[10px] opacity-70">{job.parsed.frequency}</span>
                  {job.agent && (
                    <span className="text-[10px] opacity-60">({job.agent.name})</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-4 overflow-x-auto">
          <div
            className="grid gap-px text-xs font-mono"
            style={{
              gridTemplateColumns: `60px repeat(${displayDays.length}, minmax(100px, 1fr))`,
            }}
          >
            {/* Header row */}
            <div className="p-2" />
            {displayDays.map((dow) => {
              const isToday = dow === todayDow;
              const date = weekDates[dow];
              return (
                <div
                  key={dow}
                  className={cn(
                    'cal-cell text-center p-2 font-semibold rounded-t-lg',
                    isToday && 'bg-primary/8'
                  )}
                >
                  <div className={cn(isToday ? 'text-primary' : 'text-muted-foreground')}>
                    {DAY_LABELS[dow]}
                  </div>
                  <div
                    className={cn(
                      'text-lg mt-0.5',
                      isToday ? 'text-primary font-bold' : 'text-foreground/60'
                    )}
                  >
                    {date?.getDate()}
                  </div>
                </div>
              );
            })}

            {/* Hour rows */}
            {HOURS.map((hour) => (
              <React.Fragment key={`hour-${hour}`}>
                <div
                  className="flex items-start justify-end pr-2 pt-1 text-[11px] text-muted-foreground whitespace-nowrap h-10"
                >
                  {formatHour(hour)}
                </div>
                {displayDays.map((dow) => {
                  const key = `${dow}-${hour}`;
                  const jobs = cellJobs.get(key) ?? [];
                  const isToday = dow === todayDow;
                  const isNow = isToday && hour === today.getHours();

                  return (
                    <div
                      key={key}
                      className={cn(
                        'cal-cell min-h-[2.5rem] border border-border/30 rounded-sm p-0.5 flex flex-col gap-0.5',
                        isToday && 'bg-primary/5',
                        isNow && 'ring-1 ring-primary/30'
                      )}
                    >
                      {jobs.map((job) => (
                        <div
                          key={job.id}
                          title={`${job.name} (${job.schedule})`}
                          className="truncate rounded px-1.5 py-0.5 text-[11px] leading-tight text-white/90"
                          style={{ backgroundColor: JOB_COLORS[job.colorIdx].bg }}
                        >
                          {job.name}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Next Up Section */}
      {upcoming.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Next Up
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {upcoming.map((item, idx) => (
                <div
                  key={`${item.job.id}-${item.dow}-${item.hour}-${idx}`}
                  className="flex items-center gap-3 py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: JOB_COLORS[item.job.colorIdx].bg }}
                  />
                  <span className="text-sm font-medium flex-1 truncate">
                    {item.job.name}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {DAY_LABELS[item.dow]} {formatHour(item.hour)}
                  </span>
                  {item.job.agent && (
                    <span className="text-xs text-muted-foreground">
                      {item.job.agent.name}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
