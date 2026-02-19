'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bot,
  Plus,
  ListTodo,
  FileText,
  Calendar,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { formatDate } from '@/lib/utils';

interface Agent {
  id: string;
  name: string;
  description: string | null;
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  createdAt: string | Date;
  updatedAt: string | Date;
  _count: {
    tasks: number;
    fileVersions: number;
    cronJobs: number;
    projects: number;
  };
}

interface AgentListClientProps {
  initialAgents: Agent[];
}

const statusConfig = {
  ACTIVE: {
    label: 'Active',
    className: 'bg-primary/15 text-primary border-primary/30',
  },
  PAUSED: {
    label: 'Paused',
    className: 'bg-marmalade/15 text-marmalade border-marmalade/30',
  },
  ARCHIVED: {
    label: 'Archived',
    className: 'bg-wine/15 text-wine border-wine/30',
  },
};

export function AgentListClient({ initialAgents }: AgentListClientProps) {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>(initialAgents);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentDescription, setNewAgentDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [autoGenerate, setAutoGenerate] = useState(true);

  const filteredAgents =
    filterStatus === 'ALL'
      ? agents
      : agents.filter((a) => a.status === filterStatus);

  async function handleCreateAgent() {
    if (!newAgentName.trim()) {
      setError('Agent name is required');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newAgentName.trim(),
          description: newAgentDescription.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create agent');
      }

      const { agent } = await res.json();
      setAgents((prev) => [agent, ...prev]);
      setDialogOpen(false);
      setNewAgentName('');
      setNewAgentDescription('');

      // Auto-generate files if description provided and option enabled
      if (autoGenerate && newAgentDescription.trim()) {
        fetch(`/api/agents/${agent.id}/generate-files`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }).catch(() => {}); // Fire and forget - user will see files on the detail page
      }

      router.push(`/dashboard/agents/${agent.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create agent');
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agents</h1>
          <p className="text-muted-foreground">
            Manage your AI agents and their configurations
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Agent
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Agent</DialogTitle>
              <DialogDescription>
                Add a new agent to your orchestration. You can configure files
                and tasks after creation.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="agent-name">Name</Label>
                <Input
                  id="agent-name"
                  placeholder="e.g., Code Reviewer"
                  value={newAgentName}
                  onChange={(e) => setNewAgentName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateAgent();
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="agent-description">Description</Label>
                <Textarea
                  id="agent-description"
                  placeholder="What does this agent do?"
                  value={newAgentDescription}
                  onChange={(e) => setNewAgentDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoGenerate}
                  onChange={(e) => setAutoGenerate(e.target.checked)}
                  className="rounded border-input"
                />
                <span className="text-sm flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  Auto-generate config files from description
                </span>
              </label>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateAgent} disabled={creating}>
                {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Agent
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        {['ALL', 'ACTIVE', 'PAUSED', 'ARCHIVED'].map((status) => (
          <Button
            key={status}
            variant={filterStatus === status ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterStatus(status)}
          >
            {status === 'ALL' ? 'All' : statusConfig[status as keyof typeof statusConfig].label}
            {status === 'ALL' && (
              <span className="ml-1.5 text-xs opacity-70">
                ({agents.length})
              </span>
            )}
            {status !== 'ALL' && (
              <span className="ml-1.5 text-xs opacity-70">
                ({agents.filter((a) => a.status === status).length})
              </span>
            )}
          </Button>
        ))}
      </div>

      {/* Agents Grid */}
      {filteredAgents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bot className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">No agents found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {filterStatus === 'ALL'
                ? 'Get started by creating your first agent.'
                : `No ${filterStatus.toLowerCase()} agents.`}
            </p>
            {filterStatus === 'ALL' && (
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Agent
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAgents.map((agent) => {
            const config = statusConfig[agent.status];
            return (
              <Link
                key={agent.id}
                href={`/dashboard/agents/${agent.id}`}
                className="block group"
              >
                <Card className="h-full transition-all duration-200 card-glow hover:border-primary/50">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-wine/20 flex items-center justify-center">
                          <Bot className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base group-hover:text-primary transition-colors">
                            {agent.name}
                          </CardTitle>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={config.className}
                      >
                        {config.label}
                      </Badge>
                    </div>
                    {agent.description && (
                      <CardDescription className="mt-2 line-clamp-2">
                        {agent.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <ListTodo className="w-3.5 h-3.5" />
                        <span>{agent._count.tasks} tasks</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" />
                        <span>{agent._count.fileVersions} files</span>
                      </div>
                      <div className="flex items-center gap-1.5 ml-auto">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{formatDate(agent.createdAt)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
