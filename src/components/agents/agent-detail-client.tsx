'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Bot,
  Cpu,
  Edit2,
  Loader2,
  Save,
  Trash2,
  ListTodo,
  FileText,
  Clock,
  FolderKanban,
  Sparkles,
  Search,
  X,
  MessageSquare,
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
} from '@/components/ui/dialog';
import { formatDate } from '@/lib/utils';
import { AgentEditor } from '@/components/agents/agent-editor';

interface ModelInfo {
  id: string;
  provider: string;
  modelId: string;
  displayName: string;
}

interface DiscordChannelInfo {
  id: string;
  channelId: string;
  name: string;
}

interface AgentData {
  id: string;
  name: string;
  description: string | null;
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  modelId: string | null;
  model: ModelInfo | null;
  discordChannelId: string | null;
  discordChannel: DiscordChannelInfo | null;
  createdAt: string;
  updatedAt: string;
  _count: {
    tasks: number;
    fileVersions: number;
    cronJobs: number;
    projects: number;
  };
}

interface FileData {
  filePath: string;
  content: string;
  latestVersionId: string;
  message: string | null;
  updatedAt: string;
}

interface AgentDetailClientProps {
  agent: AgentData;
  initialFiles: FileData[];
  availableModels: ModelInfo[];
  discordChannels: DiscordChannelInfo[];
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

const statusOptions: Array<'ACTIVE' | 'PAUSED' | 'ARCHIVED'> = [
  'ACTIVE',
  'PAUSED',
  'ARCHIVED',
];

export function AgentDetailClient({
  agent: initialAgent,
  initialFiles,
  availableModels,
  discordChannels,
}: AgentDetailClientProps) {
  const router = useRouter();
  const [agent, setAgent] = useState(initialAgent);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(agent.name);
  const [editDescription, setEditDescription] = useState(
    agent.description || ''
  );
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [analyzePrompt, setAnalyzePrompt] = useState('');
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuccess, setAiSuccess] = useState<string | null>(null);
  const [files, setFiles] = useState(initialFiles);

  async function handleGenerateFiles() {
    setGenerating(true);
    setAiError(null);
    setAiSuccess(null);
    try {
      const res = await fetch(`/api/agents/${agent.id}/generate-files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId: agent.modelId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to generate files');
      }

      const data = await res.json();
      setFiles(data.files);
      setAiSuccess(`Generated ${data.count} file${data.count !== 1 ? 's' : ''} successfully`);
      router.refresh();
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Failed to generate files');
    } finally {
      setGenerating(false);
    }
  }

  async function handleAnalyzeFiles() {
    setAnalyzing(true);
    setAiError(null);
    setAiSuccess(null);
    setAnalysisResult(null);
    try {
      const res = await fetch(`/api/agents/${agent.id}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: agent.modelId,
          prompt: analyzePrompt.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to analyze files');
      }

      const data = await res.json();
      setAnalysisResult(data.analysis);
      setShowAnalysis(true);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Failed to analyze files');
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSaveDetails() {
    if (!editName.trim()) {
      setError('Agent name is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update agent');
      }

      const { agent: updated } = await res.json();
      setAgent((prev) => ({ ...prev, ...updated }));
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update agent');
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED') {
    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update status');
      }

      const { agent: updated } = await res.json();
      setAgent((prev) => ({ ...prev, ...updated }));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to update status'
      );
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete agent');
      }

