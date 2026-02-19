'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Plus,
  Loader2,
  Sparkles,
  Send,
  Check,
  FolderKanban,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface Project {
  id: string;
  name: string;
}

interface CreatedTask {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  column: string;
  board: string;
  project: { id: string; name: string };
}

export function QuickTask() {
  const [input, setInput] = useState('');
  const [useAI, setUseAI] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCreated, setLastCreated] = useState<CreatedTask | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  async function handleSubmit() {
    if (!input.trim()) return;

    setCreating(true);
    setError(null);
    setLastCreated(null);

    try {
      const res = await fetch('/api/dashboard/quick-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: input.trim(),
          projectId: selectedProject || undefined,
          useAI,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create task');
      }

      const data = await res.json();
      setLastCreated(data.task);
      setInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setCreating(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Quick Task
        </CardTitle>
        <CardDescription>
          Describe a task and let AI flesh it out, or just type a title
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Input
            placeholder={
              useAI
                ? 'Describe what needs to be done...'
                : 'Task title...'
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            disabled={creating}
            className="flex-1"
          />
          <Button
            size="sm"
            variant={useAI ? 'default' : 'outline'}
            onClick={() => setUseAI(!useAI)}
            title={useAI ? 'AI enrichment ON' : 'AI enrichment OFF'}
            className="h-9 w-9 p-0"
          >
            <Sparkles className="w-4 h-4" />
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={creating || !input.trim()}
            className="h-9"
          >
            {creating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Project selector */}
        <div className="flex items-center gap-2">
          <FolderKanban className="w-3.5 h-3.5 text-muted-foreground" />
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="h-7 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">Auto (Quick Tasks project)</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {useAI && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              AI will expand your description
            </span>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/30 p-2">
            <p className="text-xs text-destructive">{error}</p>
          </div>
        )}

        {/* Success */}
        {lastCreated && (
          <div className="rounded-md bg-primary/10 border border-primary/30 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">
                Task created
              </span>
              <Badge variant="outline" className="text-[10px] h-4">
                {lastCreated.priority}
              </Badge>
            </div>
            <p className="text-sm font-medium">{lastCreated.title}</p>
            {lastCreated.description && (
              <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">
                {lastCreated.description}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {lastCreated.project.name} / {lastCreated.board} / {lastCreated.column}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
