'use client';

import React, { useState, useMemo } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Calendar, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CronJob {
  id: string;
  name: string;
  schedule: string; // cron expression like "0 9 * * 1-5" or "*/30 * * * *"
  enabled: boolean;
  agent: { id: string; name: string } | null;
}

interface CalendarWidgetProps {
  cronJobs: CronJob[];
}

// ---------------------------------------------------------------------------
// Preset colors assigned to jobs by index
// ---------------------------------------------------------------------------

const PRESET_COLORS = [
  { bg: 'hsl(264 50% 60%)', label: 'purple' },
  { bg: 'hsl(4 80% 60%)', label: 'coral' },
  { bg: 'hsl(170 60% 50%)', label: 'teal' },
  { bg: 'hsl(48 100% 65%)', label: 'gold' },
  { bg: 'hsl(142 60% 50%)', label: 'green' },
] as const;

// ---------------------------------------------------------------------------
// Cron parser — lightweight, no external deps
// ---------------------------------------------------------------------------

/** Expand a single cron field into an array of numeric values. */
function expandCronField(
  field: string,
  min: number,
  max: number
): number[] {
  const values = new Set<number>();

  for (const part of field.split(',')) {
    // Step: */N  or  range/N
    if (part.includes('/')) {
      const [rangePart, stepStr] = part.split('/');
      const step = parseInt(stepStr, 10);
      let start = min;
      let end = max;

      if (rangePart !== '*' && rangePart !== '') {
        if (rangePart.includes('-')) {
          const [lo, hi] = rangePart.split('-').map(Number);
          start = lo;
          end = hi;
        } else {
          start = parseInt(rangePart, 10);
        }
      }

      for (let i = start; i <= end; i += step) {
        values.add(i);
      }
    } else if (part === '*') {
      for (let i = min; i <= max; i++) {
        values.add(i);
      }
    } else if (part.includes('-')) {
      const [lo, hi] = part.split('-').map(Number);
      for (let i = lo; i <= hi; i++) {
        values.add(i);
      }
    } else {
      values.add(parseInt(part, 10));
    }
  }

  return Array.from(values).sort((a, b) => a - b);
}

interface ParsedCron {
  minutes: number[];
  hours: number[];
  daysOfWeek: number[]; // 0 = Sun … 6 = Sat
  alwaysRunning: boolean;
}

function parseCron(expression: string): ParsedCron {
  const parts = expression.trim().split(/\s+/);
  if (parts.length < 5) {
    return { minutes: [], hours: [], daysOfWeek: [], alwaysRunning: false };
  }

  const [minField, hourField, , , dowField] = parts;

  // Detect "always running": minute field is */N where N <= 30
  let alwaysRunning = false;
  if (minField.startsWith('*/')) {
    const step = parseInt(minField.split('/')[1], 10);
    if (!isNaN(step) && step <= 30) {
      alwaysRunning = true;
    }
  }

  const minutes = expandCronField(minField, 0, 59);
  const hours = expandCronField(hourField, 0, 23);
  const daysOfWeek = expandCronField(dowField, 0, 6);

  return { minutes, hours, daysOfWeek, alwaysRunning };
}

// ---------------------------------------------------------------------------
// Week helpers
// ---------------------------------------------------------------------------

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Time blocks displayed on the grid. */
const TIME_BLOCKS = [
  { label: '6a-12p', startHour: 6, endHour: 11 },
  { label: '12p-6p', startHour: 12, endHour: 17 },
  { label: '6p-11p', startHour: 18, endHour: 23 },
] as const;

