'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn, formatDateTime } from '@/lib/utils';
import {
  Clock,
  Plus,
  Pencil,
  Trash2,
  Play,
  Pause,
  X,
  Loader2,
  AlertCircle,
} from 'lucide-react';

// ----- Types -----

interface Agent {
  id: string;
  name: string;
  status: string;
}

interface CronJob {
  id: string;
  name: string;
  schedule: string;
  payload: Record<string, unknown>;
  agentId: string | null;
  agent: Agent | null;
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
  openclawJobId: string | null;
}

// ----- Cron description helper -----

function describeCron(expression: string): string {
  const parts = expression.trim().split(/\s+/);
  if (parts.length < 5) return expression;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // Common patterns
  if (minute === '*' && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return 'Every minute';
  }
  if (hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    if (minute?.startsWith('*/')) {
      return `Every ${minute.slice(2)} minutes`;
    }
    if (minute && /^\d+$/.test(minute)) {
      return `Every hour at minute ${minute}`;
    }
  }
  if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    if (minute?.startsWith('*/') && hour === '*') {
      return `Every ${minute.slice(2)} minutes`;
    }
    if (hour?.startsWith('*/') && minute === '0') {
      return `Every ${hour.slice(2)} hours`;
    }
    if (/^\d+$/.test(minute || '') && /^\d+$/.test(hour || '')) {
      const h = parseInt(hour!, 10);
      const m = parseInt(minute!, 10);
      const period = h >= 12 ? 'PM' : 'AM';
      const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
      return `Daily at ${displayH}:${m.toString().padStart(2, '0')} ${period}`;
    }
  }
  if (month === '*' && /^\d+$/.test(minute || '') && /^\d+$/.test(hour || '')) {
    if (dayOfMonth === '*' && dayOfWeek !== '*') {
      const days: Record<string, string> = {
        '0': 'Sunday', '1': 'Monday', '2': 'Tuesday',
        '3': 'Wednesday', '4': 'Thursday', '5': 'Friday', '6': 'Saturday',
        '7': 'Sunday',
      };
      const h = parseInt(hour!, 10);
      const m = parseInt(minute!, 10);
      const period = h >= 12 ? 'PM' : 'AM';
      const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const dayName = days[dayOfWeek!] || `day ${dayOfWeek}`;
      return `Every ${dayName} at ${displayH}:${m.toString().padStart(2, '0')} ${period}`;
    }
  }

  return expression;
}

// ----- Form component -----

interface CronFormData {
  name: string;
  schedule: string;
  payload: string;
  agentId: string;
  enabled: boolean;
}

