'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { formatDateTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Settings,
  Shield,
  Info,
  Loader2,
  User,
  Globe,
  Activity,
  MessageSquare,
  Plus,
  Trash2,
} from 'lucide-react';

// ----- Types -----

interface DiscordChannel {
  id: string;
  channelId: string;
  guildId: string;
  name: string;
  webhookUrl: string | null;
  _count?: { agents: number };
}

interface AuditLogUser {
  id: string;
  email: string;
}

interface AuditLogEntry {
  id: string;
  userId: string | null;
  user: AuditLogUser | null;
  action: string;
  target: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

// ----- Audit log action badge color mapping -----

function getActionColor(action: string): string {
  if (action.includes('delete') || action.includes('remove'))
    return 'text-red-400 bg-red-500/10 ring-red-500/20';
  if (action.includes('create') || action.includes('add'))
    return 'text-primary bg-primary/10 ring-primary/20';
  if (action.includes('view') || action.includes('reveal'))
    return 'text-marmalade bg-marmalade/10 ring-marmalade/20';
  if (action.includes('update') || action.includes('edit'))
    return 'text-gold bg-gold/10 ring-gold/20';
  return 'text-wine bg-wine/10 ring-wine/20';
}

// ----- Main page component -----

export default function SettingsPage() {
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  // Discord channel state
  const [discordChannels, setDiscordChannels] = useState<DiscordChannel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelId, setNewChannelId] = useState('');
  const [newGuildId, setNewGuildId] = useState('');
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [savingChannel, setSavingChannel] = useState(false);
  const [channelError, setChannelError] = useState<string | null>(null);

  const fetchDiscordChannels = useCallback(async () => {
    try {
      const res = await fetch('/api/discord-channels');
      if (!res.ok) throw new Error('Failed to fetch channels');
      const data = await res.json();
      setDiscordChannels(data.channels);
    } catch {
      // Non-critical
    } finally {
      setLoadingChannels(false);
    }
  }, []);

  async function handleAddChannel() {
    if (!newChannelName.trim() || !newChannelId.trim() || !newGuildId.trim()) {
      setChannelError('Name, Channel ID, and Guild ID are required');
      return;
    }
    setSavingChannel(true);
    setChannelError(null);
    try {
      const res = await fetch('/api/discord-channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newChannelName.trim(),
          channelId: newChannelId.trim(),
          guildId: newGuildId.trim(),
          webhookUrl: newWebhookUrl.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create channel');
      }
      const { channel } = await res.json();
      setDiscordChannels((prev) => [...prev, channel]);
      setShowAddChannel(false);
      setNewChannelName('');
      setNewChannelId('');
      setNewGuildId('');
      setNewWebhookUrl('');
    } catch (err) {
      setChannelError(err instanceof Error ? err.message : 'Failed to create channel');
    } finally {
      setSavingChannel(false);
    }
  }

