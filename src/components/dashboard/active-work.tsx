'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FolderKanban,
  Loader2,
  ListTodo,
  Bot,
  ChevronRight,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface TaskSummary {
  id: string;
  title: string;
  priority: string;
  column: string;
  board: string;
  assignedAgent: { id: string; name: string; status: string } | null;
  updatedAt: string;
}

interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  totalTasks: number;
  columnBreakdown: { name: string; count: number }[];
  recentTasks: TaskSummary[];
}

const priorityColors: Record<string, string> = {
  P0: 'bg-red-500/15 text-red-400 border-red-500/30',
  P1: 'bg-marmalade/15 text-marmalade border-marmalade/30',
  P2: 'bg-primary/15 text-primary border-primary/30',
  P3: 'bg-wine/15 text-wine border-wine/30',
  P4: 'bg-wine/15 text-wine border-wine/30',
};

export function ActiveWork() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/tasks');
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects);
      }
    } catch {}
    finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderKanban className="h-5 w-5" />
            Active Work
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (projects.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderKanban className="h-5 w-5" />
            Active Work
          </CardTitle>
          <CardDescription>Projects and tasks in progress</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <FolderKanban className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No projects yet</p>
            <p className="text-xs mt-1">
              Create a project to start tracking work
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderKanban className="h-5 w-5" />
          Active Work
        </CardTitle>
        <CardDescription>Projects and tasks across your boards</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {projects.map((project) => (
          <div
            key={project.id}
            className="rounded-lg border p-4 space-y-3"
          >
            {/* Project header */}
            <div className="flex items-center justify-between">
              <Link
                href={`/dashboard/projects/${project.id}`}
                className="flex items-center gap-2 hover:text-primary transition-colors"
              >
                <FolderKanban className="w-4 h-4" />
                <span className="font-medium text-sm">{project.name}</span>
                <ChevronRight className="w-3 h-3 text-muted-foreground" />
              </Link>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ListTodo className="w-3 h-3" />
                <span>{project.totalTasks} tasks</span>
              </div>
            </div>

            {/* Column breakdown pills */}
            {project.columnBreakdown.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {project.columnBreakdown
                  .filter((c) => c.count > 0)
                  .map((col) => (
                    <span
                      key={col.name}
                      className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs"
                    >
                      <span className="text-muted-foreground">{col.name}:</span>
                      <span className="font-medium">{col.count}</span>
                    </span>
                  ))}
              </div>
            )}

            {/* Recent tasks */}
            {project.recentTasks.length > 0 && (
              <div className="space-y-1.5">
                {project.recentTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-2 text-sm py-1 px-2 rounded hover:bg-muted/50 transition-colors"
                  >
                    <Badge
                      variant="outline"
                      className={`text-[10px] h-4 px-1 ${priorityColors[task.priority] || ''}`}
                    >
                      {task.priority}
                    </Badge>
                    <span className="flex-1 truncate">{task.title}</span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {task.column}
                    </span>
                    {task.assignedAgent && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                        <Bot className="w-3 h-3" />
                        {task.assignedAgent.name}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
