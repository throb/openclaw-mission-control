import { prisma } from '@/lib/db';
import { HeroStatus } from '@/components/dashboard/hero-status';
import { LiveFeed } from '@/components/dashboard/live-feed';
import CalendarWidget from '@/components/dashboard/calendar-widget';
import { VitalsGauges } from '@/components/dashboard/vitals-gauges';
import { QuickActions } from '@/components/dashboard/quick-actions';
import { KanbanSummary } from '@/components/dashboard/kanban-summary';

export default async function DashboardPage() {
  const [
    activeAgentCount,
    totalAgentCount,
    taskCount,
    cronCount,
    defaultModel,
    cronJobs,
  ] = await Promise.all([
    prisma.agent.count({ where: { status: 'ACTIVE' } }),
    prisma.agent.count(),
    prisma.task.count(),
    prisma.cronJob.count({ where: { enabled: true } }),
    prisma.aIModel.findFirst({
      where: { isDefault: true },
      select: { displayName: true, modelId: true },
    }),
    prisma.cronJob.findMany({
      where: { enabled: true },
      select: {
        id: true,
        name: true,
        schedule: true,
        enabled: true,
        agent: { select: { id: true, name: true } },
      },
    }),
  ]);

  const modelName = defaultModel?.displayName || defaultModel?.modelId || 'No model set';

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gradient-warm">
          Mission Control
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Agent orchestration overview
        </p>
      </div>

      {/* Hero Status Bar */}
      <HeroStatus
        activeAgents={activeAgentCount}
        totalAgents={totalAgentCount}
        taskCount={taskCount}
        cronCount={cronCount}
        modelName={modelName}
      />

      {/* Quick Actions */}
      <QuickActions />

      {/* Main Grid: Live Feed + Vitals */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <LiveFeed />
        </div>
        <div>
          <VitalsGauges />
        </div>
      </div>

      {/* Secondary Grid: Calendar + Kanban Summary */}
      <div className="grid gap-6 lg:grid-cols-2">
        <CalendarWidget cronJobs={cronJobs} />
        <KanbanSummary />
      </div>
    </div>
  );
}