  async function handleDeleteChannel(id: string) {
    if (!confirm('Delete this Discord channel mapping?')) return;
    try {
      const res = await fetch(`/api/discord-channels/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setDiscordChannels((prev) => prev.filter((c) => c.id !== id));
      }
    } catch {}
  }

  const fetchAuditLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/audit?limit=20');
      if (!res.ok) throw new Error('Failed to fetch audit logs');
      const data = await res.json();
      setAuditLogs(data.auditLogs);
    } catch {
      // Non-critical, logs section will show empty state
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    fetchAuditLogs();
    fetchDiscordChannels();
  }, [fetchAuditLogs, fetchDiscordChannels]);

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Application configuration and system information
        </p>
      </div>

      {/* General section */}
      <Card className="card-glow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            General
          </CardTitle>
          <CardDescription>
            Application information and configuration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Application</span>
                </div>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Name</dt>
                    <dd className="font-medium">BobBot Mission Control</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Port</dt>
                    <dd className="font-mono">18742</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Environment</dt>
                    <dd className="font-mono">
                      {process.env.NODE_ENV || 'development'}
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Status</span>
                </div>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Server</dt>
                    <dd>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-primary" />
                        Running
                      </span>
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Database</dt>
                    <dd>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-primary" />
                        Connected
                      </span>
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Auth</dt>
                    <dd>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-primary" />
                        Active
                      </span>
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Discord Channels */}
      <Card className="card-glow">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Discord Channels
              </CardTitle>
              <CardDescription>
                Configure Discord channels for agent output
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowAddChannel(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Add Channel
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingChannels ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : discordChannels.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No Discord channels configured</p>
              <p className="text-xs mt-1">Add a channel to enable agent Discord output</p>
            </div>
          ) : (
            <div className="space-y-2">
              {discordChannels.map((ch) => (
                <div
                  key={ch.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">#{ch.name}</span>
                      {ch._count && ch._count.agents > 0 && (
                        <span className="text-xs text-muted-foreground">
                          ({ch._count.agents} agent{ch._count.agents !== 1 ? 's' : ''})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                      <span>Channel: {ch.channelId}</span>
                      <span>Guild: {ch.guildId}</span>
                      {ch.webhookUrl && <span className="text-primary">Webhook set</span>}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDeleteChannel(ch.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Channel Dialog */}
      <Dialog open={showAddChannel} onOpenChange={setShowAddChannel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Discord Channel</DialogTitle>
            <DialogDescription>
              Configure a Discord channel for agent output. You can find channel and guild IDs in Discord Developer Mode.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="ch-name">Channel Name</Label>
              <Input
                id="ch-name"
                placeholder="e.g., agent-output"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="ch-id">Channel ID</Label>
                <Input
                  id="ch-id"
                  placeholder="Discord channel snowflake"
                  value={newChannelId}
                  onChange={(e) => setNewChannelId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guild-id">Guild ID</Label>
                <Input
                  id="guild-id"
                  placeholder="Discord server snowflake"
                  value={newGuildId}
                  onChange={(e) => setNewGuildId(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="webhook-url">Webhook URL (optional)</Label>
              <Input
                id="webhook-url"
                placeholder="https://discord.com/api/webhooks/..."
                value={newWebhookUrl}
                onChange={(e) => setNewWebhookUrl(e.target.value)}
              />
            </div>
            {channelError && (
              <p className="text-sm text-destructive">{channelError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddChannel(false);
                setChannelError(null);
              }}
              disabled={savingChannel}
            >
              Cancel
            </Button>
            <Button onClick={handleAddChannel} disabled={savingChannel}>
              {savingChannel && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add Channel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Security section - Audit Logs */}
      <Card className="card-glow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security - Recent Audit Logs
          </CardTitle>
          <CardDescription>
            Last 20 security-relevant events
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingLogs ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No audit logs recorded yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">
                      Time
                    </th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">
                      Action
                    </th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">
                      User
                    </th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">
                      Target
                    </th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">
                      IP Address
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                    >
                      <td className="py-2 px-3 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${getActionColor(log.action)}`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-xs">
                        {log.user ? (
                          <span className="inline-flex items-center gap-1">
                            <User className="h-3 w-3 text-muted-foreground" />
                            {log.user.email}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            System
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-xs font-mono text-muted-foreground">
                        {log.target || '--'}
                      </td>
                      <td className="py-2 px-3 text-xs font-mono text-muted-foreground">
                        {log.ipAddress || '--'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* About section */}
      <Card className="card-glow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            About
          </CardTitle>
          <CardDescription>
            Version and system information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between border-b border-border/50 pb-2">
              <dt className="text-muted-foreground">Version</dt>
              <dd className="font-mono font-medium">0.1.0</dd>
            </div>
            <div className="flex justify-between border-b border-border/50 pb-2">
              <dt className="text-muted-foreground">Framework</dt>
              <dd className="font-mono">Next.js 14 (App Router)</dd>
            </div>
            <div className="flex justify-between border-b border-border/50 pb-2">
              <dt className="text-muted-foreground">Database</dt>
              <dd className="font-mono">PostgreSQL + Prisma</dd>
            </div>
            <div className="flex justify-between border-b border-border/50 pb-2">
              <dt className="text-muted-foreground">UI</dt>
              <dd className="font-mono">shadcn/ui + Tailwind CSS</dd>
            </div>
            <div className="flex justify-between border-b border-border/50 pb-2">
              <dt className="text-muted-foreground">Runtime</dt>
              <dd className="font-mono">Node.js</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Platform</dt>
              <dd className="font-mono">Linux</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
