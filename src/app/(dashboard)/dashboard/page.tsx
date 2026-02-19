import { prisma } from '@/lib/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, FolderKanban, Clock, Cpu, Activity, ListChecks } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import { SystemHealth } from '@/components/dashboard/system-health';
import { ActiveWork } from '@/components/dashboard/active-work';
import { QuickTask } from '@/components/dashboard/quick-task';

/**
 * Format an audit log action into a human-readable description.
 */
function formatAction(action: string): string {
  const parts = action.split('.');
  if (parts.length === 2) {
    const [entity, verb] = parts;
    const entityName = entity.charAt(0).toUpperCase() + entity.slice(1);
    const pastTense: Record<string, string> = {
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
    };
    return `${entityName} ${pastTense[verb] || verb}`;
  }
  return action;
}

/**
 * Format a target string into a readable label.
 * e.g., "agent:cuid123" -> "agent:cuid123" (kept concise)
 */
function formatTarget(target: string | null): string | null {
  if (!target) return null;
  return target;
}

export default async function DashboardPage() {
  // Query all stats in parallel for performance
  const [
    activeAgentCount,
    pausedAgentCount,
    archivedAgentCount,
    projectCount,
    taskCount,
    cronCount,
    modelCount,
    recentLogs,
  ] = await Promise.all([
    prisma.agent.count({ where: { status: 'ACTIVE' } }),
    prisma.agent.count({ where: { status: 'PAUSED' } }),
    prisma.agent.count({ where: { status: 'ARCHIVED' } }),
    prisma.project.count(),
    prisma.task.count(),
    prisma.cronJob.count({ where: { enabled: true } }),
    prisma.aIModel.count(),
    prisma.auditLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { email: true },
        },
      },
    }),
  ]);

  const totalAgents = activeAgentCount + pausedAgentCount + archivedAgentCount;

  const stats = [
    {
      title: 'Active Agents',
      value: activeAgentCount.toString(),
      description: `${totalAgents} total (${pausedAgentCount} paused, ${archivedAgentCount} archived)`,
      icon: Bot,
      accent: 'text-primary',
    },
    {
      title: 'Projects',
      value: projectCount.toString(),
      description: `${taskCount} open task${taskCount !== 1 ? 's' : ''}`,
      icon: FolderKanban,
      accent: 'text-marmalade',
    },
    {
      title: 'Cron Jobs',
      value: cronCount.toString(),
      description: 'Enabled and scheduled',
      icon: Clock,
      accent: 'text-gold',
    },
    {
      title: 'AI Models',
      value: modelCount.toString(),
      description: 'Configured',
      icon: Cpu,
      accent: 'text-wine',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your agent orchestration
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="card-glow transition-all duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.accent}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${stat.accent}`}>{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Task + Active Work */}
      <div className="grid gap-4 md:grid-cols-2">
        <QuickTask />
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agent Overview</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div>
                <div className="text-2xl font-bold">{totalAgents}</div>
                <p className="text-xs text-muted-foreground">Total agents</p>
              </div>
              <div className="flex gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  <span className="text-muted-foreground">{activeAgentCount} active</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-marmalade" />
                  <span className="text-muted-foreground">{pausedAgentCount} paused</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-wine" />
                  <span className="text-muted-foreground">{archivedAgentCount} archived</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Work */}
      <ActiveWork />

      {/* System Health */}
      <SystemHealth />

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Latest agent actions and task updates
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentLogs.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              No activity recorded yet. Actions will appear here as agents run tasks and events are logged.
            </div>
          ) : (
            <div className="space-y-4">
              {recentLogs.map((log) => {
                const target = formatTarget(log.target);
                return (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 rounded-lg border border-transparent p-2 transition-colors hover:border-border hover:bg-muted/50"
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <span className="font-medium">{formatAction(log.action)}</span>
                        {target && (
                          <span className="ml-1 text-muted-foreground">
                            - {target}
                          </span>
                        )}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatDateTime(log.createdAt)}</span>
                        {log.user?.email && (
                          <>
                            <span className="text-border">|</span>
                            <span>{log.user.email}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
