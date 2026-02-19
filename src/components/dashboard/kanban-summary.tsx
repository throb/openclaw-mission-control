'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ListChecks, ArrowRight, Loader2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ColumnBreakdown {
  name: string;
  count: number;
}

interface ProjectSummary {
  id: string;
  name: string;
  totalTasks: number;
  columnBreakdown: ColumnBreakdown[];
}

const COLUMN_COLORS: Record<string, string> = {
  backlog: 'bg-muted-foreground/40',
  'in progress': 'bg-primary',
  review: 'bg-yellow-500',
  done: 'bg-green-500',
};

const COLUMN_DOT_COLORS: Record<string, string> = {
  backlog: 'bg-muted-foreground/40',
  'in progress': 'bg-primary',
  review: 'bg-yellow-500',
  done: 'bg-green-500',
};

function getColumnColor(columnName: string): string {
  const key = columnName.toLowerCase();
  return COLUMN_COLORS[key] || 'bg-muted-foreground/30';
}

function getDotColor(columnName: string): string {
  const key = columnName.toLowerCase();
  return COLUMN_DOT_COLORS[key] || 'bg-muted-foreground/30';
}

export function KanbanSummary() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/tasks');
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Collect all unique column names across projects for the legend
  const allColumnNames = Array.from(
    new Set(
      projects.flatMap((p) =>
        p.columnBreakdown.filter((c) => c.count > 0).map((c) => c.name)
      )
    )
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <ListChecks className="h-4 w-4" />
          Tasks Overview
        </CardTitle>
        <Link
          href="/dashboard/projects"
          className="text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowRight className="h-4 w-4" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ListChecks className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No active projects</p>
          </div>
        ) : (
          <>
            {projects.map((project) => {
              const activeCols = project.columnBreakdown.filter(
                (c) => c.count > 0
              );
              const total = activeCols.reduce((sum, c) => sum + c.count, 0);

              return (
                <div key={project.id} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate">
                      {project.name}
                    </span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {total} {total === 1 ? 'task' : 'tasks'}
                    </span>
                  </div>
                  {total > 0 && (
                    <div className="flex h-2 rounded-full overflow-hidden gap-px">
                      {activeCols.map((col) => (
                        <div
                          key={col.name}
                          className={cn(
                            'h-full rounded-full transition-all',
                            getColumnColor(col.name)
                          )}
                          style={{
                            width: `${(col.count / total) * 100}%`,
                            minWidth: '4px',
                          }}
                          title={`${col.name}: ${col.count}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Column legend */}
            {allColumnNames.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 border-t border-border">
                {allColumnNames.map((name) => (
                  <div
                    key={name}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground"
                  >
                    <span
                      className={cn(
                        'inline-block h-2 w-2 rounded-full',
                        getDotColor(name)
                      )}
                    />
                    {name}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