function CronJobForm({
  initialData,
  agents,
  onSubmit,
  onCancel,
  isSubmitting,
}: {
  initialData?: CronJob;
  agents: Agent[];
  onSubmit: (data: CronFormData) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}) {
  const [formData, setFormData] = useState<CronFormData>({
    name: initialData?.name || '',
    schedule: initialData?.schedule || '',
    payload: initialData?.payload ? JSON.stringify(initialData.payload, null, 2) : '{}',
    agentId: initialData?.agentId || '',
    enabled: initialData?.enabled ?? true,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          {initialData ? 'Edit Cron Job' : 'New Cron Job'}
        </CardTitle>
        <CardDescription>
          {initialData
            ? 'Update the cron job configuration'
            : 'Create a new scheduled cron job'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(formData);
          }}
          className="space-y-4"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="e.g. Daily Agent Sync"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="schedule">Schedule (cron expression)</Label>
              <Input
                id="schedule"
                placeholder="e.g. */5 * * * *"
                value={formData.schedule}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, schedule: e.target.value }))
                }
                required
              />
              {formData.schedule && (
                <p className="text-xs text-muted-foreground">
                  {describeCron(formData.schedule)}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="agent">Agent (optional)</Label>
              <select
                id="agent"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={formData.agentId}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, agentId: e.target.value }))
                }
              >
                <option value="">No agent</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Enabled</Label>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, enabled: !prev.enabled }))
                  }
                  className={cn(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    formData.enabled ? 'bg-primary' : 'bg-muted'
                  )}
                >
                  <span
                    className={cn(
                      'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                      formData.enabled ? 'translate-x-6' : 'translate-x-1'
                    )}
                  />
                </button>
                <span className="ml-2 text-sm text-muted-foreground">
                  {formData.enabled ? 'Active' : 'Disabled'}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payload">Payload (JSON)</Label>
            <textarea
              id="payload"
              rows={4}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={formData.payload}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, payload: e.target.value }))
              }
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {initialData ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ----- Main page component -----

export default function CronJobsPage() {
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingJob, setEditingJob] = useState<CronJob | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchCronJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/cron');
      if (!res.ok) throw new Error('Failed to fetch cron jobs');
      const data = await res.json();
      setCronJobs(data.cronJobs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cron jobs');
    }
  }, []);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/agents');
      if (!res.ok) throw new Error('Failed to fetch agents');
      const data = await res.json();
      setAgents(data.agents);
    } catch {
      // Non-critical, agents are optional for cron jobs
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchCronJobs(), fetchAgents()]).finally(() =>
      setLoading(false)
    );
  }, [fetchCronJobs, fetchAgents]);

  async function handleSubmit(formData: CronFormData) {
    setIsSubmitting(true);
    setError(null);

    try {
      // Parse the JSON payload
      let payload: unknown;
      try {
        payload = JSON.parse(formData.payload);
      } catch {
        setError('Invalid JSON in payload field');
        setIsSubmitting(false);
        return;
      }

      const body = {
        name: formData.name,
        schedule: formData.schedule,
        payload,
        agentId: formData.agentId || null,
        enabled: formData.enabled,
      };

      let res: Response;
      if (editingJob) {
        res = await fetch(`/api/cron/${editingJob.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch('/api/cron', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save cron job');
      }

      setShowForm(false);
      setEditingJob(null);
      await fetchCronJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save cron job');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggleEnabled(job: CronJob) {
    try {
      const res = await fetch(`/api/cron/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !job.enabled }),
      });
      if (!res.ok) throw new Error('Failed to toggle cron job');
      await fetchCronJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle cron job');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this cron job?')) return;

    setDeletingId(id);
    try {
      const res = await fetch(`/api/cron/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete cron job');
      await fetchCronJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete cron job');
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cron Jobs</h1>
          <p className="text-muted-foreground">Manage scheduled tasks</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cron Jobs</h1>
          <p className="text-muted-foreground">
            Manage scheduled tasks and automation
          </p>
        </div>
        {!showForm && !editingJob && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Cron Job
          </Button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <p>{error}</p>
          <button
            onClick={() => setError(null)}
            className="ml-auto"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Create / Edit form */}
      {(showForm || editingJob) && (
        <CronJobForm
          initialData={editingJob || undefined}
          agents={agents}
          onSubmit={handleSubmit}
          onCancel={() => {
            setShowForm(false);
            setEditingJob(null);
          }}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Cron jobs table */}
      <Card className="card-glow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Scheduled Jobs
          </CardTitle>
          <CardDescription>
            {cronJobs.length} cron job{cronJobs.length !== 1 ? 's' : ''} configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cronJobs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium">No cron jobs yet</p>
              <p className="text-sm mt-1">
                Create your first scheduled job to get started
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Name
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Schedule
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Agent
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Last Run
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Next Run
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cronJobs.map((job) => (
                    <tr
                      key={job.id}
                      className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="font-medium">{job.name}</div>
                        {job.openclawJobId && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            OC: {job.openclawJobId}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm">
                          {describeCron(job.schedule)}
                        </div>
                        <code className="text-xs text-muted-foreground font-mono">
                          {job.schedule}
                        </code>
                      </td>
                      <td className="py-3 px-4">
                        {job.agent ? (
                          <span className="inline-flex items-center rounded-md bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-400 ring-1 ring-inset ring-blue-500/20">
                            {job.agent.name}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            --
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleToggleEnabled(job)}
                          className={cn(
                            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                            job.enabled ? 'bg-primary' : 'bg-muted'
                          )}
                          title={job.enabled ? 'Click to disable' : 'Click to enable'}
                        >
                          <span
                            className={cn(
                              'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                              job.enabled
                                ? 'translate-x-6'
                                : 'translate-x-1'
                            )}
                          />
                        </button>
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {job.lastRunAt
                          ? formatDateTime(job.lastRunAt)
                          : 'Never'}
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {job.nextRunAt
                          ? formatDateTime(job.nextRunAt)
                          : '--'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingJob(job);
                              setShowForm(false);
                            }}
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleEnabled(job)}
                            title={
                              job.enabled ? 'Pause' : 'Resume'
                            }
                          >
                            {job.enabled ? (
                              <Pause className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(job.id)}
                            disabled={deletingId === job.id}
                            title="Delete"
                            className="text-destructive hover:text-destructive"
                          >
                            {deletingId === job.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