function getWeekDates(today: Date): Date[] {
  const start = new Date(today);
  start.setDate(today.getDate() - today.getDay()); // Sunday
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function nameToColorIndex(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % PRESET_COLORS.length;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CalendarWidget({ cronJobs }: CalendarWidgetProps) {
  const [today] = useState(() => new Date());

  const weekDates = useMemo(() => getWeekDates(today), [today]);

  // Separate always-running jobs from plotted jobs
  const { alwaysRunning, plotted } = useMemo(() => {
    const ar: (CronJob & { colorIdx: number })[] = [];
    const pl: (CronJob & { parsed: ParsedCron; colorIdx: number })[] = [];

    cronJobs
      .filter((j) => j.enabled)
      .forEach((job, _i) => {
        const parsed = parseCron(job.schedule);
        const colorIdx = nameToColorIndex(job.name);

        if (parsed.alwaysRunning) {
          ar.push({ ...job, colorIdx });
        } else {
          pl.push({ ...job, parsed, colorIdx });
        }
      });

    return { alwaysRunning: ar, plotted: pl };
  }, [cronJobs]);

  // Build a lookup: key = `${dayOfWeek}-${blockIdx}` -> jobs[]
  const cellJobs = useMemo(() => {
    const map = new Map<string, (CronJob & { colorIdx: number })[]>();

    for (const job of plotted) {
      const { parsed, colorIdx } = job;

      for (const dow of parsed.daysOfWeek) {
        for (let bIdx = 0; bIdx < TIME_BLOCKS.length; bIdx++) {
          const block = TIME_BLOCKS[bIdx];
          // Does the job fire at any hour inside this block?
          const fires = parsed.hours.some(
            (h) => h >= block.startHour && h <= block.endHour
          );
          if (fires) {
            const key = `${dow}-${bIdx}`;
            const arr = map.get(key) ?? [];
            arr.push({ ...job, colorIdx });
            map.set(key, arr);
          }
        }
      }
    }

    return map;
  }, [plotted]);

  const todayDow = today.getDay(); // 0 = Sun

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium">This Week</CardTitle>
        </div>
        <Link
          href="/dashboard/calendar"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Full calendar
        </Link>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Always-running pills */}
        {alwaysRunning.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pb-1">
            {alwaysRunning.map((job) => (
              <span
                key={job.id}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-mono text-white/90"
                style={{ backgroundColor: PRESET_COLORS[job.colorIdx].bg }}
              >
                <span className="h-1 w-1 rounded-full bg-white/80 animate-pulse" />
                {job.name.length > 16 ? job.name.slice(0, 16) + '\u2026' : job.name}
                <span className="text-[10px] opacity-75">Always</span>
              </span>
            ))}
          </div>
        )}

        {/* Week grid */}
        <div className="grid grid-cols-[auto_repeat(7,1fr)] gap-px text-xs font-mono">
          {/* Header row — empty corner + day labels */}
          <div className="p-1" />
          {weekDates.map((date, i) => {
            const isToday = i === todayDow;
            return (
              <div
                key={i}
                className={cn(
                  'cal-cell text-center p-1 font-semibold',
                  isToday && 'bg-primary/5 rounded-t-md'
                )}
              >
                <div className="text-muted-foreground">{DAY_LABELS[i]}</div>
                <div
                  className={cn(
                    'text-[10px]',
                    isToday
                      ? 'text-primary font-bold'
                      : 'text-muted-foreground/60'
                  )}
                >
                  {date.getDate()}
                </div>
              </div>
            );
          })}

          {/* Time block rows */}
          {TIME_BLOCKS.map((block, bIdx) => (
            <React.Fragment key={`block-${bIdx}`}>
              {/* Row label */}
              <div
                className="cal-cell flex items-start justify-end pr-1.5 pt-1 text-[10px] text-muted-foreground whitespace-nowrap"
              >
                {block.label}
              </div>

              {/* Day cells */}
              {Array.from({ length: 7 }, (_, dow) => {
                const key = `${dow}-${bIdx}`;
                const jobs = cellJobs.get(key) ?? [];
                const isToday = dow === todayDow;

                return (
                  <div
                    key={key}
                    className={cn(
                      'cal-cell min-h-[2.25rem] border border-border/40 rounded-sm p-0.5 flex flex-col gap-0.5 overflow-hidden',
                      isToday && 'bg-primary/5'
                    )}
                  >
                    {jobs.slice(0, 3).map((job) => (
                      <span
                        key={job.id}
                        title={job.name}
                        className="block truncate rounded px-1 py-px text-[10px] leading-tight text-white/90"
                        style={{
                          backgroundColor: PRESET_COLORS[job.colorIdx].bg,
                        }}
                      >
                        {job.name.length > 8
                          ? job.name.slice(0, 8) + '\u2026'
                          : job.name}
                      </span>
                    ))}
                    {jobs.length > 3 && (
                      <span className="text-[9px] text-muted-foreground text-center">
                        +{jobs.length - 3}
                      </span>
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </CardContent>

      <CardFooter className="pt-0">
        <Link
          href="/dashboard/calendar"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          View full calendar
          <ArrowRight className="h-3 w-3" />
        </Link>
      </CardFooter>
    </Card>
  );
}