      router.push('/dashboard/agents');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete agent');
      setDeleting(false);
    }
  }

  const config = statusConfig[agent.status];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href="/dashboard/agents"
          className="flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Agents
        </Link>
        <span>/</span>
        <span className="text-foreground">{agent.name}</span>
      </div>

      {/* Agent Header */}
      <Card className="card-glow">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Bot className="w-6 h-6 text-primary" />
              </div>
              <div>
                {editing ? (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="edit-name" className="text-xs">
                        Name
                      </Label>
                      <Input
                        id="edit-name"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-8"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit-desc" className="text-xs">
                        Description
                      </Label>
                      <Textarea
                        id="edit-desc"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        rows={2}
                        className="text-sm"
                      />
                    </div>
                    {error && (
                      <p className="text-sm text-destructive">{error}</p>
                    )}
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={handleSaveDetails}
                        disabled={saving}
                      >
                        {saving && (
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        )}
                        <Save className="w-3 h-3 mr-1" />
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditing(false);
                          setEditName(agent.name);
                          setEditDescription(agent.description || '');
                          setError(null);
                        }}
                        disabled={saving}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <CardTitle className="text-xl">{agent.name}</CardTitle>
                    {agent.description && (
                      <CardDescription className="mt-1">
                        {agent.description}
                      </CardDescription>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={config.className}>
                {config.label}
              </Badge>
              {!editing && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditing(true)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <ListTodo className="w-4 h-4" />
              <span>{agent._count.tasks} tasks</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <FileText className="w-4 h-4" />
              <span>{agent._count.fileVersions} file versions</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>{agent._count.cronJobs} cron jobs</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <FolderKanban className="w-4 h-4" />
              <span>{agent._count.projects} projects</span>
            </div>
            <div className="ml-auto text-muted-foreground">
              Created {formatDate(agent.createdAt)}
            </div>
          </div>

          {/* Status Switcher */}
          <div className="mt-4 flex items-center gap-2">
            <span className="text-sm text-muted-foreground mr-2">Status:</span>
            {statusOptions.map((s) => {
              const sc = statusConfig[s];
              return (
                <Button
                  key={s}
                  variant={agent.status === s ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => handleStatusChange(s)}
                  disabled={agent.status === s}
                >
                  {sc.label}
                </Button>
              );
            })}
          </div>

          {/* Model Selector */}
          <div className="mt-3 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground mr-1">Model:</span>
            <select
              value={agent.modelId || ''}
              onChange={async (e) => {
                const newModelId = e.target.value || null;
                try {
                  const res = await fetch(`/api/agents/${agent.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ modelId: newModelId }),
                  });
                  if (res.ok) {
                    const { agent: updated } = await res.json();
                    setAgent((prev) => ({ ...prev, ...updated }));
                  }
                } catch {}
              }}
              className="h-7 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">No model assigned</option>
              {availableModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.provider}/{m.displayName}
                </option>
              ))}
            </select>
            {agent.model && (
              <Badge variant="outline" className="text-xs">
                {agent.model.provider}/{agent.model.displayName}
              </Badge>
            )}
          </div>

          {/* Discord Channel Selector */}
          <div className="mt-3 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground mr-1">Discord:</span>
            <select
              value={agent.discordChannelId || ''}
              onChange={async (e) => {
                const newChannelId = e.target.value || null;
                try {
                  const res = await fetch(`/api/agents/${agent.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ discordChannelId: newChannelId }),
                  });
                  if (res.ok) {
                    const { agent: updated } = await res.json();
                    setAgent((prev) => ({ ...prev, ...updated }));
                  }
                } catch {}
              }}
              className="h-7 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">No channel assigned</option>
              {discordChannels.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  #{ch.name}
                </option>
              ))}
            </select>
            {agent.discordChannel && (
              <Badge variant="outline" className="text-xs">
                #{agent.discordChannel.name}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* AI Tools */}
      <Card className="card-glow">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            AI Tools
          </CardTitle>
          <CardDescription>
            Use AI to generate and analyze agent configuration files
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-start gap-4">
            {/* Generate Files */}
            <div className="space-y-2">
              <Button
                onClick={handleGenerateFiles}
                disabled={generating || !agent.description}
                variant="outline"
              >
                {generating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" />
                )}
                {generating ? 'Generating...' : 'Generate Files from Description'}
              </Button>
              {!agent.description && (
                <p className="text-xs text-muted-foreground">
                  Add a description to the agent first
                </p>
              )}
            </div>

            {/* Analyze Files */}
            <div className="flex-1 min-w-[300px] space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Optional: custom analysis prompt..."
                  value={analyzePrompt}
                  onChange={(e) => setAnalyzePrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAnalyzeFiles();
                  }}
                  className="h-9"
                />
                <Button
                  onClick={handleAnalyzeFiles}
                  disabled={analyzing}
                  variant="outline"
                >
                  {analyzing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4 mr-2" />
                  )}
                  {analyzing ? 'Analyzing...' : 'Analyze Files'}
                </Button>
              </div>
            </div>
          </div>
          {aiError && (
            <div className="mt-3 rounded-md bg-destructive/10 border border-destructive/30 p-3">
              <p className="text-sm text-destructive">{aiError}</p>
            </div>
          )}
          {aiSuccess && (
            <div className="mt-3 rounded-md bg-primary/10 border border-primary/30 p-3">
              <p className="text-sm text-primary">{aiSuccess}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analysis Result */}
      {showAnalysis && analysisResult && (
        <Card className="card-glow">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Analysis Result</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setShowAnalysis(false);
                  setAnalysisResult(null);
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap text-sm text-foreground">
              {analysisResult}
            </div>
          </CardContent>
        </Card>
      )}

      {/* File Editor */}
      <AgentEditor agentId={agent.id} initialFiles={files} />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Agent</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{agent.name}&rdquo;? This
              will remove the agent and disassociate all related file versions,
              tasks, and cron jobs. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Delete Agent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
